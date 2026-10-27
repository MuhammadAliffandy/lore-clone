export const TOPICS = [
  "History",
  "Science",
  "Nature",
  "Culture",
  "Technology",
  "Psychology",
] as const;

export type Topic = (typeof TOPICS)[number];
export type StorySource = { label: string; url: string; attribution?: string; license?: string };

export type Story = {
  id: string;
  title: string;
  summary: string;
  body: string[];
  topic: Topic;
  readMinutes: number;
  imageUrl: string;
  imageAlt: string;
  galleryImages?: Array<{ url: string; caption: string }>;
  source: StorySource;
};

export type ReaderAction =
  | { type: "like"; storyId: string }
  | { type: "save"; storyId: string }
  | { type: "complete"; storyId: string }
  | { type: "skip"; storyId: string }
  | { type: "set-topics"; topics: Topic[] };

export type ReaderState = {
  likedIds: string[];
  savedIds: string[];
  completedIds: string[];
  completedAtById: Record<string, string>;
  skippedIds: string[];
  selectedTopics: Topic[];
  lastCompletedAt: string | null;
  streakDays: number;
};

export const initialReaderState: ReaderState = {
  likedIds: [],
  savedIds: [],
  completedIds: [],
  completedAtById: {},
  skippedIds: [],
  selectedTopics: [...TOPICS],
  lastCompletedAt: null,
  streakDays: 0,
};

function toggle(items: string[], value: string): string[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

function dayKey(value: Date): string {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

export function reduceReaderState(
  state: ReaderState,
  action: ReaderAction,
  now = new Date(),
): ReaderState {
  switch (action.type) {
    case "like":
      return { ...state, likedIds: toggle(state.likedIds, action.storyId) };
    case "save":
      return { ...state, savedIds: toggle(state.savedIds, action.storyId) };
    case "skip":
      return { ...state, skippedIds: toggle(state.skippedIds, action.storyId) };
    case "set-topics":
      return { ...state, selectedTopics: action.topics };
    case "complete": {
      if (state.completedIds.includes(action.storyId)) return state;
      const today = dayKey(now);
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastDay = state.lastCompletedAt ? dayKey(new Date(state.lastCompletedAt)) : null;
      const streakDays = lastDay === today ? state.streakDays : lastDay === dayKey(yesterday) ? state.streakDays + 1 : 1;
      return {
        ...state,
        completedIds: [...state.completedIds, action.storyId],
        completedAtById: { ...(state.completedAtById ?? {}), [action.storyId]: now.toISOString() },
        lastCompletedAt: now.toISOString(),
        streakDays,
      };
    }
  }
}
