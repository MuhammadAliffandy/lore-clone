import type { Story } from "./story";

export type AppScreen = "onboarding" | "feed" | "reader" | "library" | "profile" | "games";

export type FlowState = {
  screen: AppScreen;
  readerStoryId: string | null;
  returnScreen: Exclude<AppScreen, "reader" | "onboarding">;
};

export type FlowAction =
  | { type: "finish-onboarding" }
  | { type: "open-story"; storyId: string }
  | { type: "close-reader" }
  | { type: "navigate"; screen: Exclude<AppScreen, "reader" | "onboarding"> };

export const initialFlowState: FlowState = {
  screen: "onboarding",
  readerStoryId: null,
  returnScreen: "feed",
};

export function reduceFlow(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "finish-onboarding":
      return { ...state, screen: "feed", readerStoryId: null };
    case "open-story":
      return { ...state, screen: "reader", readerStoryId: action.storyId, returnScreen: state.screen === "reader" ? state.returnScreen : state.screen === "onboarding" ? "feed" : state.screen };
    case "close-reader":
      return { ...state, screen: state.returnScreen, readerStoryId: null };
    case "navigate":
      return { ...state, screen: action.screen, readerStoryId: null };
  }
}

export function currentStory(state: FlowState, stories: Story[]): Story | null {
  return state.readerStoryId ? stories.find((story) => story.id === state.readerStoryId) ?? null : null;
}
