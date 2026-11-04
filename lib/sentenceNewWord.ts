// New words on the Sentences tab (FB564, Kálmán 2026-11-03): with nothing to practise the tab offers a new word instead of an
// empty screen, in every language pair. A new word is a word card (word, meaning, read aloud once, a Next button) and then,
// when it has one, the word's own example sentence on rung 1 (lib/sentenceLadder.ts): only that word is new in it, and it was
// just taught, so the rule "never an unknown word in a sentence" holds. A word with no such sentence yet (a beginner) is the
// card alone, so the known words grow until sentences open up.
//
// The word is introduced the way the Learn tab introduces one: an SM-2 review of a new card (lib/sm2.ts sm2Review, graded
// 'good', the card is then learned and comes back as a review), written with upsertPcicCard. The daily budget is the Learn
// tab's too (daily_new_limit + the day's bonus, minus every card introduced today, lib/pcicSession.ts pcicNewBudget), so a word
// introduced here is not new there and counts there. At most MAX_NEW_WORDS_PER_ROUND words come in a round.

import type { PcicItem, PcicKind, PcicTarget } from '@/data/pcic';
import type { DB } from '@/lib/database';
import type { ResolvedTense } from '@/lib/knownSentence';
import { pcicNewBudget } from '@/lib/pcicSession';
import type { Ladder } from '@/lib/sentenceLadder';
import { buildSentenceQueue, type SentenceEntry } from '@/lib/sentenceTab';
import { sm2NewCard, sm2Review, type Sm2Card } from '@/lib/sm2';

/** A round brings at most this many new words (each with its sentence when it has one). */
export const MAX_NEW_WORDS_PER_ROUND = 3;

/** How many more words the Learn tab's daily budget lets in today: limit + today's bonus, minus every card introduced today. */
export function newWordsLeft(budget: { limit: number; bonus: number; introducedAllLevels: number }): number {
  const { limit, bonus, introducedAllLevels } = budget;
  return Math.max(0, pcicNewBudget({ limit, bonus, introducedToday: introducedAllLevels }) - introducedAllLevels);
}

/**
 * The next new words in the order given (the Learn tab's: the level's items in file order): no card yet, or a card still `new`.
 * A sentence-kind item is no word card (the Sentences tab plays those), it is skipped.
 */
export function nextNewWordIds(
  order: readonly string[],
  cards: Iterable<Sm2Card>,
  kindOf: (id: string) => PcicKind | undefined,
  count: number,
): string[] {
  const started = new Set<string>();
  for (const card of cards) if (card.state !== 'new') started.add(card.itemId);
  const out: string[] = [];
  for (const id of order) {
    if (out.length >= count) break;
    if (!started.has(id) && kindOf(id) !== 'sentence') out.push(id);
  }
  return out;
}

export interface NewWordPlanDeps {
  db: Pick<DB, 'getDailyNewLimit' | 'getPcicNewBonus'>;
  target: PcicTarget;
  today: string;
  /** The ids the new words are taken from, in the Learn tab's order. */
  order: readonly string[];
  /** Every card of the learner (orphans already dropped). */
  cards: readonly Sm2Card[];
  findItem: (id: string) => PcicItem | undefined;
  tenses?: ReadonlySet<ResolvedTense>;
  levelOf?: (id: string) => string | undefined;
  ladder?: Ladder;
}

export interface NewWordPlan {
  /** The entries of a new-word round (empty = no new word to offer). */
  entries: SentenceEntry[];
  /** There was a new word to offer but today's budget is used up: the tab says so. */
  budgetOut: boolean;
}

/**
 * The entries of a round of new words: for each word the entry that starts with its card and carries the word's own sentence,
 * when that sentence is all known words once this word (and the ones before it in the round) are introduced. Its place on the
 * ladder is the one a fresh sentence has: a sentence already on rung 2 or 3 (or learned) under another item is not played again
 * here, the word is then the card alone.
 */
export async function planNewWords(deps: NewWordPlanDeps): Promise<NewWordPlan> {
  const { db, target, today, order, cards, findItem, tenses, levelOf, ladder } = deps;
  const kindOf = (id: string) => findItem(id)?.kind;
  const introducedAllLevels = cards.filter((c) => c.introducedAt === today).length;
  const left = newWordsLeft({ limit: await db.getDailyNewLimit(), bonus: await db.getPcicNewBonus(today), introducedAllLevels });
  const ids = nextNewWordIds(order, cards, kindOf, Math.min(MAX_NEW_WORDS_PER_ROUND, left));
  if (ids.length === 0) return { entries: [], budgetOut: left === 0 && nextNewWordIds(order, cards, kindOf, 1).length > 0 };
  const byId = new Map(cards.map((c) => [c.itemId, c]));
  const introduced: Sm2Card[] = [];
  const entries: SentenceEntry[] = [];
  for (const id of ids) {
    const item = findItem(id);
    if (!item) continue;
    introduced.push(sm2Review(byId.get(id) ?? sm2NewCard(id), 'good', today));
    const known = [...cards.filter((c) => !introduced.some((i) => i.itemId === c.itemId)), ...introduced];
    const own = buildSentenceQueue({ target, cards: known, tenses, items: [item], findItem, levelOf, today, ladder }).find((e) => e.itemId === id && e.rung === undefined);
    entries.push(own ? { ...own, newWord: true } : { itemId: id, source: '', target: '', wordCount: 0, wordIds: [], due: false, dueIds: [], staleness: '', slots: [], newWord: true });
  }
  return { entries, budgetOut: false };
}

/**
 * The word card was passed: the word is introduced (graded 'good' like the Learn tab's "Knew it", counted in today's budget there).
 * A word whose card already started (the Learn tab, or this step before a restart) is left as it is. Returns whether it was written.
 */
export async function introduceNewWord(db: Pick<DB, 'getPcicCard' | 'upsertPcicCard'>, itemId: string, today: string): Promise<boolean> {
  const card = await db.getPcicCard(itemId);
  if (card && card.state !== 'new') return false;
  await db.upsertPcicCard(sm2Review(card ?? sm2NewCard(itemId), 'good', today));
  return true;
}
