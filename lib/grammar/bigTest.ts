import type { DB } from '@/lib/database';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';

// The grammar Big test (placement test), adaptive. It measures and does not teach, so there is no explanation. It moves
// level by level from A1 to C1. A level draws up to BIG_TEST_MAIN "main" questions at random, as far as possible each from
// a different topic. The level is passed with BIG_TEST_QUICK right answers from the start, or BIG_TEST_PASS right in all;
// it is failed at the BIG_TEST_FAIL-th wrong main answer, and then the test ends. After a wrong main answer
// BIG_TEST_FOLLOW follow-up questions from the same topic come, scattered among the next 5 questions; they do not count in the level, only in how the topic is
// judged. The level of the result is the first level that was not passed. Everything here is pure (no React); the screen
// is app/grammar/big-test.tsx. The run and the last result live only in the resume store: this slice writes no grammar
// evidence and moves no level percent, because a placement test must not change what the lessons show.

export type BigTestLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export type BigTestItem =
  | { id: string; level: BigTestLevel; topic: string; kind: 'gap'; lines: string[]; options: string[]; correct: number; why: string }
  | { id: string; level: BigTestLevel; topic: string; kind: 'which'; lines: [string, string]; correct: number; why: string }
  | { id: string; level: BigTestLevel; topic: string; kind: 'register'; options: string[]; correct: number; why: string };

export const BIG_TEST_LEVELS: BigTestLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
/** Most main questions drawn for one level. */
export const BIG_TEST_MAIN = 9;
/** Right main answers that pass a level. */
export const BIG_TEST_PASS = 7;
/** Wrong main answers that fail a level (and end the test). */
export const BIG_TEST_FAIL = 3;
/** The first this many main answers all right pass a level at once. */
export const BIG_TEST_QUICK = 5;
/** Follow-up questions after a wrong main answer. */
export const BIG_TEST_FOLLOW = 2;

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
/** All items of a language (empty for a language without test data). */
export function bigTestPool(learnedLang: string): BigTestItem[] {
  if (!hasBigTest(learnedLang)) return [];
  let items = cache.get(learnedLang);
  if (!items) {
    items = LOADERS[learnedLang]().items;
    cache.set(learnedLang, items);
  }
  return items;
}

/** The items of one level, in file order. */
export function bigTestItems(learnedLang: string, level: BigTestLevel): BigTestItem[] {
  return bigTestPool(learnedLang).filter((it) => it.level === level);
}

// A small seeded generator, so a run can be rebuilt (and tested) from its seed.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function shuffled<T>(list: T[], rand: () => number): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type BigTestPhase = 'question' | 'answered' | 'levelEnd' | 'result';

export interface BigTestAnswer {
  itemId: string;
  level: BigTestLevel;
  topic: string;
  /** The ORIGINAL option index of the item (not the shuffled position on screen); null = "I don't know". */
  picked: number | null;
  right: boolean;
  mistyped?: boolean;
  /** A follow-up question: it does not count in the level, only in the judgment of its topic. */
  follow?: boolean;
  /** Follow-up only: the id of the wrong main item it belongs to. */
  of?: string;
  /** Wrong main answer only: how many follow-ups were scheduled for it (set when the test moves on). */
  due?: number;
}

export interface BigTestQueueEntry {
  id: string;
  follow?: boolean;
  /** Follow-up only: the id of the wrong main item it belongs to. */
  of?: string;
}

export interface BigTestRun {
  v: 2;
  seed: number;
  levelIdx: number;
  /** Questions of the current level in order: the main ones, with follow-ups inserted after a wrong main answer. */
  queue: BigTestQueueEntry[];
  /** Index in `queue` of the question on screen (or the last answered one at the level end). */
  pos: number;
  phase: BigTestPhase;
  answers: BigTestAnswer[];
}

// the main questions of a level: round robin over the shuffled topics (so different topics first, the topics repeat only
// when there are too few), then the order shuffled
function levelQueue(pool: BigTestItem[], levelIdx: number, seed: number): BigTestQueueEntry[] {
  const level = BIG_TEST_LEVELS[levelIdx];
  const rand = rng(seed + levelIdx * 7919);
  const byTopic = new Map<string, BigTestItem[]>();
  for (const it of pool) {
    if (it.level !== level) continue;
    byTopic.set(it.topic, [...(byTopic.get(it.topic) ?? []), it]);
  }
  const topics = shuffled([...byTopic.keys()], rand);
  const lists = new Map(topics.map((tp) => [tp, shuffled(byTopic.get(tp)!, rand)]));
  const picked: BigTestItem[] = [];
  let took = true;
  while (picked.length < BIG_TEST_MAIN && took) {
    took = false;
    for (const tp of topics) {
      const list = lists.get(tp)!;
      if (picked.length < BIG_TEST_MAIN && list.length > 0) {
        picked.push(list.shift()!);
        took = true;
      }
    }
  }
  return shuffled(picked, rand).map((it) => ({ id: it.id }));
}

export const newBigTestSeed = (): number => Math.floor(Math.random() * 2147483647);

export const newBigTestRun = (pool: BigTestItem[], seed: number = newBigTestSeed()): BigTestRun => ({
  v: 2,
  seed,
  levelIdx: 0,
  queue: levelQueue(pool, 0, seed),
  pos: 0,
  phase: 'question',
  answers: [],
});

/** The item on screen (the question, or the one just answered). */
export function currentBigTestItem(run: BigTestRun, pool: BigTestItem[]): BigTestItem | undefined {
  if (run.phase !== 'question' && run.phase !== 'answered') return undefined;
  const id = run.queue[run.pos]?.id;
  return pool.find((it) => it.id === id);
}

/**
 * The order the options are shown in: position i on screen shows option order[i] of the item. It follows the seed of the
 * run. The "which statement" question keeps its four fixed choices.
 */
export function bigTestOptionOrder(run: BigTestRun, item: BigTestItem): number[] {
  const n = item.kind === 'which' ? 4 : item.options.length;
  const order = Array.from({ length: n }, (_, i) => i);
  return item.kind === 'which' ? order : shuffled(order, rng(run.seed ^ hashOf(item.id)));
}

/** Records the answer of the current question (`picked` = original option index); "I don't know" (null) counts as wrong. */
export function answerBigTest(run: BigTestRun, item: BigTestItem, picked: number | null): BigTestRun {
  if (run.phase !== 'question') return run;
  const answer: BigTestAnswer = { itemId: item.id, level: item.level, topic: item.topic, picked, right: picked === item.correct };
  const entry = run.queue[run.pos];
  if (entry?.follow) {
    answer.follow = true;
    answer.of = entry.of;
  }
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

const mainAnswers = (run: BigTestRun, level: BigTestLevel) => run.answers.filter((a) => a.level === level && !a.follow);

// a pass or a fail reached by the main answers so far
function levelOutcome(run: BigTestRun): 'pass' | 'fail' | null {
  const mains = mainAnswers(run, BIG_TEST_LEVELS[run.levelIdx]);
  if (mains.filter((a) => !a.right).length >= BIG_TEST_FAIL) return 'fail';
  if (mains.filter((a) => a.right).length >= BIG_TEST_PASS) return 'pass';
  if (mains.length >= BIG_TEST_QUICK && mains.slice(0, BIG_TEST_QUICK).every((a) => a.right)) return 'pass';
  return null;
}

/**
 * From a given answer to the next question, or to the end of the level (passed, failed, or no question left). After a
 * wrong main answer (that was not marked as mistyped) its follow-ups are scattered among the next 5 questions: never
 * right after the mistake, never two in a row. A wrong follow-up brings nothing new. When the level is passed the main
 * questions still to come drop out and only the pending follow-ups are asked; when it is failed everything drops out.
 */
export function nextBigTest(run: BigTestRun, pool: BigTestItem[]): BigTestRun {
  if (run.phase !== 'answered') return run;
  const last = run.answers[run.answers.length - 1];
  let queue = run.queue;
  let answers = run.answers;
  if (!last.follow) {
    const outcome = levelOutcome(run);
    if (outcome === 'fail') return { ...run, phase: 'levelEnd' };
    if (outcome === 'pass') {
      const pending = queue.slice(run.pos + 1).filter((q) => q.follow);
      if (pending.length === 0) return { ...run, phase: 'levelEnd' };
      queue = [...queue.slice(0, run.pos + 1), ...pending];
    } else if (!last.right) {
      const used = new Set([...run.queue.map((q) => q.id), ...run.answers.map((a) => a.itemId)]);
      const spare = pool.filter((it) => it.level === last.level && it.topic === last.topic && !used.has(it.id));
      const rand = rng(run.seed ^ hashOf(last.itemId));
      const follows = shuffled(spare, rand)
        .slice(0, BIG_TEST_FOLLOW)
        .map((it) => ({ id: it.id, follow: true, of: last.itemId }));
      // slots counted from the question right after this one (slot 1 stays a main question)
      const slots = follows.length === 2 ? [[2, 4], [2, 5], [3, 5]][Math.floor(rand() * 3)] : [2 + Math.floor(rand() * 4)];
      const rest = queue.slice(run.pos + 1);
      follows.forEach((f, k) => rest.splice(Math.min(slots[k] - 1, rest.length), 0, f));
      // late in the level the slots pile up at the end: keep the two apart while another question can sit between them
      if (follows.length === 2) {
        const at = rest.findIndex((q) => q.id === follows[0].id);
        if (rest[at + 1]?.id === follows[1].id && at > 0 && !rest[at - 1].follow) [rest[at - 1], rest[at]] = [rest[at], rest[at - 1]];
      }
      queue = [...queue.slice(0, run.pos + 1), ...rest];
      answers = answers.slice(0, -1).concat({ ...last, due: follows.length });
    }
  }
  if (run.pos + 1 < queue.length) return { ...run, queue, answers, pos: run.pos + 1, phase: 'question' };
  return { ...run, queue, answers, phase: 'levelEnd' };
}

/** Main answers of a level: the right ones and how many were answered. */
export function bigTestLevelScore(run: BigTestRun, level: BigTestLevel): { right: number; total: number; taken: boolean } {
  const rows = mainAnswers(run, level);
  return { right: rows.filter((a) => a.right).length, total: rows.length, taken: rows.length > 0 };
}

/**
 * A level that was taken and not failed. It is read at the level end (and in the result), where a level is either
 * passed by the rules, failed, or out of main questions with fewer than BIG_TEST_FAIL wrong.
 */
export function bigTestLevelPassed(run: BigTestRun, level: BigTestLevel): boolean {
  const rows = mainAnswers(run, level);
  return rows.length > 0 && rows.filter((a) => !a.right).length < BIG_TEST_FAIL;
}

/** From the end of a passed level (not C1) to the first question of the next one. */
export function continueBigTest(run: BigTestRun, pool: BigTestItem[]): BigTestRun {
  if (run.phase !== 'levelEnd') return run;
  if (run.levelIdx >= BIG_TEST_LEVELS.length - 1 || !bigTestLevelPassed(run, BIG_TEST_LEVELS[run.levelIdx])) return run;
  const levelIdx = run.levelIdx + 1;
  return { ...run, levelIdx, queue: levelQueue(pool, levelIdx, run.seed), pos: 0, phase: 'question' };
}

/** From the end of a level (failed, C1, or "Stop here") to the result. */
export function finishBigTest(run: BigTestRun): BigTestRun {
  if (run.phase !== 'levelEnd') return run;
  return { ...run, phase: 'result' };
}

/**
 * How much of the test is done, 0 to 1, never going back: one fifth per level, and inside it the share of the level's
 * main questions answered (a passed level counts as whole).
 */
export function bigTestProgress(run: BigTestRun): number {
  return bigTestStepFill(run).reduce((sum, f) => sum + f, 0) / BIG_TEST_LEVELS.length;
}

/**
 * The fill of the five level steps in the header (0 to 1 each): passed levels full, the current one by the share of its
 * main questions answered, the rest empty. Only moving to the next level advances the step; no value ever goes down.
 */
export function bigTestStepFill(run: BigTestRun): number[] {
  const level = BIG_TEST_LEVELS[run.levelIdx];
  const mains = run.queue.filter((q) => !q.follow).length;
  const answered = mainAnswers(run, level).length;
  const ended = run.phase === 'levelEnd' || run.phase === 'result';
  const within = ended && bigTestLevelPassed(run, level) ? 1 : mains > 0 ? Math.min(1, answered / mains) : 0;
  return BIG_TEST_LEVELS.map((_, i) => (i < run.levelIdx ? 1 : i === run.levelIdx ? within : 0));
}

/** The running number of the question on screen, counting follow-ups too and not the total (the test adapts). */
export const bigTestQuestionNumber = (run: BigTestRun): number => run.answers.length + (run.phase === 'question' ? 1 : 0);

export interface BigTestResult {
  level: BigTestLevel;
  /** `passed` is absent in a result stored before the adaptive test. */
  perLevel: { level: BigTestLevel; right: number; total: number; taken: boolean; passed?: boolean }[];
  needsPractice: string[];
  strong: string[];
}

export function bigTestResult(run: BigTestRun): BigTestResult {
  const perLevel = BIG_TEST_LEVELS.map((level) => ({ level, ...bigTestLevelScore(run, level), passed: bigTestLevelPassed(run, level) }));
  // the first level that was not passed (failed or not taken); everything passed = C1
  const level = BIG_TEST_LEVELS.find((l) => !bigTestLevelPassed(run, l)) ?? 'C1';
  const practice: string[] = [];
  const right: string[] = [];
  const wrong = new Set<string>();
  run.answers.forEach((a) => {
    if (a.follow) return;
    if (a.right) {
      if (!right.includes(a.topic)) right.push(a.topic);
      return;
    }
    wrong.add(a.topic);
    // the topic is judged by its follow-ups: none scheduled, some never asked (the level failed first) or one wrong
    const follows = run.answers.filter((f) => f.follow && f.of === a.itemId);
    if ((!a.due || follows.length < a.due || follows.some((f) => !f.right)) && !practice.includes(a.topic)) practice.push(a.topic);
  });
  return { level, perLevel, needsPractice: practice, strong: right.filter((tp) => !wrong.has(tp)) };
}

export const bigTestRunKey = (pair: string): string => `grammar-big-test:${pair}`;
export const bigTestResultKey = (pair: string): string => `grammar-big-test-result:${pair}`;

export interface BigTestStoredResult extends BigTestResult {
  /** ISO timestamp. */
  at: string;
}

const PHASES: BigTestPhase[] = ['question', 'answered', 'levelEnd', 'result'];

/**
 * A stored run, or null when it is missing, from another version (the old 45-question run is v1), or names items the data
 * no longer has (the caller starts a new run instead of crashing on it).
 */
export function parseBigTestRun(raw: unknown, pool: BigTestItem[]): BigTestRun | null {
  const r = raw as Partial<BigTestRun> | null | undefined;
  if (!r || typeof r !== 'object' || r.v !== 2) return null;
  if (!Number.isInteger(r.seed) || !Number.isInteger(r.levelIdx) || r.levelIdx! < 0 || r.levelIdx! >= BIG_TEST_LEVELS.length) return null;
  if (!r.phase || !PHASES.includes(r.phase) || !Array.isArray(r.answers) || !Array.isArray(r.queue)) return null;
  if (!Number.isInteger(r.pos) || r.pos! < 0 || r.pos! >= Math.max(1, r.queue.length)) return null;
  const known = new Map(pool.map((it) => [it.id, it]));
  const level = BIG_TEST_LEVELS[r.levelIdx!];
  for (const q of r.queue) {
    const it = q && typeof q === 'object' ? known.get((q as BigTestQueueEntry).id) : undefined;
    if (!it || it.level !== level) return null;
  }
  for (const a of r.answers) {
    const it = a && typeof a === 'object' ? known.get((a as BigTestAnswer).itemId) : undefined;
    if (!it || it.level !== a.level || it.topic !== a.topic || typeof a.right !== 'boolean') return null;
    if (a.picked !== null && !Number.isInteger(a.picked)) return null;
  }
  if (r.phase !== 'result') {
    // the answers of this level must add up to the position and follow the queue, or the screen would show a question
    // that was already answered
    const here = r.answers.filter((a) => a.level === level);
    const expected = r.phase === 'question' ? r.pos! : r.pos! + 1;
    if (here.length !== expected) return null;
    if (here.some((a, i) => a.itemId !== r.queue![i].id || !!a.follow !== !!r.queue![i].follow)) return null;
  }
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
  const run = parseBigTestRun(await loadResumeValue(db, bigTestRunKey(pair)), bigTestPool(learnedLang));
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
