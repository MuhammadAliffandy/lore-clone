import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { stories } from "../src/content/stories.ts";
import { initialReaderState, TOPICS, type ReaderState, type Topic } from "../src/core/story.ts";
import { rankFeed } from "../src/core/rankFeed.ts";

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) loadEnvFile(envFile);

const port = Number(process.env.API_PORT ?? 8787);
const stateFile = fileURLToPath(new URL("../data/reader-state.json", import.meta.url));
const wikiBase = "https://en.wikipedia.org";
const userAgent = process.env.WIKIMEDIA_USER_AGENT ?? "Lore-clone/0.2 (https://github.com/MuhammadAliffandy/lore-clone)";
const cache = new Map<string, { expiresAt: number; value: unknown }>();
let vercelReaderState: ReaderState = initialReaderState;

const TOPIC_QUERIES: Record<Topic, string[]> = {
  History: ["historical inventions", "ancient civilization discoveries", "historical mysteries archaeology", "unusual historical events"],
  Science: ["astronomy discoveries", "physics phenomena", "scientific discoveries", "earth science natural phenomena"],
  Nature: ["animal adaptations", "bioluminescence animals", "animal migration behavior", "extremophile organisms"],
  Culture: ["cultural traditions", "world cuisines food history", "languages writing systems", "festivals rituals"],
  Technology: ["engineering innovations", "inventions history", "space technology", "computing pioneers"],
  Psychology: ["cognitive biases", "psychology perception", "human memory psychology", "behavioral science experiments"],
};

class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly retryAfter?: string) {
    super(message);
  }
}

function sendJson(response: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  response.end(JSON.stringify(value));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk.toString();
    if (raw.length > 300_000) throw new ApiError(413, "Request body is too large.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, "Expected a JSON request body.");
  }
}

async function loadReaderState(): Promise<ReaderState> {
  if (process.env.VERCEL) return vercelReaderState;
  try {
    const value = JSON.parse(await readFile(stateFile, "utf8")) as Partial<ReaderState>;
    return {
      ...initialReaderState,
      ...value,
      likedIds: Array.isArray(value.likedIds) ? value.likedIds : [],
      savedIds: Array.isArray(value.savedIds) ? value.savedIds : [],
      completedIds: Array.isArray(value.completedIds) ? value.completedIds : [],
      completedAtById: value.completedAtById && typeof value.completedAtById === "object" && !Array.isArray(value.completedAtById) ? value.completedAtById : {},
      skippedIds: Array.isArray(value.skippedIds) ? value.skippedIds : [],
      selectedTopics: Array.isArray(value.selectedTopics) ? value.selectedTopics.filter((topic): topic is Topic => TOPICS.includes(topic as Topic)) : [...TOPICS],
    };
  } catch {
    return initialReaderState;
  }
}

async function saveReaderState(value: unknown) {
  if (!value || typeof value !== "object") throw new ApiError(400, "Invalid reader state.");
  const input = value as Partial<ReaderState>;
  const state: ReaderState = {
    ...initialReaderState,
    ...input,
    likedIds: Array.isArray(input.likedIds) ? input.likedIds.filter((id): id is string => typeof id === "string") : [],
    savedIds: Array.isArray(input.savedIds) ? input.savedIds.filter((id): id is string => typeof id === "string") : [],
    completedIds: Array.isArray(input.completedIds) ? input.completedIds.filter((id): id is string => typeof id === "string") : [],
    completedAtById: input.completedAtById && typeof input.completedAtById === "object" && !Array.isArray(input.completedAtById) ? input.completedAtById : {},
    skippedIds: Array.isArray(input.skippedIds) ? input.skippedIds.filter((id): id is string => typeof id === "string") : [],
    selectedTopics: Array.isArray(input.selectedTopics) ? input.selectedTopics.filter((topic): topic is Topic => TOPICS.includes(topic as Topic)) : [...TOPICS],
  };
  if (process.env.VERCEL) {
    vercelReaderState = state;
    return state;
  }
  await mkdir(dirname(stateFile), { recursive: true });
  const temporary = `${stateFile}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(state, null, 2), "utf8");
  await rename(temporary, stateFile);
  return state;
}

async function cachedJson(key: string, ttlMs: number, url: URL) {
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value;
  const result = await fetch(url, { headers: { "User-Agent": userAgent, "Api-User-Agent": userAgent, accept: "application/json" } });
  if (!result.ok) throw new ApiError(result.status === 429 ? 503 : result.status, `Wikimedia returned ${result.status}.`, result.headers.get("retry-after") ?? undefined);
  const value: unknown = await result.json();
  if (cache.size >= 400) {
    const now = Date.now();
    for (const [cacheKey, entry] of cache) if (entry.expiresAt <= now) cache.delete(cacheKey);
    while (cache.size >= 400) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

type WikiPage = {
  pageid: number;
  index?: number;
  title: string;
  extract?: string;
  fullurl?: string;
  thumbnail?: { source: string };
};

async function discoverPages(query: string, limit: number, offset: number) {
  const upstream = new URL("/w/api.php", wikiBase);
  for (const [key, value] of Object.entries({
    action: "query", format: "json", generator: "search", gsrsearch: query,
    gsrlimit: String(limit), gsroffset: String(offset),
    prop: "extracts|pageimages|info", exintro: "1", explaintext: "1",
    piprop: "thumbnail", pithumbsize: "960", inprop: "url", origin: "*",
  })) upstream.searchParams.set(key, value);
  const value = await cachedJson(`wiki-discover:${query}:${offset}`, 10 * 60_000, upstream) as {
    continue?: { gsroffset?: number };
    query?: { pages?: Record<string, WikiPage> };
  };
  const pages = Object.values(value.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return { pages, nextOffset: value.continue?.gsroffset ?? null };
}

function toStory(page: WikiPage, topic: Topic) {
  const extract = page.extract?.trim() ?? "";
  const body = extract.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).slice(0, 4);
  if (!page.pageid || !page.title || !extract || extract.length < 80 || !page.thumbnail?.source) return null;
  const sentences = extract.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+(?=\s|$)/g)?.map((sentence) => sentence.trim()) ?? [];
  const firstSentence = sentences[0];
  return {
    id: `wiki-${page.pageid}`,
    title: page.title,
    summary: firstSentence ?? body[0]?.slice(0, 250) ?? extract.slice(0, 250),
    body: body.length ? body : [extract],
    topic,
    readMinutes: Math.max(1, Math.ceil(extract.split(/\s+/).length / 190)),
    imageUrl: page.thumbnail.source,
    imageAlt: `Photo and illustration for ${page.title}`,
    galleryImages: [{ url: page.thumbnail.source, caption: page.title }],
    source: {
      label: `Wikipedia · ${page.title}`,
      url: page.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`,
      attribution: `Adapted from Wikipedia article “${page.title}”`,
      license: "CC BY-SA 4.0",
    },
  };
}

async function pageMedia(title: string) {
  const encodedTitle = encodeURIComponent(title.replaceAll(" ", "_"));
  const upstream = new URL(`/api/rest_v1/page/media-list/${encodedTitle}`, wikiBase);
  const value = await cachedJson(`wiki-media:${title.toLocaleLowerCase()}`, 12 * 60 * 60_000, upstream) as {
    items?: Array<{ type?: string; leadImage?: boolean; showInGallery?: boolean; caption?: { text?: string }; srcset?: Array<{ src: string; scale: string }> }>;
  };
  const pageImages = (value.items ?? [])
    .filter((item) => item.type === "image" && item.showInGallery !== false)
    .map((item) => {
      const source = [...(item.srcset ?? [])].sort((a, b) => parseFloat(b.scale) - parseFloat(a.scale))[0]?.src;
      return source ? { url: source.startsWith("//") ? `https:${source}` : source, caption: item.caption?.text ?? title, lead: Boolean(item.leadImage) } : null;
    })
    .filter((item): item is { url: string; caption: string; lead: boolean } => Boolean(item))
    .slice(0, 8);
  if (pageImages.length >= 4) return pageImages;

  const commonsUrl = new URL("/w/api.php", "https://commons.wikimedia.org");
  for (const [key, value] of Object.entries({
    action: "query", format: "json", generator: "search", gsrsearch: title,
    gsrnamespace: "6", gsrlimit: "12", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "1280",
  })) commonsUrl.searchParams.set(key, value);
  let commonsPages: Record<string, { title: string; imageinfo?: Array<{ url?: string; thumburl?: string; extmetadata?: Record<string, { value?: string }> }> }> = {};
  try {
    const commons = await cachedJson(`commons-media:${title.toLocaleLowerCase()}`, 12 * 60 * 60_000, commonsUrl) as {
      query?: { pages?: typeof commonsPages };
    };
    commonsPages = commons.query?.pages ?? {};
  } catch {
    return pageImages;
  }
  const terms = title.toLocaleLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2 && !["the", "and", "for", "from", "with", "history"].includes(term));
  const commonsImages = Object.values(commonsPages)
    .map((page) => {
      const info = page.imageinfo?.[0];
      const url = info?.thumburl ?? info?.url;
      if (!url) return null;
      const label = page.title.replace(/^File:/, "").replace(/\.[^.]+$/, "").replace(/_/g, " ");
      const normalizedLabel = label.toLocaleLowerCase();
      const relevance = terms.filter((term) => normalizedLabel.includes(term)).length;
      if (terms.length > 0 && relevance < Math.min(2, terms.length)) return null;
      const clean = (value?: string) => value?.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
      const artist = clean(info?.extmetadata?.Artist?.value);
      const license = clean(info?.extmetadata?.LicenseShortName?.value);
      const credit = [label, artist && `Credit: ${artist}`, license].filter(Boolean).join(" · ");
      return { url, caption: credit, relevance };
    })
    .filter((image): image is { url: string; caption: string; relevance: number } => Boolean(image))
    .sort((a, b) => b.relevance - a.relevance)
    .map(({ url, caption }) => ({ url, caption }));
  return [...pageImages, ...commonsImages]
    .filter((image, index, all) => all.findIndex((candidate) => candidate.url === image.url) === index)
    .slice(0, 8);
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  if (request.method === "GET" && url.pathname === "/api/health") {
    return sendJson(response, 200, { status: "ok", services: ["story-catalog", "wikipedia-proxy", "reader-state"] });
  }
  if (request.method === "GET" && url.pathname === "/api/stories") {
    const topic = url.searchParams.get("topic");
    const query = url.searchParams.get("q")?.trim().toLocaleLowerCase();
    const items = stories.filter((story) => (!topic || story.topic === topic) && (!query || `${story.title} ${story.summary} ${story.body.join(" ")}`.toLocaleLowerCase().includes(query)));
    return sendJson(response, 200, { items, count: items.length, source: "curated-catalog" });
  }
  if (request.method === "GET" && url.pathname === "/api/feed") {
    const state = await loadReaderState();
    const items = rankFeed(stories, state);
    return sendJson(response, 200, { items, count: items.length, source: "local-feed-ranker" });
  }
  if (request.method === "GET" && url.pathname === "/api/reader-state") {
    return sendJson(response, 200, await loadReaderState());
  }
  if (request.method === "PUT" && url.pathname === "/api/reader-state") {
    return sendJson(response, 200, await saveReaderState(await readBody(request)));
  }
  if (request.method === "GET" && url.pathname === "/api/wiki/search") {
    const query = url.searchParams.get("q")?.trim();
    if (!query || query.length < 2) throw new ApiError(400, "Enter at least two characters to search Wikipedia.");
    if (query.length > 100) throw new ApiError(400, "Search query is too long.");
    const { pages } = await discoverPages(query, 10, 0);
    const normalized = pages.filter((page) => page.pageid && page.title).map((page) => {
      const extract = page.extract?.trim() ?? "";
      const description = extract.match(/^.{35,260}?[.!?](?:\s|$)/)?.[0]?.trim() ?? extract.slice(0, 240);
      return { title: page.title, key: String(page.pageid), description, excerpt: extract, thumbnail: page.thumbnail ? { url: page.thumbnail.source } : undefined };
    });
    const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const score = (title: string) => {
      const normalizedTitle = title.toLocaleLowerCase();
      const exact = normalizedTitle === query.toLocaleLowerCase() ? 100 : normalizedTitle.startsWith(query.toLocaleLowerCase()) ? 50 : normalizedTitle.includes(query.toLocaleLowerCase()) ? 25 : 0;
      return exact + terms.reduce((total, term) => total + (normalizedTitle.startsWith(term) ? 3 : normalizedTitle.includes(term) ? 1 : 0), 0);
    };
    normalized.sort((a, b) => {
      return score(b.title) - score(a.title);
    });
    return sendJson(response, 200, { pages: normalized, source: "English Wikipedia" });
  }
  if (request.method === "GET" && url.pathname === "/api/wiki/discover") {
    const requestedTopic = url.searchParams.get("topic") as Topic | null;
    const topic = requestedTopic && TOPICS.includes(requestedTopic) ? requestedTopic : "Science";
    const rawOffset = Number(url.searchParams.get("offset") ?? 0);
    const offset = Number.isInteger(rawOffset) && rawOffset >= 0 && rawOffset <= 5000 ? rawOffset : 0;
    const queryIndex = Math.floor(offset / 1000);
    const queryOffset = offset % 1000;
    const query = TOPIC_QUERIES[topic][queryIndex];
    if (!query) return sendJson(response, 200, { items: [], nextOffset: null, topic, source: "Wikipedia" });
    const { pages, nextOffset: upstreamOffset } = await discoverPages(query, 7, queryOffset);
    const items = pages.flatMap((page) => {
      const story = toStory(page, topic);
      return story ? [story] : [];
    });
    const nextOffset = upstreamOffset == null
      ? queryIndex + 1 < TOPIC_QUERIES[topic].length ? (queryIndex + 1) * 1000 : null
      : queryIndex * 1000 + upstreamOffset;
    return sendJson(response, 200, { items, nextOffset, topic, source: "Wikipedia" });
  }
  if (request.method === "GET" && url.pathname === "/api/wiki/media") {
    const title = url.searchParams.get("title")?.trim();
    if (!title || title.length > 180) throw new ApiError(400, "Provide a valid Wikipedia page title.");
    return sendJson(response, 200, { items: await pageMedia(title), source: "Wikipedia" });
  }
  if (request.method === "GET" && url.pathname === "/api/wiki/page") {
    const title = url.searchParams.get("title")?.trim();
    if (!title || title.length > 180) throw new ApiError(400, "Provide a valid Wikipedia page title.");
    const upstream = new URL(`/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(" ", "_"))}`, wikiBase);
    const value = await cachedJson(`wiki-page:${title.toLocaleLowerCase()}`, 60 * 60_000, upstream);
    return sendJson(response, 200, value);
  }
  return sendJson(response, 404, { error: "Route not found." });
}

export async function handleApiRequest(request: IncomingMessage, response: ServerResponse) {
  return handle(request, response).catch((error: unknown) => {
    if (error instanceof ApiError) {
      const headers: Record<string, string> = error.retryAfter ? { "retry-after": error.retryAfter } : {};
      sendJson(response, error.status, { error: error.message }, headers);
      return;
    }
    console.error("API request failed:", error);
    sendJson(response, 500, { error: "The local API could not complete the request." });
  });
}

if (!process.env.VERCEL) {
  const server = createServer(handleApiRequest);
  server.listen(port, "127.0.0.1", () => {
    console.log(`Lore clone API listening on http://127.0.0.1:${port}`);
  });
}
