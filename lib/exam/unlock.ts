// The
// level exam unlocks when at least 80% of the level's words-open cards are
// LEARNED, AND at least one grammar lesson of the level is done. Pure functions, no I/O;
// the caller supplies the cards and the lesson rows.

import { pcicItemsForLevel, type PcicLevel, type PcicTarget } from '@/data/pcic';
import { doneGrammarTopicProgress, hasLesson, syllabusForLevel, syllabusTopic } from '@/lib/grammar/syllabus';
import type { Sm2Card } from '@/lib/sm2';
import type { ExamResult } from './types';

export const EXAM_UNLOCK_PCT = 80;

/**
 * A "learned" word: a card that has graduated in SM-2, i.e. is in the `review` state, not
 * merely introduced (`learning`) and not new. The `known` mark (sm2MarkKnown) also puts
 * the card into `review`, so it is covered without special handling. A lapsed card
 * (back to `learning` after a lapse) is not learned until it graduates again; this is stricter
 * than isLearnedCard in lib/knownSentence.ts, which serves the sentence-card gate.
 */
export function isExamLearned(card: Sm2Card): boolean {
  return card.state === 'review';
}

export interface ExamUnlock {
  level: PcicLevel;
  /** Number of cards in the level. */
  total: number;
  /** Of these, learned. */
  learned: number;
  /** Number of learned words needed to unlock (80% of total, rounded up). */
  needed: number;
  /** How many more words are still missing (0 if enough). */
  missing: number;
  /** Whether the level has a finished grammar lesson. */
  lessonDone: boolean;
  unlocked: boolean;
}

export function examUnlock(level: PcicLevel, levelItemIds: string[], cards: Sm2Card[], lessonDone: boolean): ExamUnlock {
  const ids = new Set(levelItemIds);
  const total = ids.size;
  const learned = cards.filter((c) => ids.has(c.itemId) && isExamLearned(c)).length;
  const needed = Math.ceil((total * EXAM_UNLOCK_PCT) / 100);
  const missing = Math.max(0, needed - learned);
  return { level, total, learned, needed, missing, lessonDone, unlocked: total > 0 && missing === 0 && lessonDone };
}

/** Of the finished lessons, those that are in the given level's syllabus. */
export function doneLessonsOfLevel(level: PcicLevel, lang: string, doneTopicIds: Iterable<string>): string[] {
  return [...doneTopicIds].filter((id) => syllabusTopic(id, lang)?.level === level);
}

/**
 * Whether a lesson is written for the level in the given direction. If not (e.g. es→en B1), the exam could never unlock
 * (a finished lesson is required), so the level picker does not offer an exam row there.
 */
export function levelHasLesson(level: PcicLevel, lang: string): boolean {
  return syllabusForLevel(level, lang).some((topic) => hasLesson(lang, topic.id));
}

export type ExamLevelStatus = ExamUnlock & { result?: ExamResult };

/**
 * Data for the exam row of the level picker: the unlock state + the saved result.
 * The level's cards come from the loaded corpus (after `setPcicTarget`, that of the active direction).
 */
export function examStatusFor(
  level: PcicLevel,
  target: PcicTarget,
  cards: Sm2Card[],
  grammarRows: { itemId: string; state: string; data: unknown }[],
  result?: ExamResult,
): ExamLevelStatus {
  const doneTopics = doneGrammarTopicProgress(target, grammarRows).keys();
  const lessonDone = doneLessonsOfLevel(level, target, doneTopics).length > 0;
  const unlock = examUnlock(level, pcicItemsForLevel(level).map((i) => i.id), cards, lessonDone);
  return result ? { ...unlock, result } : unlock;
}
