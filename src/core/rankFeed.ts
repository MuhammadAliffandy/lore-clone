import type { ReaderState, Story } from "./story";

/** A small, explainable local ranker; this is a prototype, not Lore's private algorithm. */
export function rankFeed(stories: Story[], state: ReaderState): Story[] {
  const unseen = stories.filter(
    (story) => !state.completedIds.includes(story.id) && !state.skippedIds.includes(story.id),
  );
  return unseen
    .map((story, index) => ({
      story,
      score:
        (state.selectedTopics.includes(story.topic) ? 8 : -4) +
        (state.likedIds.includes(story.id) ? 3 : 0) +
        (state.savedIds.includes(story.id) ? 2 : 0) -
        story.readMinutes * 0.15 -
        index * 0.001,
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ story }) => story);
}
