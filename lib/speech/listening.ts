import greetings from '@/data/listening/greetings-es.json';
import greetingsEn from '@/data/listening/greetings-en.json';
import taxi from '@/data/listening/taxi-es.json';
import lo from '@/data/listening/lo-es.json';
import type { PcicTarget } from '@/data/pcic';
import { shuffleArray, shuffleNoFixedPoints } from '@/lib/shuffle';

// The "Greetings: listening" step of the Speak tab: a recording the learner listens to and a matching task (place <-> greeting).
// The content is data (data/listening/greetings-es.json, the pair count is not fixed); this file holds the type, the loader and the
// pure logic of the matching run (seeded shuffle, the reducer, the saved form). No I/O.

export interface ListeningPair {
  place: string;
  greeting: string;
}
export interface ListeningData {
  id: string;
  lang: string;
  level: string;
  /** The length of the recording in seconds (0 = not known). */
  durationSec: number;
  pairs: ListeningPair[];
  /** Multiple-choice comprehension questions (none = the item has only the matching). */
  questions?: ListeningQuestion[];
}
export interface ListeningQuestion {
  id: string;
  q: string;
  options: string[];
  /** The index of the right option in `options`. */
  answer: number;
}

export const GREETINGS: ListeningData = greetings;
export const GREETINGS_EN: ListeningData = greetingsEn;
export const TAXI: ListeningData = taxi;
export const LO: ListeningData = lo;

/** The listening items of a target language, in the order of the list (empty = that target has none). */
export function listeningItems(target: PcicTarget): ListeningData[] {
  return target === 'es' ? [GREETINGS, TAXI, LO] : target === 'en' ? [GREETINGS_EN] : [];
}

/** The title of a listening item (the greetings are the default). */
export function listenTitle(id: string, sx: { taxiTitle: string; loTitle: string; greetTitle: string }): string {
  return id === 'es-taxi' ? sx.taxiTitle : id === 'es-lo' ? sx.loTitle : sx.greetTitle;
}

/** The teaser of a listening item (the greetings are the default, English has its own). */
export function listenTeaser(
  id: string,
  target: PcicTarget,
  sx: { taxiTeaser: string; loTeaser: string; greetTeaser: string; greetTeaserEn: string },
): string {
  return id === 'es-taxi' ? sx.taxiTeaser : id === 'es-lo' ? sx.loTeaser : target === 'en' ? sx.greetTeaserEn : sx.greetTeaser;
}

/** The `game_progress` game of the finished listening steps (the item is the data id). */
export const LISTENING_PROGRESS_KEY = 'speech-listening';
export const LISTENING_RATE_KEY = 'speech-listen-rate';
export const LISTENING_RUN_KEY = 'speech-listen-run';
/** The resume key of the saved run per item (the two greetings keep their original keys, so saved runs still work). */
export const runKeyFor = (item: ListeningData): string =>
  item.id === 'es-greetings' ? LISTENING_RUN_KEY : item.id === 'en-greetings' ? `${LISTENING_RUN_KEY}-en` : `${LISTENING_RUN_KEY}-${item.id}`;
/** The resume key of the saved questions run of an item. */
export const quizKeyFor = (item: ListeningData): string => `speech-listen-quiz-${item.id}`;

export const RATES: readonly number[] = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5];
export const DEFAULT_RATE = 1;

export const parseRate = (x: unknown): number => (typeof x === 'number' && RATES.includes(x) ? x : DEFAULT_RATE);

/** m:ss of a number of seconds (negative and non-numbers are 0:00). */
export function clock(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The pair indexes in the order of the right column: seeded, and with more than one pair never every pair next to its place. */
export function rightOrder(n: number, seed: number): number[] {
  return shuffleNoFixedPoints(n, seed);
}

export interface MatchRun {
  seed: number;
  /** The pair indexes matched so far, in the order they were matched. */
  matched: number[];
  mistakes: number;
}

export const newRun = (seed: number): MatchRun => ({ seed, matched: [], mistakes: 0 });

/** Place `left` and greeting `right` (both pair indexes) tapped together: the same index is a match, anything else a mistake. */
export function pick(run: MatchRun, left: number, right: number): { run: MatchRun; correct: boolean } {
  if (run.matched.includes(left) || run.matched.includes(right)) return { run, correct: false };
  if (left === right) return { run: { ...run, matched: [...run.matched, left] }, correct: true };
  return { run: { ...run, mistakes: run.mistakes + 1 }, correct: false };
}

export const isComplete = (run: MatchRun, n: number): boolean => n > 0 && run.matched.length >= n;

export const serializeRun = (run: MatchRun): MatchRun => ({ seed: run.seed, matched: [...run.matched], mistakes: run.mistakes });

/** A saved run back, or null when it is not one of this data (wrong shape, an index out of range, a pair twice). */
export function parseRun(raw: unknown, n: number): MatchRun | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<MatchRun>;
  if (!Number.isInteger(r.seed) || !Number.isInteger(r.mistakes) || (r.mistakes as number) < 0 || !Array.isArray(r.matched)) return null;
  const ok = r.matched.every((i) => Number.isInteger(i) && i >= 0 && i < n) && new Set(r.matched).size === r.matched.length;
  return ok ? { seed: r.seed as number, matched: [...r.matched], mistakes: r.mistakes as number } : null;
}

export interface QuizRun {
  seed: number;
  /** Per question: the chosen option index (in the data `options`), -1 = not answered. */
  answers: number[];
  /** The XP the right answers of this run paid (kept with the run, so a re-entry shows the whole sum). */
  earned: number;
}

export const newQuiz = (count: number, seed: number): QuizRun => ({ seed, answers: Array.from({ length: count }, () => -1), earned: 0 });

/** The display order of the options of a question (indexes into `options`): seeded, stable for the same seed. */
export function optionOrder(questionIndex: number, optionCount: number, seed: number): number[] {
  return shuffleArray(Array.from({ length: optionCount }, (_, i) => i), seed + questionIndex * 7919);
}

/** The option `option` chosen for question `questionIndex`; an answered question or an index out of range changes nothing. */
export function answerQuiz(run: QuizRun, questionIndex: number, option: number): QuizRun {
  if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= run.answers.length) return run;
  if (!Number.isInteger(option) || option < 0 || run.answers[questionIndex] !== -1) return run;
  return { ...run, answers: run.answers.map((a, i) => (i === questionIndex ? option : a)) };
}

export const quizComplete = (run: QuizRun): boolean => run.answers.length > 0 && run.answers.every((a) => a >= 0);

/** How many questions are answered right. */
export const quizRight = (run: QuizRun, questions: readonly ListeningQuestion[]): number =>
  questions.filter((q, i) => run.answers[i] === q.answer).length;

export const serializeQuiz = (run: QuizRun): QuizRun => ({ seed: run.seed, answers: [...run.answers], earned: run.earned });

/** A saved questions run back, or null when it is not one of these questions (wrong shape, wrong length, an option out of range). */
export function parseQuiz(raw: unknown, questions: readonly ListeningQuestion[]): QuizRun | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<QuizRun>;
  if (!Number.isInteger(r.seed) || !Array.isArray(r.answers) || r.answers.length !== questions.length) return null;
  const ok = r.answers.every((a, i) => Number.isInteger(a) && a >= -1 && a < questions[i].options.length);
  const earned = typeof r.earned === 'number' && Number.isFinite(r.earned) && r.earned >= 0 ? r.earned : 0;
  return ok ? { seed: r.seed as number, answers: [...r.answers], earned } : null;
}

/** Every part the item has is finished: all pairs matched (if it has pairs) and all questions answered (if it has questions). */
export function itemComplete(item: ListeningData, matchRun: MatchRun, quizRun: QuizRun): boolean {
  const questions = item.questions ?? [];
  if (item.pairs.length === 0 && questions.length === 0) return false;
  return (item.pairs.length === 0 || isComplete(matchRun, item.pairs.length)) && (questions.length === 0 || quizComplete(quizRun));
}
