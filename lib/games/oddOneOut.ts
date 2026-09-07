// GAMES.md 4.8 (F5, odd-one-out). Round-building pulled into a pure function,
// the same reasoning as bubblePop.ts's buildBubbleRound: the acceptance
// criterion (always exactly 4 words, exactly 1 odd one out, an explainable
// "common thread") is only unit-testable if the round isn't baked into the
// screen component.
//
// GAMES.md 4.10 (ccat) reuses THIS module for its "kakukktojás" item type
// instead of re-implementing category grouping a second time ("Ahol a ccat és
// az odd-one-out ugyanazt csinálja, OSZD MEG a motort, ne másold").
//
// Category metadata (topic/pos/gender) comes from the K6 pos/gender fields
// (F-1), same source bubblePop.ts reads; words themselves still come ONLY
// from the caller's pool (GAMES.md 0.).

import { shuffleArray, mulberry32 } from '../shuffle';
import type { WordGender, WordPos } from '../../data/words';

export type OddCategorySet = 'topic' | 'pos' | 'gender';
// GAMES.md 4.8 Beállítás: "nehézség (téma / szófaj / vegyes)". 'mixed' isn't a
// category itself, it tells the caller to try all three per round (see
// screens/ccat.ts callers): this module only knows the three real categories.

const POS_CATEGORIES: WordPos[] = ['noun', 'verb', 'adj', 'adv'];
// Neuter belongs here for the German branch; a Spanish pool has none, so the
// group-size guard drops the category by itself (see bubblePop).
const GENDER_CATEGORIES: WordGender[] = ['m', 'f', 'n'];

export interface OddWordMeta {
  wordId: number;
  learned: string;
  native: string;
  isNew: boolean;
  topicId?: string;
  pos?: WordPos;
  gender?: WordGender;
}

export interface OddRound {
  categorySet: OddCategorySet;
  categoryValue: string; // topic id, or the WordPos/WordGender value the 3 "same" words share
  items: OddWordMeta[]; // length 4, shuffled order
  oddIndex: number; // index into `items` of the one that doesn't belong
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
 * Picks a category (topic / part of speech / grammatical gender) with at
 * least 3 matching candidates AND at least 1 non-matching candidate in
 * `pool`, then builds a 4-word round: 3 from the category, 1 odd one out
 * from outside it. Returns null if no valid category exists (GAMES.md 4.8/
 * ccat kakukktojás acceptance: the round must not start in that case).
 */
export function buildOddOneOutRound(
  pool: OddWordMeta[],
  categorySet: OddCategorySet,
  seed: number,
  excludeCategoryValue?: string
): OddRound | null {
  let groups: Map<string, OddWordMeta[]>;
  let universe: OddWordMeta[];

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
    return good >= 3 && bad >= 1;
  });
  if (validKeys.length === 0) return null;

  const rng = mulberry32(seed);
  const categoryValue = validKeys[Math.floor(rng() * validKeys.length)];
  const goodPool = groups.get(categoryValue)!;
  const badPool = universe.filter((w) =>
    categorySet === 'pos' ? w.pos !== categoryValue : categorySet === 'gender' ? w.gender !== categoryValue : w.topicId !== categoryValue
  );

  const good = shuffleArray(goodPool, seed + 1).slice(0, 3);
  const odd = shuffleArray(badPool, seed + 2).slice(0, 1);
  const items = shuffleArray<OddWordMeta>([...good, ...odd], seed + 3);
  const oddWordId = odd[0].wordId;
  const oddIndex = items.findIndex((it) => it.wordId === oddWordId);

  return { categorySet, categoryValue, items, oddIndex };
}
