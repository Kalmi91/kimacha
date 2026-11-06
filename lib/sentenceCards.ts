// Shared sentence vocabulary, language gates and tile helpers.

import type { PcicItem, PcicTarget } from '@/data/pcic';
import { asDeLevel, deLevelRank, minDeLevel, type DeLevel } from '@/lib/deForms';
import { isLearnedCard, type LearnedEntry } from '@/lib/knownSentence';
import { posOf } from '@/lib/pcicPos';
import { activeSourceFor } from '@/lib/languagePair';
import { exampleIn, wordIn } from '@/lib/pcicItemText';
import type { Sm2Card } from '@/lib/sm2';

/**
 * German: the grammar level the learner has reached = the highest deck level among the learned cards (A1 at least). Tenses
 * and structures above it are never offered (lib/grammar/deTenseGate.ts); a sentence is further held to the level of its own item.
 */
export function learnerLevel(cards: Iterable<Sm2Card>, levelOf?: (id: string) => string | undefined): DeLevel {
  let best: DeLevel = 'A1';
  for (const card of cards) {
    if (!isLearnedCard(card)) continue;
    const level = asDeLevel(levelOf?.(card.itemId));
    if (level && deLevelRank(level) > deLevelRank(best)) best = level;
  }
  return best;
}

/** The level a sentence of `itemId` is held to: the learner's, and no higher than its own item's. */
export function sentenceLevel(learner: DeLevel, itemId: string, levelOf?: (id: string) => string | undefined): DeLevel {
  const own = asDeLevel(levelOf?.(itemId));
  return own ? minDeLevel(learner, own) : learner;
}

/** From the learned cards, the vocabulary of the gate: target-language form + part of speech. */
export function learnedEntries(
  cards: Iterable<Sm2Card>,
  target: PcicTarget,
  findItem: (id: string) => PcicItem | undefined,
): LearnedEntry[] {
  const out: LearnedEntry[] = [];
  for (const card of cards) {
    const entry = learnedEntryOf(card, target, findItem);
    if (entry) out.push(entry);
  }
  return out;
}

/** The gate entry of one card, or null if the card is not learned (or its item is gone from the corpus). */
export function learnedEntryOf(
  card: Sm2Card,
  target: PcicTarget,
  findItem: (id: string) => PcicItem | undefined,
): LearnedEntry | null {
  if (!isLearnedCard(card)) return null;
  const item = findItem(card.itemId);
  if (!item) return null;
  return {
    text: wordIn(item, target) ?? '',
    pos: item.pos ?? (target === 'es' ? posOf(item)?.pos : undefined),
  };
}

const SENTENCE_PUNCT = /[.!?¡¿,;:]/g;

/** The sentence without punctuation, with single spaces (the common form of the assemble and the type-in card). */
export function stripSentencePunct(sentence: string): string {
  return sentence.replace(SENTENCE_PUNCT, '').replace(/\s+/g, ' ').trim();
}

/**
 * The tiles: the words of the sentence without punctuation, the first one lowercased (a capital
 * initial would give away which tile comes first; grading is case-insensitive).
 */
export function tileWords(sentence: string): string[] {
  return sentence
    .replace(SENTENCE_PUNCT, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w));
}

export function sentencePair(item: PcicItem, target: PcicTarget): { source: string; target: string } | null {
  const targetSentence = exampleIn(item, target)?.trim();
  const sourceSentence = exampleIn(item, activeSourceFor(target))?.trim();
  if (!targetSentence || !sourceSentence) return null;
  return { source: sourceSentence, target: targetSentence };
}
