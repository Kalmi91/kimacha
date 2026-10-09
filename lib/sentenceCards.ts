// Cadence of the sentence card and the sentence choice in the
// deck run. A pure module: the deck screen (app/(tabs)/index.tsx) supplies
// the cards, the lookup and the vocabulary list, there is no state and no
// database here. The result of the card does not write SRS: practice only.

import type { PcicItem, PcicTarget } from '@/data/pcic';
import { nearMissDistractors } from '@/lib/distractors';
import { isLearnedCard, isSentenceKnown, type LearnedEntry, type ResolvedTense } from '@/lib/knownSentence';
import { posOf } from '@/lib/pcicPos';
import type { Sm2Card } from '@/lib/sm2';

/** After this many NEW words comes a sentence card (review cards do not count). */
export const NEW_WORDS_PER_SENTENCE = 4;

export type SentenceKind = 'tiles' | 'typing';

export interface CadenceState {
  /** The ids of the latest new words that have not yet received a sentence (the counter). */
  recent: string[];
  /** The kind of the next sentence card; it only switches when a card appeared. */
  next: SentenceKind;
}

export const INITIAL_CADENCE: CadenceState = { recent: [], next: 'tiles' };

export type SentenceCardData =
  | { kind: 'tiles'; itemId: string; source: string; target: string; targetWords: string[]; trapWords: string[] }
  | { kind: 'typing'; itemId: string; source: string; target: string };

export interface SentenceDeps {
  target: PcicTarget;
  /** Every card of the deck, including the one just rated (the "learned" gate is built from it). */
  cards: Iterable<Sm2Card>;
  /** The tenses unlocked by the grammar lessons (only matters with Spanish as the target language). */
  tenses?: ReadonlySet<ResolvedTense>;
  findItem: (id: string) => PcicItem | undefined;
  /** Source of the trap tiles: the target-language words of the current level. */
  vocab: () => string[];
}

/** From the learned cards, the vocabulary of the gate: target-language form + part of speech. */
export function learnedEntries(
  cards: Iterable<Sm2Card>,
  target: PcicTarget,
  findItem: (id: string) => PcicItem | undefined,
): LearnedEntry[] {
  const out: LearnedEntry[] = [];
  for (const card of cards) {
    if (!isLearnedCard(card)) continue;
    const item = findItem(card.itemId);
    if (!item) continue;
    out.push({
      text: target === 'es' ? item.es : item.en,
      pos: item.pos ?? (target === 'es' ? posOf(item)?.pos : undefined),
    });
  }
  return out;
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

function sentencePair(item: PcicItem, target: PcicTarget): { source: string; target: string } | null {
  const targetSentence = (target === 'es' ? item.exampleEs : item.exampleEn)?.trim();
  const sourceSentence = (target === 'es' ? item.exampleEn : item.exampleEs)?.trim();
  if (!targetSentence || !sourceSentence) return null;
  return { source: sourceSentence, target: targetSentence };
}

/**
 * The cadence advances after a new word is rated: at the NEW_WORDS_PER_SENTENCE-th new
 * word, the first of the group's own example sentences that passes the
 * "learned words only" gate becomes a sentence card. If none passes, there is no card,
 * the counter resets, and it tries again at the next group.
 */
export function nextSentenceStep(
  state: CadenceState,
  newItemId: string,
  deps: SentenceDeps,
): { state: CadenceState; card: SentenceCardData | null } {
  const recent = [...state.recent, newItemId];
  if (recent.length < NEW_WORDS_PER_SENTENCE) return { state: { ...state, recent }, card: null };

  const ctx = { learned: learnedEntries(deps.cards, deps.target, deps.findItem), tenses: deps.tenses };
  for (const id of recent) {
    const item = deps.findItem(id);
    const pair = item ? sentencePair(item, deps.target) : null;
    if (!pair || !isSentenceKnown(pair.target, deps.target, ctx)) continue;
    const other: SentenceKind = state.next === 'tiles' ? 'typing' : 'tiles';
    if (state.next === 'typing') {
      return { state: { recent: [], next: other }, card: { kind: 'typing', itemId: id, ...pair } };
    }
    const targetWords = tileWords(pair.target);
    const trapWords = nearMissDistractors(targetWords, deps.vocab().map((w) => w.split(' / ')[0]), deps.target);
    return {
      state: { recent: [], next: other },
      card: { kind: 'tiles', itemId: id, ...pair, targetWords, trapWords },
    };
  }
  return { state: { recent: [], next: state.next }, card: null };
}
