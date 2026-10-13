// The Sentences tab (spec HAROM-JATEK.md 3): which sentences are on offer, in which order, and what a
// correct sentence earns. Pure queue logic plus one DB step (recordSentenceHalves).
//
// Source = the example sentences of the corpus (what the Words tab's sentence cards used). The "never an
// unknown word in a sentence" gate is the existing one (lib/knownSentence.ts), only run once over a
// prebuilt token set instead of per sentence.

import type { PcicItem, PcicTarget } from '@/data/pcic';
import { isSentenceKnownIn, knownTokens, sentenceTokens, type ResolvedTense } from '@/lib/knownSentence';
import { recordCorrectHalf } from '@/lib/practice/halfXp';
import { learnedEntryOf, sentencePair, tileWords } from '@/lib/sentenceCards';
import type { Sm2Card } from '@/lib/sm2';

/** How many sentences one round holds: all are built, then one of them is typed (lib/sentenceRound.ts). */
export const SENTENCE_ROUND_SIZE = 4;

export interface SentenceEntry {
  /** The item whose example sentence this is. */
  itemId: string;
  /** The prompt, in the source language. */
  source: string;
  /** The sentence to build and type, in the target language. */
  target: string;
  /** Number of tiles (difficulty for now, spec 3.3: tense and structure come later). */
  wordCount: number;
  /** The learned cards whose word the sentence uses: each gets one half when the sentence is right. */
  wordIds: string[];
  /** At least one of those words is due for review today. */
  due: boolean;
}

export interface SentenceQueueDeps {
  target: PcicTarget;
  cards: Iterable<Sm2Card>;
  tenses?: ReadonlySet<ResolvedTense>;
  items: Iterable<PcicItem>;
  findItem: (id: string) => PcicItem | undefined;
  today: string;
  /** Sentences already done (by sentenceKey), left out. */
  done?: ReadonlySet<string>;
}

/** The same sentence under several items counts once: lowercase target text. */
export function sentenceKey(entry: Pick<SentenceEntry, 'target'>): string {
  return entry.target.trim().toLowerCase();
}

export function isDueCard(card: Sm2Card, today: string): boolean {
  return (card.state === 'review' || card.state === 'learning') && card.due !== '' && card.due <= today;
}

/**
 * Every sentence the learner may see: all its words learned (or free), due-word sentences first,
 * then fewer words first (stable on the corpus order).
 */
export function buildSentenceQueue({ target, cards, tenses, items, findItem, today, done }: SentenceQueueDeps): SentenceEntry[] {
  // The gate's token set, built once, plus which learned cards own which token (a half goes to the owners).
  const free = knownTokens(target, { learned: [], tenses });
  const known = new Set(free);
  const owners = new Map<string, string[]>();
  const dueIds = new Set<string>();
  for (const card of cards) {
    const entry = learnedEntryOf(card, target, findItem);
    if (!entry) continue;
    if (isDueCard(card, today)) dueIds.add(card.itemId);
    const own = knownTokens(target, { learned: [entry], tenses });
    // A card made only of free words ("de") owns them; otherwise ("el libro") the free words are nobody's.
    const hasOwnToken = [...own].some((tok) => !free.has(tok));
    for (const tok of own) {
      known.add(tok);
      if (hasOwnToken && free.has(tok)) continue;
      const list = owners.get(tok);
      if (list) list.push(card.itemId);
      else owners.set(tok, [card.itemId]);
    }
  }

  const seen = new Set<string>();
  const out: SentenceEntry[] = [];
  for (const item of items) {
    const pair = sentencePair(item, target);
    if (!pair) continue;
    const key = sentenceKey(pair);
    if (seen.has(key) || done?.has(key)) continue;
    seen.add(key);
    if (!isSentenceKnownIn(pair.target, target, known)) continue;
    const ids = new Set<string>();
    for (const tok of sentenceTokens(pair.target, target)) for (const id of owners.get(tok) ?? []) ids.add(id);
    const wordIds = [...ids];
    out.push({
      itemId: item.id,
      source: pair.source,
      target: pair.target,
      wordCount: tileWords(pair.target).length,
      wordIds,
      due: wordIds.some((id) => dueIds.has(id)),
    });
  }
  return out
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => Number(b.entry.due) - Number(a.entry.due) || a.entry.wordCount - b.entry.wordCount || a.index - b.index)
    .map((x) => x.entry);
}

/** The queue after the head sentence was answered: right = gone, wrong = back at the end (spec 3.6). */
export function afterSentence(queue: readonly SentenceEntry[], correct: boolean): SentenceEntry[] {
  const [head, ...rest] = queue;
  if (!head) return [];
  return correct ? rest : [...rest, head];
}

/**
 * A correct sentence: each learned word in it gets one half (spec 5.1), once per word however often
 * it occurs. Returns how many words had a card that took the half. With `v2` (beta xpV2) each
 * half also earns its XP (lib/practice/halfXp.ts), one half per word; off = no XP, the old behavior.
 */
export async function recordSentenceHalves(wordIds: readonly string[], today?: string, v2 = false): Promise<number> {
  let n = 0;
  for (const id of wordIds) {
    if (await recordCorrectHalf(id, v2, today)) n++;
  }
  return n;
}
