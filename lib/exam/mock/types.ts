// The practice exam data model. It continues the structure of the old (4afeb8c^)
// lib/exam/types.ts: papers (with their own clock), task kinds, no
// immediate feedback, per-skill points and the pass rule. The tasks are not built from hand-written
// JSON but from the level's words (lib/exam/mock/build.ts), the direction is given by `target`.
//
// Paper and skill are separate concepts: the paper is the unit of the clock (in the Spanish direction paper = skill, the
// English A1 written exam also contains listening, reading and writing, the English A2 reading + writing is one
// shared paper), the skill is the unit of scoring (every task belongs to one skill).

import type { PcicLevel, PcicTarget } from '@/data/pcic';
import { foldedTokens } from './writing';

export type MockTarget = PcicTarget;
export type MockLevel = Extract<PcicLevel, 'A1' | 'A2'>;
export type MockSkill = 'reading' | 'writing' | 'listening' | 'speaking';

export interface MockChoice {
  options: string[];
  correct: number;
}

interface MockTaskBase {
  id: string;
  /** Which skill's points the task counts into. */
  skill: MockSkill;
  instruction: string;
}

/** How many times recorded tasks can be played (default: twice; the first part of English A1: once). */
interface MockPlays {
  plays?: number;
}

export interface MockMatchTask extends MockTaskBase, MockPlays {
  kind: 'match' | 'listen_match';
  /** listen_match: the target-language sentences read aloud, in the order of `prompts`. */
  audio?: string[];
  /** match: the prompt text is the target-language sentence; listen_match: empty, the UI writes "Recording N". */
  prompts: { id: string; text: string }[];
  /** The source-language meanings (one more than the number of prompts). */
  options: { id: string; text: string }[];
  answer: Record<string, string>;
}

export interface MockReadMcTask extends MockTaskBase {
  kind: 'read_mc';
  /** A short target-language text + a question (the UI supplies the question text), the answers are in the source language. */
  passages: ({ text: string } & MockChoice)[];
}

export interface MockTrueFalseTask extends MockTaskBase {
  kind: 'true_false';
  text: string;
  statements: { s: string; answer: boolean }[];
}

export interface MockGapMcTask extends MockTaskBase {
  kind: 'gap_mc';
  /** A sentence with one `___` place and 3 answers (target-language words). */
  gaps: ({ text: string } & MockChoice)[];
}

/** Typed gap: a sentence with one `___` place, the missing word must be typed in (open gap filling). */
export interface MockGapTypeTask extends MockTaskBase, MockPlays {
  kind: 'gap_type';
  /** If present, the sentences are read aloud (note completion after listening), and the gapped text is on screen. */
  audio?: string[];
  /** `hint`: the first letter of the missing word (the UI shows it in the input field), so that the open gap has fewer correct solutions. */
  gaps: { text: string; answer: string; hint?: string }[];
}

/** Dictation: the recording must be written down verbatim (both listening and writing get a point). */
export interface MockDictationTask extends MockTaskBase, MockPlays {
  kind: 'dictation';
  audio: string[];
  /** The correct text (the read-aloud sentences one after another). */
  text: string;
}

export interface MockListenTask extends MockTaskBase, MockPlays {
  kind: 'listen_mc' | 'listen_dialogue';
  /** What the recording says; it is spoken with TTS in the target language. One question per line. */
  audio: string[];
  questions: MockChoice[];
}

export type MockFormCheck = 'fullname' | 'word' | 'address' | 'age' | 'phone' | 'email' | 'level';

/** What a form field must contain (lib/exam/mock/writing.ts checkField); by default an age for a number field, one word for a text field. */
export interface MockFormField {
  id: string;
  label: string;
  type: 'text' | 'number';
  check?: MockFormCheck;
}

export interface MockFormFillTask extends MockTaskBase {
  kind: 'form_fill';
  context: string;
  fields: MockFormField[];
}

export interface MockShortMessageTask extends MockTaskBase {
  kind: 'short_message';
  prompt: string;
  minWords: number;
  /** One content point = one mark; keywords are matched without case and accents. */
  points: { id: string; label: string; keywords: string[] }[];
}

export type MockTask =
  | MockMatchTask
  | MockReadMcTask
  | MockTrueFalseTask
  | MockGapMcTask
  | MockGapTypeTask
  | MockDictationTask
  | MockListenTask
  | MockFormFillTask
  | MockShortMessageTask;

export interface MockPaper {
  /** Stable id (the save records it): in Spanish the skill name, in English `written` / `readingwriting` / `listening` / `speaking`. */
  id: string;
  /** The paper's name in the target language. */
  name: string;
  minutes: number;
  /** The total points of the skills in the paper (25 per skill). */
  points: number;
  /** Speaking is a placeholder in this slice: it has no task and does not count. */
  placeholder: boolean;
  tasks: MockTask[];
}

export interface MockGroup {
  skills: MockSkill[];
  needed: number;
  of: number;
}

/**
 * The shape of the pass rule:
 * - groups: a threshold per group (the official Spanish A1 / A2: reading + writing, listening + speaking, all 30 / 50);
 * - total: a single total-score threshold, no per-skill minimum, the skills compensate each other (English A1);
 * - average: the equal-weight average of the four skills against a percentage threshold; the examiner does not
 *   publish the threshold, so it is an approximate value (English A2, lib/exam/mock/blueprint.ts AVERAGE_PASS_PCT).
 */
export type MockRule =
  | { kind: 'groups'; groups: MockGroup[] }
  | { kind: 'total'; needed: number; of: number }
  | { kind: 'average'; passPct: number; approximate: true };

export interface MockExam {
  target: MockTarget;
  level: MockLevel;
  seed: number;
  /** True if it follows the official structure (Spanish); false if it is based on an international sample (English): the UI labels it differently. */
  official: boolean;
  papers: MockPaper[];
  /** The names of the skills in the target language (for the bands of the result sheet). */
  skillNames: Record<MockSkill, string>;
  rule: MockRule;
}

/** What the learner gave for a task: the key is the item index or the prompt/field id. */
export type MockTaskAnswer = Record<string, string | number | boolean | null>;
export type MockAnswers = Record<string, MockTaskAnswer>;

/** The default number of plays of a recorded task. */
export const DEFAULT_PLAYS = 2;

/** How many scored marks there are in a task. */
export function mockTaskItemCount(task: MockTask): number {
  switch (task.kind) {
    case 'match':
    case 'listen_match':
      return task.prompts.length;
    case 'read_mc':
      return task.passages.length;
    case 'true_false':
      return task.statements.length;
    case 'gap_mc':
    case 'gap_type':
      return task.gaps.length;
    case 'listen_mc':
    case 'listen_dialogue':
      return task.questions.length;
    case 'dictation':
      return foldedTokens(task.text).length * 2; // every word is one listening and one writing mark
    case 'form_fill':
      return task.fields.length;
    case 'short_message':
      return task.points.length + 1; // content points + reaching the word count
  }
}
