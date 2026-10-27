import { useEffect, useMemo, useReducer, useState } from "react";
import { stories } from "./content/stories";
import { currentStory, initialFlowState, reduceFlow, type AppScreen } from "./core/flow";
import { loadReaderState, saveReaderState } from "./core/persistence";
import { rankFeed } from "./core/rankFeed";
import { reduceReaderState, TOPICS, type ReaderAction, type ReaderState, type Story, type Topic } from "./core/story";

type IconName = "home" | "compass" | "bookmark" | "user" | "heart" | "arrow-left" | "arrow-right" | "check" | "sparkle" | "clock" | "book" | "sun" | "share" | "close" | "flame" | "play";

function Icon({ name, size = 20, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1 5.1-2.5Z"/></>,
    bookmark: <path d="M6 4.7A1.7 1.7 0 0 1 7.7 3h8.6A1.7 1.7 0 0 1 18 4.7V21l-6-3.8L6 21V4.7Z" fill={filled ? "currentColor" : "none"}/>,
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/></>,
    heart: <path d="M20.5 8.8c0 4.3-8.5 10-8.5 10s-8.5-5.7-8.5-10A4.3 4.3 0 0 1 12 6.5a4.3 4.3 0 0 1 8.5 2.3Z" fill={filled ? "currentColor" : "none"}/>,
    "arrow-left": <><path d="m14.5 5-7 7 7 7"/><path d="M8 12h12"/></>,
    "arrow-right": <><path d="m9.5 5 7 7-7 7"/><path d="M4 12h12"/></>,
    check: <path d="m5 12 4.5 4.5L19 7"/>,
    sparkle: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M4 17a2.5 2.5 0 0 1 2.5-2.5H20"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    share: <><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6m-7.6 7 7.6 4.6"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    flame: <path d="M12 22c4.4 0 7.5-3.1 7.5-7.4 0-3.2-2.1-5.7-4.9-8.8.1 2.7-1.2 4-2.5 4.6C12.3 7.7 10.4 4.9 8 3 8.4 7 5 9.4 5 14.3 5 18.6 7.9 22 12 22Z"/>,
    play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none"/>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const NAV_ITEMS: { id: Exclude<AppScreen, "reader" | "onboarding">; label: string; icon: IconName }[] = [
  { id: "feed", label: "Today", icon: "home" },
  { id: "games", label: "Explore", icon: "compass" },
  { id: "library", label: "Saved", icon: "bookmark" },
  { id: "profile", label: "You", icon: "user" },
];

const TOPIC_TONES: Record<Topic, string> = {
  History: "clay", Science: "blue", Nature: "green", Culture: "plum", Technology: "slate", Psychology: "amber",
};

function TopicTag({ topic }: { topic: Topic }) {
  return <span className={`topic-tag topic-${TOPIC_TONES[topic]}`}><span />{topic}</span>;
}

function App() {
  const [didOnboard, setDidOnboard] = useState(() => window.localStorage.getItem("lore-clone.onboarded") === "yes");
  const [reader, setReader] = useState<ReaderState>(() => {
    const loaded = loadReaderState();
    return didOnboard ? loaded : { ...loaded, selectedTopics: [] };
  });
  const [catalog, setCatalog] = useState<Story[]>(stories);
  const [serverFeed, setServerFeed] = useState<Story[] | null>(null);
  const [flow, dispatchFlow] = useReducer(reduceFlow, didOnboard ? { ...initialFlowState, screen: "feed" as const } : initialFlowState);
  const [notice, setNotice] = useState("");
  const [activeFilter, setActiveFilter] = useState<Topic | "All">("All");
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const feed = useMemo(() => {
    if (!serverFeed) return rankFeed(catalog, reader);
    const seedIds = new Set(stories.map((item) => item.id));
    const supplemental = rankFeed(catalog.filter((item) => !seedIds.has(item.id)), reader);
    return [...serverFeed, ...supplemental];
  }, [catalog, reader, serverFeed]);
  const story = currentStory(flow, catalog);

  useEffect(() => saveReaderState(reader), [reader]);
  useEffect(() => {
    let active = true;
    void fetch("/api/stories").then((response) => response.ok ? response.json() : null).then((data: { items?: Story[] } | null) => {
      if (active && data?.items?.length) setCatalog(data.items);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await fetch("/api/reader-state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(reader) });
        const response = await fetch("/api/feed");
        if (!response.ok) throw new Error("Feed service unavailable");
        const data = await response.json() as { items?: Story[] };
        if (active && Array.isArray(data.items)) setServerFeed(data.items);
      } catch {
        if (active) setServerFeed(null);
      }
    })();
    return () => { active = false; };
  }, [reader]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function send(action: ReaderAction) {
    setReader((previous) => reduceReaderState(previous, action));
  }

  function updateTopics(topic: Topic) {
    const next = reader.selectedTopics.includes(topic)
      ? reader.selectedTopics.filter((item) => item !== topic)
      : [...reader.selectedTopics, topic];
    send({ type: "set-topics", topics: next });
  }

  function finishOnboarding() {
    if (reader.selectedTopics.length === 0) {
      setNotice("Choose at least one interest to shape your feed.");
      return;
    }
    window.localStorage.setItem("lore-clone.onboarded", "yes");
    setDidOnboard(true);
    dispatchFlow({ type: "finish-onboarding" });
  }

  function navigate(screen: Exclude<AppScreen, "reader" | "onboarding">) {
    dispatchFlow({ type: "navigate", screen });
    setSelectedGame(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openStory(item: Story, from: Exclude<AppScreen, "onboarding"> = "feed") {
    setCatalog((current) => current.some((entry) => entry.id === item.id) ? current : [...current, item]);
    if (flow.screen !== from && from !== "reader") dispatchFlow({ type: "navigate", screen: from });
    dispatchFlow({ type: "open-story", storyId: item.id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleLike(item: Story) {
    send({ type: "like", storyId: item.id });
    setNotice(reader.likedIds.includes(item.id) ? "Removed from liked stories" : "Added to liked stories");
  }

  function toggleSave(item: Story) {
    send({ type: "save", storyId: item.id });
    setNotice(reader.savedIds.includes(item.id) ? "Removed from your library" : "Saved for later");
  }

  function finishStory(item: Story) {
    send({ type: "complete", storyId: item.id });
    dispatchFlow({ type: "close-reader" });
    setNotice("A little more curious. Nice work.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function skipStory(item: Story) {
    send({ type: "skip", storyId: item.id });
    setNotice("Got it — we’ll tune your next read.");
  }

  const visibleStories = (flow.screen === "feed" ? feed : catalog).filter((item) => activeFilter === "All" || item.topic === activeFilter);
  const title = flow.screen === "feed" ? "Today’s read" : flow.screen === "library" ? "Your library" : flow.screen === "profile" ? "Your space" : "Explore";

  return (
    <div className="app-frame">
      {flow.screen !== "onboarding" && <aside className="desktop-rail">
        <a className="brand" href="#today" onClick={(event) => { event.preventDefault(); navigate("feed"); }} aria-label="Lore home"><span className="brand-mark"><span /></span><span>lore</span></a>
        <div className="rail-section-label">YOUR SPACE</div>
        <nav className="rail-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => <button key={item.id} className={`rail-link ${flow.screen === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}><Icon name={item.icon} size={19}/><span>{item.label}</span>{item.id === "library" && reader.savedIds.length > 0 && <span className="nav-count">{reader.savedIds.length}</span>}</button>)}
        </nav>
        <div className="rail-bottom">
          <div className="streak-mini"><span className="streak-icon"><Icon name="flame" size={17}/></span><div><strong>{reader.streakDays} day streak</strong><small>Keep your curiosity going</small></div></div>
          <button className="profile-mini" onClick={() => navigate("profile")}><span className="avatar">A</span><span><strong>Curious reader</strong><small>Free plan</small></span><span className="dots">•••</span></button>
        </div>
      </aside>}
      <div className="app-main">
        {flow.screen !== "onboarding" && flow.screen !== "reader" && <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><span /></span><span>lore</span></div>
          <div className="topbar-context"><span className="topbar-eyebrow">A LITTLE MORE CURIOUS, EVERY DAY</span><strong>{title}</strong></div>
          <div className="topbar-right"><button className="icon-button theme-toggle" aria-label="Theme: light" title="Light mode"><Icon name="sun" size={18}/></button><button className="avatar avatar-button" aria-label="Open your profile" onClick={() => navigate("profile")}>A</button></div>
        </header>}

        <main className={`main-content screen-${flow.screen}`}>
          {flow.screen === "onboarding" && <Onboarding selected={reader.selectedTopics} onToggle={updateTopics} onContinue={finishOnboarding}/>}
          {flow.screen === "feed" && <FeedScreen stories={visibleStories} allStories={feed} state={reader} activeFilter={activeFilter} onFilter={setActiveFilter} onOpen={(item) => openStory(item, "feed")} onLike={toggleLike} onSave={toggleSave} onSkip={skipStory} onExplore={() => navigate("games")}/>}
          {flow.screen === "reader" && story && <ReaderScreen story={story} catalog={catalog} state={reader} onBack={() => dispatchFlow({ type: "close-reader" })} onLike={() => toggleLike(story)} onSave={() => toggleSave(story)} onComplete={() => finishStory(story)} onOpenRelated={(item) => openStory(item, "reader")}/>}
          {flow.screen === "library" && <LibraryScreen catalog={catalog} state={reader} onOpen={(item) => openStory(item, "library")} onLike={toggleLike} onSave={toggleSave} onFindStories={() => navigate("feed")}/>}
          {flow.screen === "profile" && <ProfileScreen catalog={catalog} state={reader} onTopics={() => setShowAllTopics((value) => !value)} showTopics={showAllTopics} onToggleTopic={updateTopics} onOpenSaved={() => navigate("library")} onOpenStory={(item) => openStory(item, "profile")}/>}
          {flow.screen === "games" && <ExploreScreen catalog={catalog} preferredTopic={reader.selectedTopics[0] ?? "History"} selectedGame={selectedGame} onSelect={setSelectedGame} onOpenStory={(item) => openStory(item, "games")}/>}
        </main>
        {flow.screen !== "onboarding" && flow.screen !== "reader" && <BottomNav screen={flow.screen} savedCount={reader.savedIds.length} onNavigate={navigate}/ >}
      </div>
      {notice && <div role="status" className="toast"><span className="toast-check"><Icon name="check" size={15}/></span>{notice}</div>}
    </div>
  );
}

function Onboarding({ selected, onToggle, onContinue }: { selected: Topic[]; onToggle: (topic: Topic) => void; onContinue: () => void }) {
  return <section className="onboarding-page">
    <header className="onboarding-top"><a className="brand" href="#start"><span className="brand-mark"><span /></span><span>lore</span></a><span className="onboarding-step">A daily dose of wonder <span>01 / 01</span></span></header>
    <div className="onboarding-content">
      <div className="onboarding-copy"><span className="eyebrow"><Icon name="sparkle" size={14}/> MAKE YOUR FEED YOURS</span><h1>Curiosity looks<br/><em>good on you.</em></h1><p>Choose a few things you love. We’ll find short, fascinating reads worth your time.</p><div className="onboarding-note"><span className="note-icon"><Icon name="clock" size={17}/></span><span>Just a few minutes a day.<br/><strong>Always something new to learn.</strong></span></div></div>
      <div className="interest-panel"><div className="interest-heading"><div><span className="eyebrow">START WITH WHAT YOU LOVE</span><h2>What are you curious about?</h2></div><span className="interest-count">{selected.length} selected</span></div><div className="interest-grid">{TOPICS.map((topic, index) => <button key={topic} className={`interest-card ${selected.includes(topic) ? "selected" : ""} interest-${TOPIC_TONES[topic]}`} onClick={() => onToggle(topic)} aria-pressed={selected.includes(topic)}><span className="interest-art" aria-hidden="true"><Icon name={["clock", "sparkle", "sun", "book", "compass", "heart"][index] as IconName} size={22}/></span><span className="interest-name">{topic}</span><span className="interest-check"><Icon name="check" size={13}/></span></button>)}</div><button className="primary-button onboarding-cta" onClick={onContinue}>Build my feed <Icon name="arrow-right" size={17}/></button><p className="onboarding-footnote">You can change your interests anytime.</p></div>
    </div>
    <footer className="onboarding-footer"><span>Small stories. Bigger perspective.</span><span>Made for curious minds <span className="footer-spark">✳</span></span></footer>
  </section>;
}

function FeedScreen({ stories: visible, allStories, state, activeFilter, onFilter, onOpen, onLike, onSave, onSkip, onExplore }: { stories: Story[]; allStories: Story[]; state: ReaderState; activeFilter: Topic | "All"; onFilter: (topic: Topic | "All") => void; onOpen: (story: Story) => void; onLike: (story: Story) => void; onSave: (story: Story) => void; onSkip: (story: Story) => void; onExplore: () => void }) {
  const next = visible[0];
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  return <div className="feed-layout"><div className="feed-intro"><div><span className="eyebrow date-eyebrow">{today.toUpperCase()}</span><h1>A fresh little <em>discovery.</em></h1><p>One good story can change your whole day.</p></div><div className="daily-progress"><span className="progress-ring"><span>✳</span></span><div><strong>{state.completedIds.length} stories</strong><small>read in total</small></div></div></div>
    <div className="filter-row" role="tablist" aria-label="Filter stories by topic">{["All", ...TOPICS].map((topic) => <button key={topic} role="tab" aria-selected={activeFilter === topic} className={`filter-chip ${activeFilter === topic ? "active" : ""}`} onClick={() => onFilter(topic as Topic | "All")}>{topic}</button>)}</div>
    {next ? <><article className={`story-card story-card--${next.topic.toLowerCase()}`}><button className="story-image-button" onClick={() => onOpen(next)} aria-label={`Read ${next.title}`}><img src={next.imageUrl} alt={next.imageAlt}/><span className="image-gradient"/><span className="image-badge"><Icon name="sparkle" size={13}/> TODAY’S STORY</span><span className="image-count">{String(allStories.findIndex((item) => item.id === next.id) + 1).padStart(2, "0")} <i>/</i> {String(allStories.length).padStart(2, "0")}</span></button><div className="story-card-body"><div className="story-copy"><TopicTag topic={next.topic}/><h2><button onClick={() => onOpen(next)}>{next.title}</button></h2><p>{next.summary}</p><div className="story-meta"><span><Icon name="clock" size={14}/>{next.readMinutes} min read</span><span className="meta-divider"/><span>From {next.source.label.split(" · ")[0]}</span></div></div><div className="story-actions"><button className={`action-button ${state.likedIds.includes(next.id) ? "is-liked" : ""}`} aria-label={state.likedIds.includes(next.id) ? "Unlike story" : "Like story"} aria-pressed={state.likedIds.includes(next.id)} onClick={() => onLike(next)}><Icon name="heart" size={19} filled={state.likedIds.includes(next.id)}/></button><button className={`action-button ${state.savedIds.includes(next.id) ? "is-saved" : ""}`} aria-label={state.savedIds.includes(next.id) ? "Remove from saved" : "Save story"} aria-pressed={state.savedIds.includes(next.id)} onClick={() => onSave(next)}><Icon name="bookmark" size={18} filled={state.savedIds.includes(next.id)}/></button><button className="action-button skip-action" aria-label="Skip this story" onClick={() => onSkip(next)}><Icon name="arrow-right" size={19}/></button></div><button className="read-story-button" onClick={() => onOpen(next)}>Read the story <span><Icon name="arrow-right" size={16}/></span></button></div></article>
      <div className="feed-bottom-row"><div className="next-up"><span className="next-up-icon"><Icon name="sparkle" size={17}/></span><span><strong>There’s always more to wonder about.</strong><small>Your next read is waiting in Explore.</small></span></div><button className="text-link" onClick={onExplore}>Explore all <Icon name="arrow-right" size={15}/></button></div>
      {visible.length > 1 && <section className="more-reads"><div className="section-heading"><div><span className="eyebrow">KEEP FOLLOWING THAT THREAD</span><h2>A few more for you</h2></div><span className="subtle-count">{visible.length - 1} stories</span></div><div className="mini-story-list">{visible.slice(1).map((item) => <StoryRow key={item.id} story={item} onClick={() => onOpen(item)}/>)}</div></section>}
    </> : <div className="empty-state"><span className="empty-art"><Icon name="sparkle" size={27}/></span><h2>{allStories.length ? "No reads in this topic yet." : "You’re all caught up."}</h2><p>{allStories.length ? "Try another interest to find your next little discovery." : "Your next story will be ready soon. For now, explore the library."}</p><button className="secondary-button" onClick={() => onFilter("All")}>{allStories.length ? "Show all stories" : "Explore stories"}</button></div>}
  </div>;
}

function ReaderScreen({ story, catalog, state, onBack, onLike, onSave, onComplete, onOpenRelated }: { story: Story; catalog: Story[]; state: ReaderState; onBack: () => void; onLike: () => void; onSave: () => void; onComplete: () => void; onOpenRelated: (story: Story) => void }) {
  const related = catalog.filter((item) => item.id !== story.id && item.topic === story.topic).slice(0, 2);
  const relatedStories = (related.length ? related : catalog.filter((item) => item.id !== story.id)).slice(0, 2);
  return <article className="reader-page"><div className="reader-toolbar"><button className="back-button" onClick={onBack}><Icon name="arrow-left" size={18}/><span>Back to today</span></button><span className="reader-toolbar-right"><span><Icon name="clock" size={14}/>{story.readMinutes} min</span><button className="icon-button" aria-label="Share story" onClick={() => { void navigator.clipboard?.writeText(window.location.href); }}><Icon name="share" size={17}/></button></span></div><div className="reader-hero"><img src={story.imageUrl} alt={story.imageAlt}/><div className="reader-image-wash"/><div className="reader-hero-label"><TopicTag topic={story.topic}/><span>FIELD NOTE <i>·</i> 01</span></div></div><div className="reader-content"><div className="reader-heading"><span className="eyebrow">A STORY TO TAKE WITH YOU</span><h1>{story.title}</h1><p className="reader-deck">{story.summary}</p><div className="reader-byline"><span className="tiny-avatar">L</span><span>Curated by Lore</span><span className="byline-dot">·</span><span>{story.readMinutes} min read</span></div></div><div className="reader-rule"><span/><i>✳</i><span/></div><div className="article-body">{story.body.map((paragraph, index) => <p key={paragraph} className={index === 0 ? "lead-paragraph" : ""}>{paragraph}</p>)}</div><a className="source-link" href={story.source.url} target="_blank" rel="noreferrer"><span><Icon name="book" size={17}/></span><span><strong>Keep exploring</strong><small>{story.source.attribution ?? `Source: ${story.source.label}`}{story.source.license ? ` · ${story.source.license}` : ""}</small></span><Icon name="arrow-right" size={17}/></a><div className="reader-actions"><button className={`reader-action ${state.likedIds.includes(story.id) ? "is-liked" : ""}`} onClick={onLike}><Icon name="heart" filled={state.likedIds.includes(story.id)} size={18}/>{state.likedIds.includes(story.id) ? "Liked" : "Like"}</button><button className={`reader-action ${state.savedIds.includes(story.id) ? "is-saved" : ""}`} onClick={onSave}><Icon name="bookmark" filled={state.savedIds.includes(story.id)} size={17}/>{state.savedIds.includes(story.id) ? "Saved" : "Save"}</button></div><button className="primary-button finish-button" onClick={onComplete}><span>Finish this story</span><span className="finish-check"><Icon name="check" size={15}/></span></button></div>{relatedStories.length > 0 && <section className="related-section"><div className="section-heading"><div><span className="eyebrow">IF YOU LIKED THIS</span><h2>Follow the thread</h2></div></div><div className="related-list">{relatedStories.map((item) => <StoryRow key={item.id} story={item} onClick={() => onOpenRelated(item)}/>)}</div></section>}</article>;
}

function LibraryScreen({ catalog, state, onOpen, onLike, onSave, onFindStories }: { catalog: Story[]; state: ReaderState; onOpen: (story: Story) => void; onLike: (story: Story) => void; onSave: (story: Story) => void; onFindStories: () => void }) {
  const [collection, setCollection] = useState<"saved" | "liked">("saved");
  const [topic, setTopic] = useState<Topic | "All">("All");
  const saved = catalog.filter((item) => state.savedIds.includes(item.id));
  const liked = catalog.filter((item) => state.likedIds.includes(item.id));
  const collectionItems = collection === "saved" ? saved : liked;
  const items = topic === "All" ? collectionItems : collectionItems.filter((item) => item.topic === topic);
  return <div className="library-page"><div className="page-intro"><span className="eyebrow">YOUR PERSONAL COLLECTION</span><h1>Keep the things<br/><em>that stay with you.</em></h1><p>Stories worth coming back to, all in one little place.</p></div><div className="library-tabs"><button className={collection === "saved" ? "active" : ""} onClick={() => setCollection("saved")}>Saved <span>{saved.length}</span></button><button className={collection === "liked" ? "active" : ""} onClick={() => setCollection("liked")}>Liked <span>{liked.length}</span></button></div>{collectionItems.length ? <><div className="filter-row library-filters">{["All", ...TOPICS].map((itemTopic) => <button key={itemTopic} className={`filter-chip ${topic === itemTopic ? "active" : ""}`} onClick={() => setTopic(itemTopic as Topic | "All")}>{itemTopic}</button>)}</div>{items.length ? <div className="library-grid">{items.map((item) => <article key={item.id} className="library-card"><button className="library-image" onClick={() => onOpen(item)} aria-label={`Read ${item.title}`}><img src={item.imageUrl} alt={item.imageAlt}/></button><div className="library-card-copy"><TopicTag topic={item.topic}/><h2><button onClick={() => onOpen(item)}>{item.title}</button></h2><p>{item.summary}</p><div className="library-card-actions"><button onClick={() => onOpen(item)}>Read story <Icon name="arrow-right" size={14}/></button>{collection === "saved" && <button aria-label="Remove saved story" onClick={() => onSave(item)}><Icon name="bookmark" size={16} filled/></button>}<button aria-label="Toggle like" onClick={() => onLike(item)}><Icon name="heart" size={16} filled={state.likedIds.includes(item.id)}/></button></div></div></article>)}</div> : <EmptyMessage title={`Nothing ${collection} in this topic.`} text="Choose another topic or find a story you love."/>}</> : <EmptyMessage title={collection === "saved" ? "A place for your favorite stories." : "Stories you love, all together."} text={collection === "saved" ? "Save a story as you read and it’ll be waiting for you here." : "Like a story while you read and it’ll show up here."}><button className="primary-button" onClick={onFindStories}>Find a story <Icon name="arrow-right" size={16}/></button></EmptyMessage>}</div>;
}

function ProfileScreen({ catalog, state, onTopics, showTopics, onToggleTopic, onOpenSaved, onOpenStory }: { catalog: Story[]; state: ReaderState; onTopics: () => void; showTopics: boolean; onToggleTopic: (topic: Topic) => void; onOpenSaved: () => void; onOpenStory: (story: Story) => void }) {
  const saved = catalog.filter((item) => state.savedIds.includes(item.id));
  const liked = catalog.filter((item) => state.likedIds.includes(item.id));
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date();
  const todayIndex = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - todayIndex);
  monday.setHours(0, 0, 0, 0);
  const weekDays = dayLabels.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const readCount = Object.values(state.completedAtById ?? {}).filter((value) => {
      const readAt = new Date(value);
      return `${readAt.getFullYear()}-${readAt.getMonth()}-${readAt.getDate()}` === dateKey;
    }).length;
    return { label, index, readCount };
  });
  const thisWeekCount = weekDays.reduce((total, day) => total + day.readCount, 0);
  return <div className="profile-page"><div className="profile-hero"><div className="profile-portrait">A<span>✳</span></div><div className="profile-title"><span className="eyebrow">A MIND THAT KEEPS WANDERING</span><h1>Curious reader</h1><p>On a journey of little discoveries.</p></div><button className="edit-profile" aria-label="Edit profile">•••</button></div><div className="profile-stats"><div className="stat-card streak-stat"><span className="stat-icon"><Icon name="flame" size={19}/></span><strong>{state.streakDays}</strong><span>day streak</span><small>One curious day at a time</small></div><div className="stat-card"><span className="stat-icon olive"><Icon name="book" size={19}/></span><strong>{state.completedIds.length}</strong><span>stories read</span><small>A mind in motion</small></div><div className="stat-card"><span className="stat-icon rose"><Icon name="bookmark" size={18}/></span><strong>{saved.length}</strong><span>stories saved</span><small>For another quiet moment</small></div></div><section className="reading-week"><div className="section-heading"><div><span className="eyebrow">A LITTLE RITUAL</span><h2>Your reading week</h2></div><span className="week-total">{thisWeekCount} reads this week</span></div><div className="week-row">{weekDays.map(({ label, index, readCount }) => <div className={`week-day ${index === todayIndex ? "today" : ""}`} key={`${label}-${index}`}><span className="week-dot">{readCount > 0 ? <Icon name="check" size={12}/> : ""}</span><small>{label}</small></div>)}</div></section><section className="interests-section"><div className="section-heading"><div><span className="eyebrow">TUNE YOUR FEED</span><h2>Things you’re into</h2></div><button className="text-link" onClick={onTopics}>{showTopics ? "Done" : "Edit"}</button></div>{showTopics ? <div className="topic-selector">{TOPICS.map((topic) => <button key={topic} onClick={() => onToggleTopic(topic)} className={state.selectedTopics.includes(topic) ? "selected" : ""} aria-pressed={state.selectedTopics.includes(topic)}><span/>{topic}</button>)}</div> : <div className="profile-topic-list">{state.selectedTopics.map((topic) => <TopicTag key={topic} topic={topic}/>)}</div>}</section><section className="profile-saved"><div className="section-heading"><div><span className="eyebrow">TAKE A SECOND LOOK</span><h2>Saved for later</h2></div><button className="text-link" onClick={onOpenSaved}>See all <Icon name="arrow-right" size={15}/></button></div>{saved.length ? <div className="mini-story-list">{saved.slice(0, 2).map((item) => <StoryRow key={item.id} story={item} onClick={() => onOpenStory(item)}/>)}</div> : <p className="profile-empty">The stories you save will find a home here.</p>}{liked.length > 0 && <button className="liked-summary" onClick={onOpenSaved}><Icon name="heart" size={16} filled/> You’ve liked {liked.length} {liked.length === 1 ? "story" : "stories"} <Icon name="arrow-right" size={14}/></button>}</section></div>;
}

function ExploreScreen({ catalog, preferredTopic, selectedGame, onSelect, onOpenStory }: { catalog: Story[]; preferredTopic: Topic; selectedGame: string | null; onSelect: (game: string | null) => void; onOpenStory: (story: Story) => void }) {
  const questions = [
    { prompt: "8 + 7", options: [13, 15, 16, 14], answer: 1 },
    { prompt: "9 × 4", options: [32, 36, 35, 38], answer: 1 },
    { prompt: "27 − 8", options: [17, 19, 21, 18], answer: 1 },
  ];
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [query, setQuery] = useState("");
  const [wikiResults, setWikiResults] = useState<Array<{ title: string; key: string; description?: string; excerpt?: string; thumbnail?: { url?: string } }>>([]);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiError, setWikiError] = useState("");
  const [openingTitle, setOpeningTitle] = useState("");
  useEffect(() => {
    setQuestionIndex(0);
    setScore(0);
    setChoice(null);
    setFinished(false);
  }, [selectedGame]);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setWikiResults([]); setWikiError(""); setWikiLoading(false); return; }
    let active = true;
    const timer = window.setTimeout(async () => {
      setWikiLoading(true);
      setWikiError("");
      setWikiResults([]);
      try {
        const response = await fetch(`/api/wiki/search?q=${encodeURIComponent(term)}`);
        const data = await response.json() as { pages?: typeof wikiResults; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Wikipedia search is unavailable.");
        if (active) setWikiResults(data.pages ?? []);
      } catch (error) {
        if (active) setWikiError(error instanceof Error ? error.message : "Could not search Wikipedia.");
      } finally { if (active) setWikiLoading(false); }
    }, 280);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);
  async function openWikiPage(result: (typeof wikiResults)[number]) {
    setOpeningTitle(result.title);
    setWikiError("");
    try {
      const response = await fetch(`/api/wiki/page?title=${encodeURIComponent(result.title)}`);
      const page = await response.json() as { title?: string; extract?: string; description?: string; thumbnail?: { source?: string }; content_urls?: { desktop?: { page?: string } } };
      if (!response.ok || !page.extract) throw new Error("This Wikipedia page has no readable summary yet.");
      const title = page.title ?? result.title;
      const body = page.extract.split(/(?<=[.!?])\s+/).filter(Boolean);
      const slug = (result.key || title).toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const article: Story = {
        id: `wiki-${slug}`,
        title,
        summary: page.description || result.description || body[0] || `A short read about ${title}.`,
        body,
        topic: preferredTopic,
        readMinutes: Math.max(1, Math.ceil(page.extract.split(/\s+/).length / 190)),
        imageUrl: page.thumbnail?.source ?? result.thumbnail?.url ?? catalog[0]?.imageUrl ?? stories[0]!.imageUrl,
        imageAlt: `Illustration for ${title}`,
        source: { label: `Wikipedia · ${title}`, url: page.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`, attribution: `Adapted from Wikipedia article “${title}”`, license: "CC BY-SA 4.0" },
      };
      onOpenStory(article);
    } catch (error) { setWikiError(error instanceof Error ? error.message : "Could not open this Wikipedia page."); }
    finally { setOpeningTitle(""); }
  }
  const games = [{ name: "Math Blitz", description: "Three quick sums to wake up your mind.", symbol: "＋", color: "quiz" }];
  if (selectedGame && finished) return <div className="game-view"><button className="back-button" onClick={() => onSelect(null)}><Icon name="arrow-left" size={18}/> Back to Explore</button><span className="game-art"><Icon name="sparkle" size={30}/></span><span className="eyebrow">A LITTLE MENTAL STRETCH</span><h1>Nice work.</h1><p>You got <strong>{score} of {questions.length}</strong> sums right. A few minutes of practice adds up.</p><button className="primary-button" onClick={() => { setQuestionIndex(0); setScore(0); setChoice(null); setFinished(false); }}>Play again <Icon name="arrow-right" size={16}/></button></div>;
  if (selectedGame) {
    const question = questions[questionIndex];
    if (!question) return null;
    return <div className="game-view math-game"><button className="back-button" onClick={() => onSelect(null)}><Icon name="arrow-left" size={18}/> Back to Explore</button><div className="quiz-card"><span className="quiz-progress">MATH BLITZ <span>{String(questionIndex + 1).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}</span></span><div className="quiz-progress-track"><span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }}/></div><span className="game-art"><span>＋</span></span><span className="eyebrow">TAKE A SECOND, TRUST YOUR INSTINCT</span><h1>{question.prompt} <i>= ?</i></h1><div className="quiz-options">{question.options.map((option, index) => <button key={option} className={choice === index ? (index === question.answer ? "correct" : "incorrect") : choice !== null && index === question.answer ? "correct-answer" : ""} disabled={choice !== null} onClick={() => { setChoice(index); if (index === question.answer) setScore((value) => value + 1); }}>{option}</button>)}</div>{choice !== null && <p className={`answer-note ${choice === question.answer ? "right" : "wrong"}`}>{choice === question.answer ? "That’s it. Keep going." : `Not quite — the answer is ${question.options[question.answer]}.`}</p>}<button className="primary-button quiz-next" disabled={choice === null} onClick={() => { if (questionIndex + 1 === questions.length) setFinished(true); else { setQuestionIndex((value) => value + 1); setChoice(null); } }}>{questionIndex + 1 === questions.length ? "See my score" : "Next sum"}<Icon name="arrow-right" size={16}/></button></div></div>;
  }
  return <div className="explore-page"><div className="page-intro"><span className="eyebrow">FOLLOW YOUR CURIOSITY</span><h1>There’s always<br/><em>more to discover.</em></h1><p>Pick up a new thread, or give your brain a little playful stretch.</p></div><section className="explore-feature"><div className="feature-art"><span>✳</span><i>•</i><b>✦</b></div><div className="explore-feature-copy"><span className="eyebrow">A SMALL MOMENT, A BIGGER WORLD</span><h2>Wander a little further.</h2><p>Curated stories take you from familiar ideas to new perspectives.</p><button className="text-link" onClick={() => onOpenStory(catalog[1] ?? catalog[0] ?? stories[0]!)}>Find your next read <Icon name="arrow-right" size={15}/></button></div></section><section className="wiki-section"><div className="section-heading"><div><span className="eyebrow">A WINDOW INTO WIKIPEDIA</span><h2>Follow a question</h2></div><span className="subtle-count">Live article search</span></div><label className="wiki-search"><Icon name="compass" size={19}/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try ‘deep sea’, ‘silk road’…" aria-label="Search Wikipedia articles"/><kbd>↵</kbd></label><p className="wiki-hint">Search a subject and open a short, attributed summary.</p>{wikiLoading && <p className="wiki-status" role="status">Looking for a good thread…</p>}{wikiError && <p className="wiki-error" role="alert">{wikiError}</p>}{!wikiLoading && query.trim().length >= 2 && !wikiError && wikiResults.length === 0 && <p className="wiki-status">No articles found. Try a broader search.</p>}{wikiResults.length > 0 && <div className="wiki-results">{wikiResults.map((result) => <button className="wiki-result" key={result.key} onClick={() => void openWikiPage(result)} disabled={Boolean(openingTitle)}><span className="wiki-result-image">{result.thumbnail?.url ? <img src={result.thumbnail.url} alt=""/> : <Icon name="book" size={20}/>}</span><span className="wiki-result-copy"><strong>{result.title}</strong><small>{result.description ?? result.excerpt?.replace(/<[^>]*>/g, "") ?? "Open a short article summary"}</small></span><span className="row-arrow">{openingTitle === result.title ? "…" : <Icon name="arrow-right" size={16}/>}</span></button>)}</div>}</section><section className="games-section"><div className="section-heading"><div><span className="eyebrow">PLAY WITH WHAT YOU KNOW</span><h2>Little brain breaks</h2></div><span className="subtle-count">A quick round</span></div><div className="games-grid">{games.map((game) => <button key={game.name} className={`game-card game-${game.color}`} onClick={() => onSelect(game.name)}><span className="game-symbol">{game.symbol}</span><span className="game-card-copy"><strong>{game.name}</strong><small>{game.description}</small></span><span className="game-play"><Icon name="play" size={12}/></span></button>)}</div></section><section className="topic-explore"><div className="section-heading"><div><span className="eyebrow">A FEW OPEN TABS</span><h2>Stories to get lost in</h2></div></div><div className="mini-story-list">{catalog.slice(0, 3).map((item) => <StoryRow key={item.id} story={item} onClick={() => onOpenStory(item)}/>)}</div></section></div>;
}

function StoryRow({ story, onClick }: { story: Story; onClick: () => void }) {
  return <button className="story-row" onClick={onClick}><span className="story-row-image"><img src={story.imageUrl} alt=""/></span><span className="story-row-copy"><TopicTag topic={story.topic}/><strong>{story.title}</strong><small>{story.readMinutes} min read <span>·</span> {story.source.label.split(" · ")[0]}</small></span><span className="row-arrow"><Icon name="arrow-right" size={16}/></span></button>;
}

function EmptyMessage({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return <div className="empty-state compact-empty"><span className="empty-art"><Icon name="bookmark" size={26}/></span><h2>{title}</h2><p>{text}</p>{children}</div>;
}

function BottomNav({ screen, savedCount, onNavigate }: { screen: AppScreen; savedCount: number; onNavigate: (screen: Exclude<AppScreen, "reader" | "onboarding">) => void }) {
  return <nav className="bottom-nav" aria-label="Main navigation">{NAV_ITEMS.map((item) => <button key={item.id} className={`bottom-nav-item ${screen === item.id ? "active" : ""}`} onClick={() => onNavigate(item.id)} aria-current={screen === item.id ? "page" : undefined}><span className="bottom-icon"><Icon name={item.icon} size={19} filled={item.id === "library" && screen === "library"}/>{item.id === "library" && savedCount > 0 && <i className="bottom-badge"/>}</span><span>{item.label}</span></button>)}</nav>;
}

export default App;
