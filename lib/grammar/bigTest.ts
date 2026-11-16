import type { DB } from '@/lib/database';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';

// The grammar Big test (placement test): 45 four-option questions, 9 per level from A1 to C1. It measures and does not
// teach, so there is no explanation. It moves level by level: under BIG_TEST_PASS right out of 9 the test ends and the
// level of the result is the first level that was not passed. Everything here is pure (no React); the screen is
// app/grammar/big-test.tsx. The run and the last result live only in the resume store: this slice writes no grammar
// evidence and moves no level percent, because a placement test must not change what the lessons show.

export type BigTestLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export type BigTestItem =
  | { id: string; level: BigTestLevel; topic: string; kind: 'gap'; lines: string[]; options: string[]; correct: number; why: string }
  | { id: string; level: BigTestLevel; topic: string; kind: 'which'; lines: [string, string]; correct: number; why: string }
  | { id: string; level: BigTestLevel; topic: string; kind: 'register'; options: string[]; correct: number; why: string };

export const BIG_TEST_LEVELS: BigTestLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
export const BIG_TEST_PER_LEVEL = 9;
export const BIG_TEST_PASS = 6;
export const BIG_TEST_TOTAL = BIG_TEST_LEVELS.length * BIG_TEST_PER_LEVEL;

interface BigTestData {
  lang: string;
  version: number;
  items: BigTestItem[];
}

// One line per language with a data file; Metro needs the require path to be a literal, hence the map of loaders.
const LOADERS: Record<string, () => BigTestData> = {
  es: () => require('@/data/grammar/big-test/es.json'),
};

export function hasBigTest(learnedLang: string): boolean {
  return Object.prototype.hasOwnProperty.call(LOADERS, learnedLang);
}

const cache = new Map<string, BigTestItem[]>();
function allItems(learnedLang: string): BigTestItem[] {
  if (!hasBigTest(learnedLang)) return [];
  let items = cache.get(learnedLang);
  if (!items) {
    items = LOADERS[learnedLang]().items;
    cache.set(learnedLang, items);
  }
  return items;
}

/** The 9 items of one level, in file order. */
export function bigTestItems(learnedLang: string, level: BigTestLevel): BigTestItem[] {
  return allItems(learnedLang).filter((it) => it.level === level);
}

export type BigTestPhase = 'question' | 'answered' | 'levelEnd' | 'result';

export interface BigTestAnswer {
  itemId: string;
  level: BigTestLevel;
  topic: string;
  /** null = "I don't know". */
  picked: number | null;
  right: boolean;
  mistyped?: boolean;
}

export interface BigTestRun {
  v: 1;
  levelIdx: number;
  pos: number;
  phase: BigTestPhase;
  answers: BigTestAnswer[];
}

export const newBigTestRun = (): BigTestRun => ({ v: 1, levelIdx: 0, pos: 0, phase: 'question', answers: [] });

/** Records the answer of the current question; "I don't know" (null) counts as wrong. */
export function answerBigTest(run: BigTestRun, item: BigTestItem, picked: number | null): BigTestRun {
  if (run.phase !== 'question') return run;
  const answer: BigTestAnswer = { itemId: item.id, level: item.level, topic: item.topic, picked, right: picked === item.correct };
  return { ...run, phase: 'answered', answers: [...run.answers, answer] };
}

/** "I mistyped": flips the last answer to right, only when it was a wrong pick (not "I don't know"). */
export function markBigTestMistyped(run: BigTestRun): BigTestRun {
  if (run.phase !== 'answered') return run;
  const last = run.answers[run.answers.length - 1];
  if (!last || last.right || last.picked === null) return run;
  const answers = run.answers.slice(0, -1).concat({ ...last, right: true, mistyped: true });
  return { ...run, answers };
}

/** From a given answer to the next question, or to the end of the level after its 9th answer. */
export function nextBigTest(run: BigTestRun): BigTestRun {
  if (run.phase !== 'answered') return run;
  if (run.pos >= BIG_TEST_PER_LEVEL - 1) return { ...run, phase: 'levelEnd' };
  return { ...run, pos: run.pos + 1, phase: 'question' };
}

export function bigTestLevelScore(run: BigTestRun, level: BigTestLevel): { right: number; total: number; taken: boolean } {
  const rows = run.answers.filter((a) => a.level === level);
  return { right: rows.filter((a) => a.right).length, total: BIG_TEST_PER_LEVEL, taken: rows.length > 0 };
}

export function bigTestLevelPassed(run: BigTestRun, level: BigTestLevel): boolean {
  const rows = run.answers.filter((a) => a.level === level);
  return rows.length >= BIG_TEST_PER_LEVEL && rows.filter((a) => a.right).length >= BIG_TEST_PASS;
}

/** From the end of a passed level (not C1) to the first question of the next one. */
export function continueBigTest(run: BigTestRun): BigTestRun {
  if (run.phase !== 'levelEnd') return run;
  if (run.levelIdx >= BIG_TEST_LEVELS.length - 1 || !bigTestLevelPassed(run, BIG_TEST_LEVELS[run.levelIdx])) return run;
  return { ...run, levelIdx: run.levelIdx + 1, pos: 0, phase: 'question' };
}

/** From the end of a level (failed, C1, or "Stop here") to the result. */
export function finishBigTest(run: BigTestRun): BigTestRun {
  if (run.phase !== 'levelEnd') return run;
  return { ...run, phase: 'result' };
}

export interface BigTestResult {
  level: BigTestLevel;
  perLevel: { level: BigTestLevel; right: number; total: number; taken: boolean }[];
  needsPractice: string[];
  strong: string[];
}

export function bigTestResult(run: BigTestRun): BigTestResult {
  const perLevel = BIG_TEST_LEVELS.map((level) => ({ level, ...bigTestLevelScore(run, level) }));
  // the first level that was not passed (failed or not taken); everything passed = C1
  const level = BIG_TEST_LEVELS.find((l) => !bigTestLevelPassed(run, l)) ?? 'C1';
  const wrong: string[] = [];
  const right: string[] = [];
  for (const a of run.answers) {
    if (!a.right) {
      if (!wrong.includes(a.topic)) wrong.push(a.topic);
    } else if (!right.includes(a.topic)) right.push(a.topic);
  }
  return { level, perLevel, needsPractice: wrong, strong: right.filter((tp) => !wrong.includes(tp)) };
}

export const bigTestRunKey = (pair: string): string => `grammar-big-test:${pair}`;
export const bigTestResultKey = (pair: string): string => `grammar-big-test-result:${pair}`;

export interface BigTestStoredResult extends BigTestResult {
  /** ISO timestamp. */
  at: string;
}

const PHASES: BigTestPhase[] = ['question', 'answered', 'levelEnd', 'result'];

/**
 * A stored run, or null when it is missing, from another version, or names items the data no longer has (the caller
 * starts a new run instead of crashing on it).
 */
export function parseBigTestRun(raw: unknown, learnedLang: string): BigTestRun | null {
  const r = raw as Partial<BigTestRun> | null | undefined;
  if (!r || typeof r !== 'object' || r.v !== 1) return null;
  if (!Number.isInteger(r.levelIdx) || r.levelIdx! < 0 || r.levelIdx! >= BIG_TEST_LEVELS.length) return null;
  if (!Number.isInteger(r.pos) || r.pos! < 0 || r.pos! >= BIG_TEST_PER_LEVEL) return null;
  if (!r.phase || !PHASES.includes(r.phase) || !Array.isArray(r.answers)) return null;
  const known = new Map(allItems(learnedLang).map((it) => [it.id, it]));
  for (const a of r.answers) {
    const it = a && typeof a === 'object' ? known.get((a as BigTestAnswer).itemId) : undefined;
    if (!it || it.level !== a.level || it.topic !== a.topic || typeof a.right !== 'boolean') return null;
    if (a.picked !== null && !Number.isInteger(a.picked)) return null;
  }
  // the answers must add up to the position, or the screen would show a question that was already answered
  const here = r.answers.filter((a) => a.level === BIG_TEST_LEVELS[r.levelIdx!]).length;
  const expected = r.phase === 'question' ? r.pos : r.phase === 'answered' ? r.pos! + 1 : BIG_TEST_PER_LEVEL;
  if (r.phase !== 'result' && here !== expected) return null;
  return r as BigTestRun;
}

export function parseBigTestResult(raw: unknown): BigTestStoredResult | null {
  const r = raw as Partial<BigTestStoredResult> | null | undefined;
  if (!r || typeof r !== 'object' || !r.level || !BIG_TEST_LEVELS.includes(r.level)) return null;
  if (!Array.isArray(r.perLevel) || r.perLevel.length !== BIG_TEST_LEVELS.length) return null;
  if (!Array.isArray(r.needsPractice) || !Array.isArray(r.strong) || typeof r.at !== 'string') return null;
  return r as BigTestStoredResult;
}

export async function loadBigTestRun(db: DB, pair: string, learnedLang: string): Promise<BigTestRun | null> {
  const run = parseBigTestRun(await loadResumeValue(db, bigTestRunKey(pair)), learnedLang);
  // a finished run is kept as the result, never resumed
  return run && run.phase !== 'result' ? run : null;
}

export async function loadBigTestResult(db: DB, pair: string): Promise<BigTestStoredResult | null> {
  return parseBigTestResult(await loadResumeValue(db, bigTestResultKey(pair)));
}

/** Saves the run after a transition; on the result it writes the result and drops the run. */
export async function saveBigTestRun(db: DB, pair: string, run: BigTestRun): Promise<void> {
  if (run.phase === 'result') {
    const stored: BigTestStoredResult = { ...bigTestResult(run), at: new Date().toISOString() };
    await saveResumeValue(db, bigTestResultKey(pair), stored);
    await saveResumeValue(db, bigTestRunKey(pair), null);
    return;
  }
  await saveResumeValue(db, bigTestRunKey(pair), run);
}

/** What the Grammar tab's card needs: is a run in progress, and the level of the last stored result. */
export async function loadBigTestCard(db: DB, pair: string, learnedLang: string): Promise<{ running: boolean; level: BigTestLevel | null }> {
  if (!hasBigTest(learnedLang)) return { running: false, level: null };
  return { running: (await loadBigTestRun(db, pair, learnedLang)) !== null, level: (await loadBigTestResult(db, pair))?.level ?? null };
}
