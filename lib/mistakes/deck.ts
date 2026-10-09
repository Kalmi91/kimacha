// Pure functions that build a card list from the loaded
// batches (MistakesBatch[]), and run the SM-2 scheduler
// (lib/sm2.ts, the same as on the PCIC tab) on the "Hibáim" ("My mistakes") deck's
// own table.

import type { MistakesBatch, MistakePattern } from './format';
import { DEFAULT_NEW_LIMIT, pickSm2Session, type Sm2Card } from '../sm2';
import { strictAnswerMatch, type MatchOptions } from '../answerMatch';

/** Shape of a `mistake_batches` row, in both native and web DB. */
export interface MistakeBatchRow {
  batchId: string;
  json: string;
  importedAt: string;
}

export type MistakeCardKind = 'sentence' | 'word' | 'drill';

export interface MistakeCard {
  /** SM-2 itemId, also the deck card's identifier. */
  cardId: string;
  kind: MistakeCardKind;
  batchId: string;
  /** The big text at the top of the card (sentence/word: en; drill: prompt). */
  prompt: string;
  /** For a drill, small under the prompt (en); none for a sentence/word. */
  promptEn?: string;
  /** The correct Spanish form to be typed. */
  answer: string;
  /** Sentence only: the faulty sentence written long ago, under "You said:". */
  wrong?: string;
  /** The pattern's rule in one line (sentence and drill, if it has a pattern). */
  patternRule?: string;
}

/** Index of pattern id -> MistakePattern, so the sentence/drill can resolve its rule. */
function patternIndex(batch: MistakesBatch): Map<string, MistakePattern> {
  return new Map(batch.patterns.map((p) => [p.id, p]));
}

/**
 * The cards of one batch, in file order. A `doubtful: true` sentence is left out (the
 * report lists it with ⚠, but it does not go into the deck).
 */
export function cardsForBatch(batch: MistakesBatch): MistakeCard[] {
  const patterns = patternIndex(batch);
  const cards: MistakeCard[] = [];

  for (const s of batch.sentences) {
    if (s.doubtful) continue;
    const pattern = s.pattern ? patterns.get(s.pattern) : undefined;
    cards.push({
      cardId: `${batch.batchId}:s:${s.id}`,
      kind: 'sentence',
      batchId: batch.batchId,
      prompt: s.en,
      answer: s.es,
      wrong: s.wrong,
      patternRule: pattern?.rule,
    });
  }

  for (const w of batch.words) {
    cards.push({
      cardId: `${batch.batchId}:w:${w.id}`,
      kind: 'word',
      batchId: batch.batchId,
      prompt: w.en,
      answer: w.es,
    });
  }

  for (const p of batch.patterns) {
    for (const d of p.drills) {
      cards.push({
        cardId: `${batch.batchId}:d:${p.id}:${d.id}`,
        kind: 'drill',
        batchId: batch.batchId,
        prompt: d.prompt,
        promptEn: d.en,
        answer: d.answer,
        patternRule: p.rule,
      });
    }
  }

  return cards;
}

/** The cards of several (currently loaded) batches one after another, in file order within each batch. */
export function cardsForBatches(batches: MistakesBatch[]): MistakeCard[] {
  return batches.flatMap(cardsForBatch);
}

/**
 * Today's session: every due card (review/learning, due <= today) + at most
 * `newLimit` new cards, with the scheduler of `lib/sm2.ts` (the same as on the PCIC tab).
 */
export function pickMistakeSession(
  progress: Sm2Card[],
  cards: MistakeCard[],
  today: string,
  newLimit: number = DEFAULT_NEW_LIMIT
): Sm2Card[] {
  const order = cards.map((c) => c.cardId);
  return pickSm2Session(progress, order, today, newLimit);
}

/**
 * Pre-selected grading: on an exact match (`strictAnswerMatch`)
 * "Knew it" (good), otherwise "Didn't know" (again).
 */
export function suggestedMistakeGrade(typed: string, answer: string, opts: MatchOptions = {}): 'again' | 'good' {
  return typed.trim().length > 0 && strictAnswerMatch(typed, answer, opts) ? 'good' : 'again';
}
