import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
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
const userAgent = process.env.WIKIMEDIA_USER_AGENT ?? "Lore-clone/0.1 (http://localhost:5173/)";
const cache = new Map<string, { expiresAt: number; value: unknown }>();

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
  await mkdir(dirname(stateFile), { recursive: true });
  const temporary = `${stateFile}.tmp`;
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
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
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
    const upstream = new URL("/w/rest.php/v1/search/page", wikiBase);
    upstream.searchParams.set("q", query);
    upstream.searchParams.set("limit", "8");
    const value = await cachedJson(`wiki-search:${query.toLocaleLowerCase()}`, 5 * 60_000, upstream);
    return sendJson(response, 200, { ...(value as object), source: "English Wikipedia" });
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

const server = createServer((request, response) => {
  void handle(request, response).catch((error: unknown) => {
    if (error instanceof ApiError) {
      const headers: Record<string, string> = error.retryAfter ? { "retry-after": error.retryAfter } : {};
      sendJson(response, error.status, { error: error.message }, headers);
      return;
    }
    console.error("API request failed:", error);
    sendJson(response, 500, { error: "The local API could not complete the request." });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Lore clone API listening on http://127.0.0.1:${port}`);
});
