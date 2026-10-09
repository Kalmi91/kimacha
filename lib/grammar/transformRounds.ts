// The sentence-rewriting (transform) round goes in batches of 10, the
// least practised item first, so a big lesson (e.g. 50 items)
// does not land in front of the learner all at once. `seenCounts` comes from the game_progress
// `${topicId}:transform:seen` row (app/grammar/[topic].tsx).

import { shuffleArray } from '../shuffle';
import type { TransformItem } from './lessonTypes';

// The button labels (app/grammar/[topic].tsx) and the round size come from one place,
// so they cannot drift apart (e.g. a "10 / 50" button but a round of 12).
export const TRANSFORM_ROUND_SIZE = 10;

export function pickTransformRound(
  items: readonly TransformItem[],
  seenCounts: Record<string, number>,
  size = TRANSFORM_ROUND_SIZE,
  seed: number
): TransformItem[] {
  const shuffled = shuffleArray(items as TransformItem[], seed);
  if (shuffled.length <= size) return shuffled;
  // Array.prototype.sort is stable (ES2019+): with equal "seen" counts the order of the
  // seeded shuffle above stays, which gives the "seed-based randomness".
  const bySeen = [...shuffled].sort((a, b) => (seenCounts[a.id] ?? 0) - (seenCounts[b.id] ?? 0));
  return bySeen.slice(0, size);
}
