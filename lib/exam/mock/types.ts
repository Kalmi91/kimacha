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

// The practice exam has Spanish and English papers only; target hu has no exam (its entry points are hidden).
export type MockTarget = Exclude<PcicTarget, 'hu'>;
export type MockLevel = PcicLevel;
/** `use` = Use of English: its own skill in the English B2 / C1 exams (the examiner scores it apart from reading). */
export type MockSkill = 'reading' | 'writing' | 'listening' | 'speaking' | 'use';
/** The skill names in the target language; `use` is there only in the exams that have a Use of English part. */
export type MockSkillNames = Record<Exclude<MockSkill, 'use'>, string> & Partial<Record<'use', string>>;

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

/** Marks per item (default 1): the weight of the task's items in the skill's raw score. */
interface MockMarks {
  marks?: number;
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

// --- The authored kinds of B1-C1 (data/exams/mock/*.json, schema: lib/exam/mock/authored.ts). The answer key of the
// learner (MockTaskAnswer): passage_mc / clips_mc / cloze / transform: the item index (clips_mc: counted across the clips,
// cloze: gap index = `{{n}}` minus one) -> the chosen option index or the typed text; match_pool: prompt id -> option id;
// gapped_text: gap number ("1".) -> fragment id; pick_statements: statement index -> true; essay: `choice` = choice id, `text`;
// speaking: `choice` = choice id, `<turn id>` = the text of the turn, `notes` = the preparation notes (not scored).

/** A recorded line; the speaker gives the pitch of the voice (m: deep, f: high, n: neutral). */
export interface MockAudioLine {
  speaker?: 'm' | 'f' | 'n';
  text: string;
}

export interface MockMcQuestion {
  stem: string;
  options: string[];
  correct: number;
}

/** A text (`text`: read) or a recording (`audio`: heard) with multiple-choice questions. */
export interface MockPassageMcTask extends MockTaskBase, MockPlays, MockMarks {
  kind: 'passage_mc';
  title?: string;
  text?: string;
  audio?: MockAudioLine[];
  questions: MockMcQuestion[];
}

/** Several short texts or recordings, each with its own questions. */
export interface MockClipsMcTask extends MockTaskBase, MockPlays, MockMarks {
  kind: 'clips_mc';
  clips: { text?: string; audio?: MockAudioLine[]; questions: MockMcQuestion[] }[];
}

/** Prompts matched to a pool of options; `unique`: every option can be used once at most. */
export interface MockMatchPoolTask extends MockTaskBase, MockPlays, MockMarks {
  kind: 'match_pool';
  prompts: { id: string; text?: string; audio?: MockAudioLine[] }[];
  options: { id: string; title?: string; text: string }[];
  answer: Record<string, string>;
  unique: boolean;
}

/** A text with `{{1}}`..`{{n}}` gaps and fragments (gaps + extra) to put back; the answer maps the gap number to a fragment id. */
export interface MockGappedTextTask extends MockTaskBase, MockPlays, MockMarks {
  kind: 'gapped_text';
  title?: string;
  text: string;
  fragments: { id: string; text: string }[];
  answer: Record<string, string>;
}

/** A text with `{{n}}` gaps: gaps[i] is `{{i+1}}`, a multiple-choice gap or an open one (`answers`: the accepted words, `stem`: the word to transform). */
export interface MockClozeTask extends MockTaskBase, MockPlays, MockMarks {
  kind: 'cloze';
  title?: string;
  text: string;
  audio?: MockAudioLine[];
  gaps: ({ options: string[]; correct: number } | { answers: string[]; stem?: string })[];
}

/** Statements to pick: `pick` of them are right (`correct` = their indices). */
export interface MockPickStatementsTask extends MockTaskBase, MockPlays, MockMarks {
  kind: 'pick_statements';
  text?: string;
  audio?: MockAudioLine[];
  statements: string[];
  correct: number[];
  pick: number;
}

/** Key word transformation: `first` + `key`, then `before ___ after`; `answers` are all the accepted fillings of the gap. */
export interface MockTransformTask extends MockTaskBase, MockPlays, MockMarks {
  kind: 'transform';
  items: { first: string; key: string; before: string; after: string; answers: string[] }[];
}

/** An extended writing task: 1 choice = compulsory, 2-3 = pick one. `input` is the written, `audio` the heard prompt. */
export interface MockEssayTask extends MockTaskBase, MockPlays, MockMarks {
  kind: 'essay';
  choices: {
    id: string;
    title: string;
    prompt: string;
    input?: string;
    audio?: MockAudioLine[];
    minWords: number;
    maxWords: number;
    /** One content point = one mark, matched by keywords like the short message. */
    points: { id: string; label: string; keywords: string[] }[];
  }[];
}

/** One examiner turn of a speaking task and what a good answer contains. */
export interface MockSpeakingTurn {
  /** 't1', 't2', ...: unique within the choice (the answer key of the learner's text). */
  id: string;
  /** What the examiner says: shown and read aloud (target language, neutral voice). */
  ask: string;
  /** From this many words on the word-count mark is given. */
  minWords: number;
  /** Content points, one mark each, matched by keywords like the essay; may be empty (then only the word count counts). */
  points: { id: string; label: string; keywords: string[] }[];
  /** A model answer for the review: it reaches `minWords` and gets EVERY point (checked by scripts/mock-exam-check.mjs). */
  model: string;
}

export interface MockSpeakingChoice {
  /** 'a', 'b', 'c'. */
  id: string;
  title: string;
  /** The task sheet: the situation, what to talk about (target language). */
  prompt: string;
  /** The guiding points on the sheet. */
  bullets?: string[];
  /** A written stimulus: an article, a survey, proposals, the options of a decision. */
  input?: string;
  /** Photo keys (data/exams/mock/photos.json): one to describe, two to compare, three if two are to be picked. */
  photos?: string[];
  turns: MockSpeakingTurn[];
}

/**
 * An individual speaking task: the app plays the examiner turn by turn, the learner answers in writing (typed or dictated with
 * the keyboard's microphone), the answers are scored by keywords + word count per turn (lib/exam/mock/score.ts).
 * The learner's answer: `choice` = the picked choice id, `<turn id>` = the text of the turn, `notes` = the preparation notes (not scored).
 */
export interface MockSpeakingTask extends MockTaskBase, MockMarks {
  kind: 'speaking';
  /** Preparation time in seconds (none/0: no preparation); it can be skipped, the paper's clock stands still meanwhile. */
  prepSeconds?: number;
  /** The recommended speaking time in minutes, e.g. [2, 3] (the sheet shows it). */
  talkMinutes: [number, number];
  /** The 1-based ordinal of an earlier task of the paper whose choice this one continues (the same choice ids, no picker). */
  follows?: number;
  choices: MockSpeakingChoice[];
}

/** The kinds that come from the authored files. */
export type MockAuthoredKindTask =
  | MockPassageMcTask
  | MockClipsMcTask
  | MockMatchPoolTask
  | MockGappedTextTask
  | MockClozeTask
  | MockPickStatementsTask
  | MockTransformTask
  | MockEssayTask
  | MockSpeakingTask;

export type MockTask =
  | MockMatchTask
  | MockReadMcTask
  | MockTrueFalseTask
  | MockGapMcTask
  | MockGapTypeTask
  | MockDictationTask
  | MockListenTask
  | MockFormFillTask
  | MockShortMessageTask
  | MockAuthoredKindTask;

const AUTHORED_KINDS: readonly string[] = ['passage_mc', 'clips_mc', 'match_pool', 'gapped_text', 'cloze', 'pick_statements', 'transform', 'essay', 'speaking'];

export function isAuthoredKindTask(task: MockTask): task is MockAuthoredKindTask {
  return AUTHORED_KINDS.includes(task.kind);
}

export interface MockPaper {
  /** Stable id (the save records it): in Spanish the skill name, in English `written` / `readingwriting` / `listening` / `speaking`. */
  id: string;
  /** The paper's name in the target language. */
  name: string;
  minutes: number;
  /** The total points of the skills in the paper (25 per skill). */
  points: number;
  /** Reserve: a speaking paper with no task (its file is missing or empty) is a placeholder and does not count; one with tasks is scored like the others. */
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
 *   publish the threshold, so it is an approximate value (English A2, lib/exam/mock/blueprint.ts AVERAGE_PASS_PCT);
 * - scale: per skill the raw score is converted to a scale score along `anchors` ([raw, scale] pairs of the examiner's
 *   practice conversion, linear in between), the average of the scale scores is compared with `needed` (English B1 / B2 / C1).
 *   `officialMax` is the skill's maximum raw score on the real paper; the speaking has an entry too (it counts once it has a task).
 */
export type MockRule =
  | { kind: 'groups'; groups: MockGroup[] }
  | { kind: 'total'; needed: number; of: number }
  | { kind: 'average'; passPct: number; approximate: true }
  | { kind: 'scale'; needed: number; approximate: true; skills: Partial<Record<MockSkill, { officialMax: number; anchors: [raw: number, scale: number][] }>> };

export interface MockExam {
  target: MockTarget;
  level: MockLevel;
  seed: number;
  /** True if it follows the official structure (Spanish); false if it is based on an international sample (English): the UI labels it differently. */
  official: boolean;
  papers: MockPaper[];
  /** The names of the skills in the target language (for the bands of the result sheet). */
  skillNames: MockSkillNames;
  rule: MockRule;
}

/** A paper's authored content file (data/exams/mock/<target>-<level>-<paper>.json): one or more forms, the seed picks one. */
export interface AuthoredPaperFile {
  target: MockTarget;
  /** B1-C1: every paper; A1 / A2: only the speaking paper (the rest is built from the words). */
  level: MockLevel;
  /** The blueprint paper id (lib/exam/mock/blueprint.ts). */
  paper: string;
  forms: { id: string; tasks: AuthoredTask[] }[];
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A task as written in the files: a Mock task without the id (the builder numbers them); a speaking task has the skill `speaking`, the others any other. */
export type AuthoredTask =
  | (DistributiveOmit<Exclude<MockAuthoredKindTask, MockSpeakingTask>, 'id' | 'skill'> & { skill: Exclude<MockSkill, 'speaking'> })
  | (Omit<MockSpeakingTask, 'id' | 'skill'> & { skill: 'speaking' });

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
    case 'passage_mc':
      return task.questions.length;
    case 'clips_mc':
      return task.clips.reduce((n, c) => n + c.questions.length, 0);
    case 'match_pool':
      return task.prompts.length;
    case 'gapped_text':
      return Object.keys(task.answer).length;
    case 'cloze':
      return task.gaps.length;
    case 'pick_statements':
      return task.pick;
    case 'transform':
      return task.items.length;
    case 'essay':
      return Math.max(0, ...task.choices.map((c) => c.points.length)) + 1; // content points + reaching the word count
    case 'speaking':
      // Per turn: the content points + reaching the word count; the longest choice (the picked one is scored).
      return Math.max(0, ...task.choices.map((c) => c.turns.reduce((n, t) => n + t.points.length + 1, 0)));
  }
}

/** The raw marks of a task: its items x the marks per item (default 1). */
export function mockTaskMarks(task: MockTask): number {
  return mockTaskItemCount(task) * ('marks' in task && typeof task.marks === 'number' ? task.marks : 1);
}
