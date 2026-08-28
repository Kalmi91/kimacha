// GAMES.md 4.2 (F2, bubble-pop). Category grouping + round assembly pulled
// out as a pure function so the acceptance criterion ("kategóriánként mindig
// van legalább 3 jó és 3 rossz buborék, különben a kör nem indul el") is
// unit-testable. The words themselves still come ONLY from the caller's pool
// (GAMES.md 0.); this module reads their pos/gender/topic metadata but never
// sources a word from anywhere else.

import { shuffleArray, mulberry32 } from '../shuffle';
import type { WordGender, WordPos } from '../../data/words';

export type BubbleCategorySet = 'topic' | 'pos' | 'gender';

// The 4 word classes the "pos" category set quizzes on. pron/prep/num/phrase
// are too rare or awkward to build a "pop the X" prompt around, so they're
// excluded from THIS game (K6/F-1's metadata still has them, just unused here).
const POS_CATEGORIES: WordPos[] = ['noun', 'verb', 'adj', 'adv'];
const GENDER_CATEGORIES: WordGender[] = ['m', 'f'];

export interface BubbleWordMeta {
  wordId: number;
  learned: string;
  native: string;
  isNew: boolean;
  topicId?: string;
  pos?: WordPos;
  gender?: WordGender;
}

export interface BubbleItem extends BubbleWordMeta {
  isGood: boolean;
}

export interface BubbleRound {
  categorySet: BubbleCategorySet;
  categoryValue: string; // topic id, or the WordPos/WordGender value
  items: BubbleItem[];
}

function groupBy<T, K extends string>(items: T[], keyOf: (item: T) => K | undefined): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (key === undefined) continue;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/**
 * Picks a category (topic / part of speech / grammatical gender) that has at
 * least 3 matching ("good") and at least 3 non-matching ("bad") candidates in
 * `pool`, and builds a shuffled bubble set of up to `count` items (roughly
 * half good, half bad, filling from whichever side has more if one runs
 * short). Returns null if NO valid category exists (GAMES.md 4.2 acceptance:
 * the round must not start in that case).
 */
export function buildBubbleRound(
  pool: BubbleWordMeta[],
  categorySet: BubbleCategorySet,
  count: number,
  seed: number,
  excludeCategoryValue?: string
): BubbleRound | null {
  let groups: Map<string, BubbleWordMeta[]>;
  let universe: BubbleWordMeta[];

  if (categorySet === 'topic') {
    universe = pool.filter((w) => w.topicId);
    groups = groupBy(universe, (w) => w.topicId);
  } else if (categorySet === 'pos') {
    universe = pool.filter((w) => w.pos && POS_CATEGORIES.includes(w.pos));
    groups = groupBy(universe, (w) => w.pos);
  } else {
    universe = pool.filter((w) => w.pos === 'noun' && w.gender && GENDER_CATEGORIES.includes(w.gender));
    groups = groupBy(universe, (w) => w.gender);
  }

  const validKeys = [...groups.keys()].filter((key) => {
    if (key === excludeCategoryValue) return false;
    const good = groups.get(key)!.length;
    const bad = universe.length - good;
    return good >= 3 && bad >= 3;
  });
  if (validKeys.length === 0) return null;

  const rng = mulberry32(seed);
  const categoryValue = validKeys[Math.floor(rng() * validKeys.length)];
  const goodPool = groups.get(categoryValue)!;
  const badPool = universe.filter((w) => (categorySet === 'pos' ? w.pos !== categoryValue : categorySet === 'gender' ? w.gender !== categoryValue : w.topicId !== categoryValue));

  // validKeys already guarantees goodPool.length >= 3 and badPool.length >= 3.
  // Split `count` roughly evenly, then let whichever side has spare capacity
  // fill what the other side couldn't, without ever dropping below 3 a side.
  const half = Math.floor(count / 2);
  let goodCount = Math.min(half, goodPool.length);
  let badCount = Math.min(count - goodCount, badPool.length);
  const shortfall = count - (goodCount + badCount);
  if (shortfall > 0) {
    const addGood = Math.min(shortfall, goodPool.length - goodCount);
    goodCount += addGood;
    const addBad = Math.min(shortfall - addGood, badPool.length - badCount);
    badCount += addBad;
  }
  goodCount = Math.max(3, Math.min(goodCount, goodPool.length));
  badCount = Math.max(3, Math.min(badCount, badPool.length));

  const goodPicked = shuffleArray(goodPool, seed + 1)
    .slice(0, goodCount)
    .map((w) => ({ ...w, isGood: true }));
  const badPicked = shuffleArray(badPool, seed + 2)
    .slice(0, badCount)
    .map((w) => ({ ...w, isGood: false }));

  const items = shuffleArray<BubbleItem>([...goodPicked, ...badPicked], seed + 3);

  return { categorySet, categoryValue, items };
}

// FB162 (2026-08-28 browser playtest): the screen laid the bubbles out with the
// word-rain lane helper, which splits the board into `count` columns. At 12-16
// bubbles that is a ~25px lane for a 68px bubble, so every bubble of the round
// overlapped in ONE row and the words were clipped to two letters. The board is
// a grid instead: only as many columns as actually fit, and the extra rows start
// below the board so the bubbles float up in waves ("12-16 buborék lebeg lassan").
export const BUBBLE_SIZE = 68;
export const BUBBLE_GAP = 12;

export interface BubbleSlot {
  x: number;
  row: number;
}

export function bubbleColumns(boardWidth: number): number {
  return Math.max(1, Math.floor(boardWidth / BUBBLE_SIZE));
}

export function bubbleSlot(index: number, boardWidth: number): BubbleSlot {
  const cols = bubbleColumns(boardWidth);
  const lane = boardWidth / cols;
  const col = index % cols;
  return { x: col * lane + (lane - BUBBLE_SIZE) / 2, row: Math.floor(index / cols) };
}
