// Data model of the level exam. Of the old item kinds in
// lib/examBuilder.ts (4afeb8c^) only those the level exam needs are kept; every item
// comes from learned words or from finished level lessons, and carries its origin
// (itemId / topicId) so that later steps (wrong item back into SM-2, result per
// skill + lesson link) do not have to guess it from the item.

import type { PcicLevel } from '@/data/pcic';

/** The levels that have an exam (A1-B2, all under the same rule). */
export const EXAM_LEVELS: readonly PcicLevel[] = ['A1', 'A2', 'B1', 'B2'];

/** The skills on the result sheet; an item's `skill` decides which one it counts toward. */
export type ExamSkill = 'words' | 'grammar' | 'reading' | 'speaking';

export type ExamItem =
  // Word typing: the prompt is in the source language, the answer in the target language (direction-dependent).
  | { kind: 'word_type'; skill: 'words'; itemId: string; prompt: string; hint?: string; answer: string }
  // Matching: left = target-language word, right = source-language meaning.
  | { kind: 'match'; skill: 'words'; itemIds: string[]; pairs: { left: string; right: string }[] }
  // Sentence building: the prompt is the source-language sentence, the tiles are target-language.
  // `sentence` is the original target-language sentence (capitalised, with punctuation): shown after a wrong answer.
  | { kind: 'sent_order'; skill: 'words'; itemId: string; prompt: string; answerTokens: string[]; sentence: string; distractors: string[] }
  // Sentence typing: the prompt is the source-language sentence, the answer is the target-language one.
  | { kind: 'sent_type'; skill: 'words'; itemId: string; prompt: string; answer: string }
  // Grammar: a gap sentence with 3 options, taken from the items of a finished level lesson.
  | { kind: 'gap_mc'; skill: 'grammar'; topicId: string; sentence: string; options: string[]; correctIndex: number }
  // Reading: a target-language text made of two learned sentences; the source-language meaning must be chosen.
  | { kind: 'reading_mc'; skill: 'reading'; itemIds: string[]; text: string; options: string[]; correctIndex: number }
  // Speaking: a sentence dictated with the keyboard's microphone. `translate`: the prompt is the
  // source-language sentence and `expected` is the target-language one; `repeat`: the prompt is the target-language sentence itself (read it aloud).
  | { kind: 'speak'; skill: 'speaking'; itemId: string; prompt: string; expected: string; mode: 'translate' | 'repeat' };

/** An answered item: later steps (back into SM-2, per-skill sheet) work from this. */
export interface ExamItemResult {
  item: ExamItem;
  correct: boolean;
}

/** The saved result of one level (game_progress, `level-exam` game, itemId = the level). */
export interface ExamResult {
  /** Whether it has been passed at least once (a retry does not take this away). */
  passed: boolean;
  /** The best score, whole percent. */
  best: number;
  /** The day of the best score, YYYY-MM-DD. */
  bestAt: string;
  /** The score of the latest attempt, whole percent. */
  last: number;
  /** The day of the latest attempt, YYYY-MM-DD. */
  lastAt: string;
}

export type ExamResults = Record<string, ExamResult>;
