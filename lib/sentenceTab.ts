// The Sentences tab (spec HAROM-JATEK.md 3): which sentences are on offer, in which order, and what a
// typed sentence earns. Pure queue logic plus one DB step (recordTypedWords).
//
// Source = the example sentences of the corpus (what the Words tab's sentence cards used). The "never an
// unknown word in a sentence" gate is the existing one (lib/knownSentence.ts), only run once over a
// prebuilt token set instead of per sentence.

import type { PcicItem, PcicTarget } from '@/data/pcic';
import { isSentenceKnownIn, knownTokens, sentenceTokens, type ResolvedTense } from '@/lib/knownSentence';
import { recordCorrectHalf } from '@/lib/practice/halfXp';
import { recordPracticeResult } from '@/lib/practice/halfStep';
import { learnedEntryOf, sentencePair, tileWords } from '@/lib/sentenceCards';
import type { WordVerdict } from '@/lib/sentenceTyping';
import type { Sm2Card } from '@/lib/sm2';

/** How many sentences one round builds; then one other, shorter sentence is typed (lib/sentencePick.ts, lib/sentenceRound.ts). */
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
  /** The learned cards whose word the sentence uses: the typing is graded per card (lib/sentenceTyping.ts). */
  wordIds: string[];
  /** At least one of those words is due for review today. */
  due: boolean;
  /** The due ones among `wordIds`: a sentence with more of them is offered first. */
  dueIds: string[];
  /** The oldest last review (YYYY-MM-DD, '' = never) among the learned cards: older = less fresh = offered first. */
  staleness: string;
  /** Per learned card, the words of the sentence it owns (lowercase tokens): what the typed answer is matched on. */
  slots: Array<{ id: string; words: string[] }>;
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
  /** Card ids to practise now (the `focus` route parameter): sentences with more of them come first. */
  focus?: ReadonlySet<string>;
}

/** The same sentence under several items counts once: lowercase target text. */
export function sentenceKey(entry: Pick<SentenceEntry, 'target'>): string {
  return entry.target.trim().toLowerCase();
}

export function isDueCard(card: Sm2Card, today: string): boolean {
  return (card.state === 'review' || card.state === 'learning') && card.due !== '' && card.due <= today;
}

/**
 * Every sentence the learner may see: all its words learned (or free). Order: the most `focus` cards, then the
 * most due words, then the least fresh review, then fewer words (stable on the corpus order).
 */
export function buildSentenceQueue({ target, cards, tenses, items, findItem, today, done, focus }: SentenceQueueDeps): SentenceEntry[] {
  // The gate's token set, built once, plus which learned cards own which token (a half goes to the owners).
  const free = knownTokens(target, { learned: [], tenses });
  const known = new Set(free);
  const owners = new Map<string, string[]>();
  const dueIds = new Set<string>();
  const lastReviews = new Map<string, string>();
  for (const card of cards) {
    const entry = learnedEntryOf(card, target, findItem);
    if (!entry) continue;
    if (isDueCard(card, today)) dueIds.add(card.itemId);
    lastReviews.set(card.itemId, card.lastReview ?? '');
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
    const owned = new Map<string, string[]>();
    for (const tok of sentenceTokens(pair.target, target)) {
      for (const id of owners.get(tok) ?? []) {
        const words = owned.get(id);
        if (!words) owned.set(id, [tok]);
        else if (!words.includes(tok)) words.push(tok);
      }
    }
    const wordIds = [...owned.keys()];
    const due = wordIds.filter((id) => dueIds.has(id));
    out.push({
      itemId: item.id,
      source: pair.source,
      target: pair.target,
      wordCount: tileWords(pair.target).length,
      wordIds,
      due: due.length > 0,
      dueIds: due,
      staleness: wordIds.map((id) => lastReviews.get(id) ?? '').sort()[0] ?? '',
      slots: [...owned].map(([id, words]) => ({ id, words })),
    });
  }
  const focusHits = (e: SentenceEntry) => (focus ? e.wordIds.filter((id) => focus.has(id)).length : 0);
  return out
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        focusHits(b.entry) - focusHits(a.entry) ||
        b.entry.dueIds.length - a.entry.dueIds.length ||
        (a.entry.staleness < b.entry.staleness ? -1 : a.entry.staleness > b.entry.staleness ? 1 : 0) ||
        a.entry.wordCount - b.entry.wordCount ||
        a.index - b.index,
    )
    .map((x) => x.entry);
}

/** The queue after the head sentence was answered: right = gone, wrong = back at the end (spec 3.6). */
export function afterSentence(queue: readonly SentenceEntry[], correct: boolean): SentenceEntry[] {
  const [head, ...rest] = queue;
  if (!head) return [];
  return correct ? rest : [...rest, head];
}

/**
 * The typed sentence, word by word (spec 5.1, Kálmán 2026-10-12): a learned word typed right gets one half, even when
 * the rest of the sentence is wrong; a DUE word typed wrong (or missing) counts as a wrong typed answer. One result per
 * word however often it occurs. With `v2` (beta xpV2) each right half also earns its XP (lib/practice/halfXp.ts);
 * off = no XP, the old behavior. Returns how many words got a half / a wrong typed answer (a word with no card yet is skipped).
 */
export async function recordTypedWords(
  verdicts: readonly WordVerdict[],
  v2 = false,
  today?: string,
): Promise<{ right: number; wrong: number }> {
  let right = 0;
  let wrong = 0;
  const seen = new Set<string>();
  for (const v of verdicts) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    if (v.right) {
      if (await recordCorrectHalf(v.id, v2, today)) right++;
    } else if (v.due) {
      const outcome = today === undefined ? await recordPracticeResult(v.id, 'wrongTyped') : await recordPracticeResult(v.id, 'wrongTyped', today);
      if (outcome) wrong++;
    }
  }
  return { right, wrong };
}
