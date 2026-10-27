import { initialReaderState, type ReaderState } from "./story";

const STORAGE_KEY = "lore-clone.reader.v1";

export function loadReaderState(): ReaderState {
  if (typeof window === "undefined") return initialReaderState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialReaderState;
    const value = JSON.parse(raw) as Partial<ReaderState>;
    return {
      ...initialReaderState,
      ...value,
      likedIds: Array.isArray(value.likedIds) ? value.likedIds : [],
      savedIds: Array.isArray(value.savedIds) ? value.savedIds : [],
      completedIds: Array.isArray(value.completedIds) ? value.completedIds : [],
      completedAtById: value.completedAtById && typeof value.completedAtById === "object" && !Array.isArray(value.completedAtById) ? value.completedAtById : {},
      skippedIds: Array.isArray(value.skippedIds) ? value.skippedIds : [],
      selectedTopics: Array.isArray(value.selectedTopics) ? value.selectedTopics : [...initialReaderState.selectedTopics],
    };
  } catch {
    return initialReaderState;
  }
}

export function saveReaderState(state: ReaderState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing or storage quotas should not stop reading.
  }
}
