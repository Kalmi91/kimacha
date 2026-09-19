// FB316 (NYELVTAN.md NY10): a mondat-átírás (transform) kör 10-es adagokban
// megy, a legkevésbé gyakorolt item elöl, hogy egy nagy lecke (pl. 50 tétel)
// ne egyszerre ugorjon a tanuló elé. `seenCounts` a game_progress
// `${topicId}:transform:seen` sorából jön (app/grammar/[topic].tsx).

import { shuffleArray } from '../shuffle';
import type { TransformItem } from './lessonTypes';

// A gomb-feliratok (app/grammar/[topic].tsx) és a kör mérete egy helyről jön,
// hogy ne csússzanak szét (pl. "10 / 50" gomb, de 12-es kör).
export const TRANSFORM_ROUND_SIZE = 10;

export function pickTransformRound(
  items: readonly TransformItem[],
  seenCounts: Record<string, number>,
  size = TRANSFORM_ROUND_SIZE,
  seed: number
): TransformItem[] {
  const shuffled = shuffleArray(items as TransformItem[], seed);
  if (shuffled.length <= size) return shuffled;
  // Array.prototype.sort stabil (ES2019+): azonos "seen" számnál a fenti
  // seedelt keverés sorrendje marad, ez adja a "seed szerinti véletlent".
  const bySeen = [...shuffled].sort((a, b) => (seenCounts[a.id] ?? 0) - (seenCounts[b.id] ?? 0));
  return bySeen.slice(0, size);
}
