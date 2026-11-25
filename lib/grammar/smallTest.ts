import type { DB } from '@/lib/database';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { shuffleArray } from '@/lib/shuffle';
import type { GrammarKind } from '@/lib/games/content';
import { TASK_TYPE_IDS, type TaskTypeId } from './taskTypes';

// The grammar Small test (one per level, "A1 test"): 10 or 20 questions per round, every round a new mix of the level's topics
// (the core topics first), adaptive: a miss brings 2 more questions of that topic within the next 5 (never right after each
// other); both right -> a 3rd, right -> learned; mixed -> a 3rd; both wrong -> the test stops, the lesson opens, a 3-question
// check follows and the test goes on where it was. The level is done when every core topic is learned. Everything here is
// pure (no React); the screen is app/grammar/small-test.tsx. The state lives in the resume store.
//
// How a topic is learned (decided here, the spec names only the miss path): miss -> 2 right -> 3rd right, or mixed -> 3rd
// right; or 3 right answers in a row on the topic without a miss, counted across rounds (a topic that is never missed would
// never be learned otherwise; a miss resets the count). A topic that stops the test loses its learned mark.

export const SMALL_TEST_SIZE = 10;
export const LONG_TEST_SIZE = 20;
export const SMALL_TEST_TOPICS = 6;
export const MINI_CHECK_SIZE = 3;
const RECENT_TYPES = 6;
const RECENT_QUESTIONS = 60;
const HISTORY_MAX = 12;
const CLEAN_ANSWERS = 3;
/** A missed question leaves the miss log after this many right answers in later rounds. */
export const GAP_RIGHT = 2;
/** The miss log keeps at most this many items (the oldest round drops out). */
export const GAPS_MAX = 150;
/** The latest answers kept per topic (1 right, 0 wrong). */
export const TOPIC_LOG = 10;
/** A topic is weak with at least 3 logged answers and an accuracy below this. */
export const WEAK_BELOW = 0.8;
/** The task types that ask the learner to write, used first in a learned topic. */
export const HARD_TYPES: readonly TaskTypeId[] = ['form', 'transform', 'opencloze', 'fix', 'order'];
/** The end-of-round practice: at most DRILL_MAX questions, DRILL_EXTRA new ones for a topic with 2+ misses. */
export const DRILL_MAX = 8;
export const DRILL_EXTRA = 2;
const WEAK_MIN_LOG = 3;

// the task type of a lesson item kind (data/grammar/task-types.json is the one place that says it)
const TYPE_FILE: { types: Record<TaskTypeId, GrammarKind[]> } = require('@/data/grammar/task-types.json');

export function taskTypeOfKind(kind: GrammarKind): TaskTypeId | null {
  return TASK_TYPE_IDS.find((id) => TYPE_FILE.types[id].includes(kind)) ?? null;
}

export interface PoolQ {
  id: string;
  type: TaskTypeId;
}
/** The usable questions of a topic (already limited to the level's task types). */
export type SmallPool = (topicId: string) => PoolQ[];

export interface SmallTopicInfo {
  id: string;
  core: boolean;
}

export type SmallRole = 'base' | 'f1' | 'f2' | 'f3' | 'mini' | 'drill';

export interface SmallCur {
  topic: string;
  qid: string;
  type: TaskTypeId;
  role: SmallRole;
  /** The open miss this sibling question stands for: its answer closes (or renews) that miss. */
  gap?: string;
}

export interface SmallAnswer extends SmallCur {
  ok: boolean;
  mistyped?: boolean;
}

export type TopicStage = 'base' | 'follow' | 'third' | 'learned' | 'open' | 'stopped';

export interface TopicRun {
  stage: TopicStage;
  /** The two follow-up answers. */
  fu: boolean[];
  asked: number;
  right: number;
  /** The result of the 3-question check after the lesson. */
  mini?: { right: number; asked: number };
}

interface Pending {
  topic: string;
  role: 'f1' | 'f2' | 'f3';
  /** The index of the first question where it may come. */
  due: number;
}

export type SmallPhase = 'intro' | 'ask' | 'stop' | 'lesson' | 'mini' | 'drill' | 'end';

/** Why a topic is in the round: an open miss, a weak topic, never seen, or a repeat. */
export type TopicWhy = 'gap' | 'weak' | 'new' | 'repeat';

export interface SmallRun {
  round: number;
  seed: number;
  phase: SmallPhase;
  /** Missing in a run saved before the length choice. */
  size?: typeof SMALL_TEST_SIZE | typeof LONG_TEST_SIZE;
  /** `why` is missing in a run saved before the miss log (then `isNew` tells). */
  topics: { id: string; isNew: boolean; why?: TopicWhy; core?: boolean }[];
  topicRuns: Record<string, TopicRun>;
  answers: SmallAnswer[];
  pending: Pending[];
  current: SmallCur | null;
  stopTopic: string | null;
  mini: { cur: SmallCur[]; answers: boolean[] } | null;
  /** The answer on the result card, not yet settled with Next: leaving there still counts it. */
  shown?: { ok: boolean };
  /** The end-of-round practice in progress: the questions, the next index and the right answers so far. */
  drill?: { list: SmallCur[]; i: number; right: number };
  /** The finished practice. */
  drilled?: { right: number; total: number };
  /** The answers of the quick check after a lesson (kept for the practice list; not in `answers`, which counts the test). Missing in an older save. */
  miniAnswers?: SmallAnswer[];
}

export interface SmallGap {
  topic: string;
  right: number;
  round: number;
}

export interface SmallState {
  v: 1;
  /** Learned topic ids of the level. */
  learned: string[];
  /** Right answers in a row on the topic (across rounds, a miss resets it). */
  clean: Record<string, number>;
  /** Every topic that was ever in a round (the "repeat" mark). */
  seen: string[];
  /** The percent of every finished round, the last HISTORY_MAX. */
  history: number[];
  /** The latest question ids, so a new round prefers new questions. */
  recent: string[];
  /** Rounds started so far. */
  rounds: number;
  run: SmallRun | null;
  /** Miss log: the missed questions not yet answered right twice (in later rounds). Key = question id. */
  gaps: Record<string, SmallGap>;
  /** Misses closed so far (answered right GAP_RIGHT times). */
  fixed: number;
  /** The latest answers per topic: 1 right, 0 wrong, the newest last, at most TOPIC_LOG. */
  log: Record<string, number[]>;
  /** The number of the last round the topic was in. */
  last: Record<string, number>;
}

export const newSmallState = (): SmallState => ({ v: 1, learned: [], clean: {}, seen: [], history: [], recent: [], rounds: 0, run: null, gaps: {}, fixed: 0, log: {}, last: {} });

export const runSize = (run: SmallRun): typeof SMALL_TEST_SIZE | typeof LONG_TEST_SIZE => run.size === LONG_TEST_SIZE ? LONG_TEST_SIZE : SMALL_TEST_SIZE;

export const smallKey = (pair: string, level: string): string => `grammar-small-test:${pair}:${level}`;

const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []);

// A saved run's practice and quick-check fields are checked item by item (a damaged item drops out). A drill phase without a
// usable drill list (empty, or its index outside it) is on the end screen.
function fixDrill(run: SmallRun): SmallRun {
  const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  const item = (c: unknown): c is SmallCur => !!c && typeof c === 'object' && typeof (c as SmallCur).topic === 'string' && typeof (c as SmallCur).qid === 'string';
  const d = run.drill;
  const list = d && typeof d === 'object' && Array.isArray(d.list) ? d.list.filter(item) : [];
  const i = d && num(d.i) && Array.isArray(d.list) ? d.list.slice(0, d.i).filter(item).length : -1;
  const okDrill = !!d && num(d.right) && i >= 0 && i < list.length;
  const dd = run.drilled as Partial<NonNullable<SmallRun['drilled']>> | undefined;
  const miniAnswers = Array.isArray(run.miniAnswers) ? run.miniAnswers.filter((a) => item(a) && typeof a.ok === 'boolean') : undefined;
  const fixed: SmallRun = { ...run, drill: okDrill ? { list, i, right: d!.right } : undefined, drilled: dd && num(dd.right) && num(dd.total) ? { right: dd.right, total: dd.total } : undefined, miniAnswers };
  return run.phase === 'drill' && !okDrill ? { ...fixed, phase: 'end', current: null } : fixed;
}

/** A saved state, or a fresh one when the value is missing or damaged. */
export function parseSmallState(raw: unknown): SmallState {
  const r = raw as Partial<SmallState> | null | undefined;
  if (!r || typeof r !== 'object' || r.v !== 1 || !Array.isArray(r.learned) || !Array.isArray(r.seen) || !Array.isArray(r.history)) return newSmallState();
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries((r.clean ?? {}) as Record<string, unknown>)) if (typeof v === 'number' && Number.isFinite(v)) clean[k] = v;
  const gaps: Record<string, SmallGap> = {};
  for (const [k, v] of Object.entries((r.gaps ?? {}) as Record<string, unknown>)) {
    const g = v as Partial<SmallGap> | null;
    if (g && typeof g === 'object' && typeof g.topic === 'string' && typeof g.right === 'number' && Number.isFinite(g.right) && typeof g.round === 'number' && Number.isFinite(g.round)) gaps[k] = { topic: g.topic, right: g.right, round: g.round };
  }
  const log: Record<string, number[]> = {};
  if (r.log && typeof r.log === 'object') for (const [k, v] of Object.entries(r.log as Record<string, unknown>)) if (Array.isArray(v)) log[k] = v.filter((x): x is number => x === 0 || x === 1).slice(-TOPIC_LOG);
  const last: Record<string, number> = {};
  if (r.last && typeof r.last === 'object') for (const [k, v] of Object.entries(r.last as Record<string, unknown>)) if (typeof v === 'number' && Number.isFinite(v)) last[k] = v;
  const run = r.run as SmallRun | null | undefined;
  const okRun = !!run && typeof run === 'object' && typeof run.seed === 'number' && Array.isArray(run.topics) && Array.isArray(run.answers) && !!run.topicRuns && typeof run.phase === 'string';
  // every round topic needs its topicRuns entry, or the next pick would throw
  const whole = okRun && run!.topics.every((tp) => !!tp && typeof tp.id === 'string' && !!run!.topicRuns[tp.id] && typeof run!.topicRuns[tp.id] === 'object');
  return {
    v: 1,
    learned: strings(r.learned),
    clean,
    seen: strings(r.seen),
    history: (r.history as unknown[]).filter((v): v is number => typeof v === 'number').slice(-HISTORY_MAX),
    recent: strings(r.recent),
    rounds: typeof r.rounds === 'number' ? r.rounds : 0,
    run: okRun && whole ? fixDrill({ ...(run as SmallRun), size: runSize(run!), pending: Array.isArray(run!.pending) ? run!.pending : [], mini: run!.mini ?? null, stopTopic: run!.stopTopic ?? null, current: run!.current ?? null }) : null,
    gaps,
    fixed: typeof r.fixed === 'number' && Number.isFinite(r.fixed) && r.fixed > 0 ? r.fixed : 0,
    log,
    last,
  };
}

/** True when a Small test round of this level is saved and not finished (the Grammar tab's Continue mark). */
export async function hasSavedSmallRun(db: DB, pair: string, level: string): Promise<boolean> {
  return (await loadSmallState(db, pair, level)).run !== null;
}

export async function loadSmallState(db: DB, pair: string, level: string): Promise<SmallState> {
  return parseSmallState(await loadResumeValue(db, smallKey(pair, level)));
}

export async function saveSmallState(db: DB, pair: string, level: string, st: SmallState): Promise<boolean> {
  return saveResumeValue(db, smallKey(pair, level), st);
}

// ---------------------------------------------------------------------------------------------------------------------
// the round's topics

/** The topic's accuracy over its logged answers, or null with fewer than WEAK_MIN_LOG of them. */
function topicAccuracy(st: SmallState, topic: string): number | null {
  const l = st.log[topic] ?? [];
  return l.length >= WEAK_MIN_LOG ? l.reduce((a, b) => a + b, 0) / l.length : null;
}

/** Weak topic: at least 3 logged answers and the accuracy below WEAK_BELOW. */
export function isWeakTopic(st: SmallState, topic: string): boolean {
  const acc = topicAccuracy(st, topic);
  return acc !== null && acc < WEAK_BELOW;
}

const openGaps = (st: SmallState, topic: string): number => Object.values(st.gaps).filter((g) => g.topic === topic).length;

/** The mark of a topic row: its `why`, or (a run saved before the miss log) new / repeat from `isNew`. */
export const topicWhy = (tp: { isNew: boolean; why?: TopicWhy }): TopicWhy => tp.why ?? (tp.isNew ? 'new' : 'repeat');

/**
 * A new round (phase 'intro'): up to SMALL_TEST_TOPICS topics. First the unlearned core topics (unseen first, then more open
 * misses, weak topics with the lower accuracy first, the one in a round longest ago), then all the
 * others (learned core and non-core) in one list: more open misses, weak topics (lower accuracy first), never seen, seen but
 * not learned, the one that was in a round longest ago; a tie is a seeded shuffle.
 */
export function startRound(st: SmallState, topics: SmallTopicInfo[], pool: SmallPool, seed: number): SmallState {
  const usable = topics.filter((tp) => pool(tp.id).length > 0);
  const learned = new Set(st.learned);
  const seen = new Set(st.seen);
  // a miss whose question is no longer in the topic is dropped (changed content), `fixed` does not grow
  const gaps = Object.fromEntries(Object.entries(st.gaps).filter(([qid, g]) => pool(g.topic).some((q) => q.id === qid)));
  const cur: SmallState = { ...st, gaps };
  const group = (list: SmallTopicInfo[], salt: number) =>
    shuffleArray(list, seed + salt)
      .map((tp, i) => ({ tp, i, open: openGaps(cur, tp.id), acc: topicAccuracy(cur, tp.id) }))
      .map((x) => ({ ...x, weak: x.acc !== null && x.acc < WEAK_BELOW }))
      .sort(
        (a, b) =>
          Number(seen.has(a.tp.id)) - Number(seen.has(b.tp.id)) ||
          b.open - a.open ||
          Number(b.weak) - Number(a.weak) ||
          (a.weak && b.weak ? a.acc! - b.acc! : 0) ||
          (st.last[a.tp.id] ?? 0) - (st.last[b.tp.id] ?? 0) ||
          a.i - b.i,
      )
      .map((x) => x.tp);
  const rest = shuffleArray(usable.filter((tp) => !(tp.core && !learned.has(tp.id))), seed + 2)
    .map((tp, i) => ({ tp, i, open: openGaps(cur, tp.id), acc: topicAccuracy(cur, tp.id) }))
    .map((x) => ({ ...x, weak: x.acc !== null && x.acc < WEAK_BELOW }))
    .sort(
      (a, b) =>
        b.open - a.open ||
        Number(b.weak) - Number(a.weak) ||
        (a.weak && b.weak ? a.acc! - b.acc! : 0) ||
        Number(seen.has(a.tp.id)) - Number(seen.has(b.tp.id)) ||
        Number(learned.has(a.tp.id)) - Number(learned.has(b.tp.id)) ||
        (st.last[a.tp.id] ?? 0) - (st.last[b.tp.id] ?? 0) ||
        a.i - b.i,
    )
    .map((x) => x.tp);
  const order = [...group(usable.filter((tp) => tp.core && !learned.has(tp.id)), 1), ...rest].slice(0, SMALL_TEST_TOPICS);
  const picked = shuffleArray(order, seed + 4);
  const why = (id: string): TopicWhy => (openGaps(cur, id) > 0 ? 'gap' : isWeakTopic(cur, id) ? 'weak' : !seen.has(id) ? 'new' : 'repeat');
  const run: SmallRun = {
    round: st.rounds + 1,
    seed,
    phase: 'intro',
    topics: picked.map((tp) => ({ id: tp.id, isNew: !seen.has(tp.id), why: why(tp.id), core: tp.core })),
    topicRuns: Object.fromEntries(picked.map((tp) => [tp.id, { stage: 'base' as TopicStage, fu: [], asked: 0, right: 0 }])),
    answers: [],
    pending: [],
    current: null,
    stopTopic: null,
    mini: null,
  };
  const last = { ...st.last, ...Object.fromEntries(picked.map((tp) => [tp.id, run.round])) };
  return { ...st, rounds: st.rounds + 1, seen: [...new Set([...st.seen, ...picked.map((tp) => tp.id)])], run, gaps, last };
}

/** The answer is on the result card: it is saved, so leaving before Next does not lose it. */
export function markShown(st: SmallState, ok: boolean): SmallState {
  if (!st.run || !st.run.current) return st;
  return { ...st, run: { ...st.run, shown: { ok } } };
}

/** A loaded run that was left on a result card: that answer is settled now (the next question comes). */
export function settleShown(st: SmallState, pool: SmallPool): SmallState {
  const run = st.run;
  if (!run || !run.shown) return st;
  if (!run.current || (run.phase !== 'ask' && run.phase !== 'mini' && run.phase !== 'drill')) return { ...st, run: { ...run, shown: undefined } };
  return resolveAnswer(st, pool, run.shown.ok);
}

/**
 * A loaded run whose current question (or quick-check question) is no longer in the content (a content update): another
 * question of the same topic comes; with none left the run is dropped (the screen starts a new round).
 */
export function repairSmallRun(st: SmallState, pool: SmallPool): SmallState {
  const run = st.run;
  if (!run) return st;
  const has = (c: SmallCur) => pool(c.topic).some((q) => q.id === c.qid);
  if (run.phase === 'ask') {
    if (run.current && has(run.current)) return st;
    if (run.current) {
      const cur = pickQuestion(st, run, run.current.topic, run.current.role, pool, [], [], run.answers.length);
      return cur ? { ...st, run: { ...run, current: cur } } : { ...st, run: null };
    }
    return withNext(st, run, pool);
  }
  if (run.phase === 'mini') {
    if (run.mini && run.current && run.mini.cur.every(has)) return st;
    if (!run.stopTopic) return { ...st, run: null };
    return finishLesson({ ...st, run: { ...run, phase: 'lesson', mini: null, current: null } }, pool);
  }
  if (run.phase === 'drill') {
    if (!run.drill) return { ...st, run: { ...run, phase: 'end', current: null } };
    const { list, i, right } = run.drill;
    if (list.every(has)) return run.current && has(run.current) ? st : nextDrill(st, { ...run, shown: undefined }, pool, i, right);
    // the questions that left the content drop out of the list (the index follows), so the count is of the asked ones
    const kept = list.filter(has);
    return nextDrill(st, { ...run, shown: undefined, drill: { list: kept, i: list.slice(0, i).filter(has).length, right } }, pool, list.slice(0, i).filter(has).length, right);
  }
  return st;
}

/** From the intro to the first question. */
export function beginRound(st: SmallState, pool: SmallPool, size: typeof SMALL_TEST_SIZE | typeof LONG_TEST_SIZE = SMALL_TEST_SIZE): SmallState {
  if (!st.run || st.run.phase !== 'intro') return st;
  return withNext(st, { ...st.run, phase: 'ask', size }, pool);
}

// ---------------------------------------------------------------------------------------------------------------------
// picking

// The question of a topic: of the task type the latest answers hold least (and this topic least), a question that was not
// asked in this round and (when possible) not lately.
function pickQuestion(
  st: SmallState,
  run: SmallRun,
  topic: string,
  role: SmallRole,
  pool: SmallPool,
  taken: string[],
  extraTypes: TaskTypeId[],
  salt: number,
): SmallCur | null {
  let all = pool(topic);
  const used = new Set([...run.answers.map((a) => a.qid), ...taken]);
  if (runSize(run) === LONG_TEST_SIZE && role === 'base') {
    all = all.filter((q) => !used.has(q.id));
    const types = new Set(run.answers.filter((a) => a.topic === topic).map((a) => a.type));
    const otherTypes = all.filter((q) => !types.has(q.type));
    if (otherTypes.length > 0) all = otherTypes;
  }
  // a base question of a topic with an open miss: the miss is asked again (the oldest first), before any other rule, but as a
  // sibling (another question of the topic with the same task type, the one asked longest ago); the missed question itself
  // only when the topic has no other of that type. A right answer to the sibling closes the miss (`gap` names it).
  if (role === 'base') {
    const open = all.filter((q) => !used.has(q.id) && st.gaps[q.id]?.topic === topic && st.gaps[q.id].round < run.round);
    if (open.length > 0) {
      const q = shuffleArray(open, run.seed * 13 + salt)
        .map((m, i) => ({ m, i, round: st.gaps[m.id].round }))
        .sort((a, b) => a.round - b.round || a.i - b.i)[0].m;
      const sibs = all.filter((s) => s.type === q.type && s.id !== q.id && !used.has(s.id));
      const calm = sibs.filter((s) => !st.gaps[s.id]);
      const pickFrom = calm.length > 0 ? calm : sibs;
      if (pickFrom.length > 0) {
        const age = (id: string) => st.recent.lastIndexOf(id);
        const s = shuffleArray(pickFrom, run.seed * 7 + salt)
          .map((m, i) => ({ m, i, age: age(m.id) }))
          .sort((a, b) => a.age - b.age || a.i - b.i)[0].m;
        return { topic, qid: s.id, type: s.type, role, gap: q.id };
      }
      return { topic, qid: q.id, type: q.type, role };
    }
  }
  let cands = all.filter((q) => !used.has(q.id));
  if (cands.length === 0) {
    const last = run.answers.length ? run.answers[run.answers.length - 1].qid : '';
    cands = all.filter((q) => q.id !== last && !taken.includes(q.id));
  }
  if (cands.length === 0) return null;
  // a learned topic asks the writing types first (when it has one)
  if (role === 'base' && st.learned.includes(topic)) {
    const hard = cands.filter((q) => HARD_TYPES.includes(q.type));
    if (hard.length > 0) cands = hard;
  }
  const lately = new Set(st.recent);
  const fresh = cands.filter((q) => !lately.has(q.id));
  if (fresh.length > 0) cands = fresh;
  const recent = [...run.answers.map((a) => a.type), ...extraTypes].slice(-RECENT_TYPES);
  const mine = [...run.answers.filter((a) => a.topic === topic).map((a) => a.type), ...extraTypes];
  const count = (list: TaskTypeId[], ty: TaskTypeId) => list.filter((x) => x === ty).length;
  const types = [...new Set(cands.map((q) => q.type))];
  const tie = shuffleArray(types, run.seed * 31 + salt);
  const ty = types
    .map((x) => ({ x, score: count(recent, x) * 10 + count(mine, x), tie: tie.indexOf(x) }))
    .sort((a, b) => a.score - b.score || a.tie - b.tie)[0].x;
  const q = shuffleArray(cands.filter((c) => c.type === ty), run.seed * 17 + salt)[0];
  return { topic, qid: q.id, type: q.type, role };
}

// Keep long-round base questions within the intro topics' budgets; follow-ups have their own schedule.
function hasBaseQuestion(st: SmallState, run: SmallRun, topic: string, pool: SmallPool): boolean {
  if (runSize(run) !== LONG_TEST_SIZE) return pool(topic).length > 0;
  const tp = run.topics.find((tp) => tp.id === topic)!;
  const limit = topicWhy(tp) !== 'repeat' || (tp.core && !st.learned.includes(topic)) ? 3 : 2;
  const asked = run.answers.filter((a) => a.topic === topic && a.role === 'base').length;
  return asked < limit && pool(topic).some((q) => !run.answers.some((a) => a.qid === q.id));
}

// The next question of the round: a due follow-up (never of the topic that was just asked, when something else can come),
// else the next base question: the round's topic with the fewest answers that is still in its base stage.
function pickNext(st: SmallState, run: SmallRun, pool: SmallPool): SmallCur | null {
  const n = run.answers.length;
  const prev = n > 0 ? run.answers[n - 1].topic : '';
  const due = run.pending
    .filter((p) => p.due <= n && !(p.role === 'f2' && run.pending.some((o) => o.topic === p.topic && o.role === 'f1')))
    .sort((a, b) => a.due - b.due);
  const other = due.filter((p) => p.topic !== prev);
  const wantsFollow = other.length > 0 ? other : due.length > 0 && !hasBaseElsewhere(st, run, prev, pool) ? due : [];
  for (const p of wantsFollow) {
    const first = run.answers.find((a) => a.topic === p.topic);
    const cur = pickQuestion(st, run, p.topic, p.role, pool, [], first ? [first.type] : [], n);
    if (cur) return cur;
  }
  const order = run.topics.map((tp) => tp.id);
  const eligible = order.filter((id) => run.topicRuns[id].stage === 'base' && hasBaseQuestion(st, run, id, pool));
  const ranked = (list: string[]) => list.map((id, i) => ({ id, i, asked: run.topicRuns[id].asked })).sort((a, b) => a.asked - b.asked || a.i - b.i).map((x) => x.id);
  const away = ranked(eligible.filter((id) => id !== prev));
  for (const id of [...away, ...ranked(eligible.filter((id) => id === prev))]) {
    const cur = pickQuestion(st, run, id, 'base', pool, [], [], n);
    if (cur) return cur;
  }
  // nothing in a base stage is left: any topic of the round that still has an unasked question
  const remaining = runSize(run) === LONG_TEST_SIZE ? order.filter((id) => hasBaseQuestion(st, run, id, pool)) : order;
  const fallback = runSize(run) === LONG_TEST_SIZE
    ? [...ranked(remaining.filter((id) => id !== prev)), ...ranked(remaining.filter((id) => id === prev))]
    : ranked(remaining.filter((id) => id !== prev).concat(remaining.filter((id) => id === prev)));
  for (const id of fallback) {
    const cur = pickQuestion(st, run, id, 'base', pool, [], [], n);
    if (cur) return cur;
  }
  // long round, every budget spent: the budgets only set the order, so top up to 20 from any round topic that still has an
  // unasked question (base stage first, the topic just asked last)
  if (runSize(run) === LONG_TEST_SIZE) {
    const open = order
      .map((id, i) => ({ id, i, asked: run.topicRuns[id].asked, k: (id === prev ? 2 : 0) + (run.topicRuns[id].stage === 'base' ? 0 : 1) }))
      .filter((x) => pool(x.id).some((q) => !run.answers.some((a) => a.qid === q.id)))
      .sort((a, b) => a.k - b.k || a.asked - b.asked || a.i - b.i);
    for (const { id } of open) {
      const cur = pickQuestion(st, run, id, 'base', pool, [], [], n);
      if (cur) return cur;
    }
  }
  return null;
}

function hasBaseElsewhere(st: SmallState, run: SmallRun, prev: string, pool: SmallPool): boolean {
  return run.topics.some((tp) => tp.id !== prev && run.topicRuns[tp.id].stage === 'base' && hasBaseQuestion(st, run, tp.id, pool));
}

// ---------------------------------------------------------------------------------------------------------------------
// answering

const wrongIn = (answers: SmallAnswer[], topic: string): number => answers.filter((a) => a.topic === topic && !a.ok).length;

// A miss-log item is made or reset; over GAPS_MAX the oldest round drops out (the one place that cuts the log).
function addGap(gaps: Record<string, SmallGap>, cur: SmallCur, round: number): Record<string, SmallGap> {
  const out = { ...gaps, [cur.qid]: { topic: cur.topic, right: 0, round } };
  const keys = Object.keys(out);
  if (keys.length > GAPS_MAX) delete out[keys.map((k, i) => ({ k, i, round: out[k].round })).sort((a, b) => a.round - b.round || a.i - b.i)[0].k];
  return out;
}

// A miss makes (or resets) its miss-log item; a right answer in a later round than the miss counts towards closing it (a
// right answer in the miss's own round does not). Every answer goes into the topic's log.
function record(st: SmallState, run: SmallRun, cur: SmallCur, ok: boolean): SmallState {
  let gaps = { ...st.gaps };
  let fixed = st.fixed;
  const key = cur.gap && gaps[cur.gap] ? cur.gap : cur.qid;
  const g = gaps[key];
  if (!ok) gaps = addGap(gaps, { ...cur, qid: key }, run.round);
  else if (g && g.round < run.round) {
    if (g.right + 1 >= GAP_RIGHT) {
      delete gaps[key];
      fixed += 1;
    } else gaps[key] = { ...g, right: g.right + 1, round: run.round };
  }
  const log = { ...st.log, [cur.topic]: [...(st.log[cur.topic] ?? []), ok ? 1 : 0].slice(-TOPIC_LOG) };
  return { ...st, gaps, fixed, log };
}

function withNext(st: SmallState, run: SmallRun, pool: SmallPool): SmallState {
  if (run.answers.length >= runSize(run)) return endRound(st, run);
  const cur = pickNext(st, run, pool);
  if (!cur) return endRound(st, run);
  return { ...st, run: { ...run, phase: 'ask', current: cur } };
}

/**
 * The current question is settled: `ok` is the result (a typo the learner owned up to counts as right, `mistyped`). The
 * topic's state moves on, the follow-ups are planned, and the next question, the stop, the end of the round or the next
 * question of the mini check follows.
 */
export function resolveAnswer(st0: SmallState, pool: SmallPool, ok: boolean, mistyped = false): SmallState {
  const run = st0.run && st0.run.shown ? { ...st0.run, shown: undefined } : st0.run;
  if (!run || !run.current) return st0;
  if (run.phase === 'drill') return resolveDrill(st0, pool, ok);
  if (run.phase === 'mini') return resolveMini(record(st0, run, run.current, ok), run, pool, ok);
  if (run.phase !== 'ask') return st0;
  const st = record(st0, run, run.current, ok);
  const cur = run.current;
  const answer: SmallAnswer = { ...cur, ok, ...(mistyped ? { mistyped: true } : {}) };
  const answers = [...run.answers, answer];
  const idx = answers.length - 1;
  const prevRun = run.topicRuns[cur.topic] ?? { stage: 'base' as TopicStage, fu: [], asked: 0, right: 0 };
  const tr: TopicRun = { ...prevRun, fu: [...prevRun.fu], asked: prevRun.asked + 1, right: prevRun.right + (ok ? 1 : 0) };
  let pending = run.pending.filter((p) => !(p.topic === cur.topic && p.role === cur.role));
  let stop = false;
  if (cur.role === 'base' && !ok && tr.stage === 'base') {
    tr.stage = 'follow';
    tr.fu = [];
    const due1 = idx + 2 + (run.seed % 2);
    pending = [...pending, { topic: cur.topic, role: 'f1', due: due1 }, { topic: cur.topic, role: 'f2', due: due1 + 2 }];
  } else if (cur.role === 'f1' || cur.role === 'f2') {
    tr.fu.push(ok);
    if (tr.fu.length === 2) {
      if (!tr.fu[0] && !tr.fu[1]) {
        tr.stage = 'stopped';
        stop = true;
        pending = pending.filter((p) => p.topic !== cur.topic);
      } else {
        tr.stage = 'third';
        pending = [...pending, { topic: cur.topic, role: 'f3', due: answers.length }];
      }
    }
  } else if (cur.role === 'f3') {
    // two or more misses in the topic: not learned, even with a right 3rd question
    tr.stage = ok && wrongIn(answers, cur.topic) < 2 ? 'learned' : 'open';
  }
  const next: SmallRun = { ...run, answers, pending, topicRuns: { ...run.topicRuns, [cur.topic]: tr }, current: null };
  if (stop) return { ...st, run: { ...next, phase: 'stop', stopTopic: cur.topic } };
  return withNext(st, next, pool);
}

function resolveMini(st: SmallState, run: SmallRun, pool: SmallPool, ok: boolean): SmallState {
  const mini = run.mini;
  if (!mini || !run.stopTopic) return st;
  const answers = [...mini.answers, ok];
  const topic = run.stopTopic;
  const tr = run.topicRuns[topic];
  if (answers.length < mini.cur.length) {
    return { ...st, run: { ...run, mini: { ...mini, answers }, current: mini.cur[answers.length] } };
  }
  const topicRuns = { ...run.topicRuns, [topic]: { ...tr, mini: { right: answers.filter(Boolean).length, asked: answers.length } } };
  const miniAnswers = [...(run.miniAnswers ?? []), ...mini.cur.map((c, i) => ({ ...c, ok: answers[i] }))];
  return withNext(st, { ...run, topicRuns, miniAnswers, mini: null, stopTopic: null, current: null }, pool);
}

/** From the stop screen to the lesson (the screen opens the lesson route). */
export function openLesson(st: SmallState): SmallState {
  if (!st.run || st.run.phase !== 'stop') return st;
  return { ...st, run: { ...st.run, phase: 'lesson' } };
}

/** Back from the lesson: the 3-question check of the stopped topic (skipped when the topic has no questions for it). */
export function finishLesson(st: SmallState, pool: SmallPool): SmallState {
  const run = st.run;
  if (!run || run.phase !== 'lesson' || !run.stopTopic) return st;
  const topic = run.stopTopic;
  const picked: SmallCur[] = [];
  for (let i = 0; i < MINI_CHECK_SIZE; i++) {
    const cur = pickQuestion(st, run, topic, 'mini', pool, picked.map((q) => q.qid), picked.map((q) => q.type), 100 + i);
    if (cur) picked.push(cur);
  }
  if (picked.length === 0) return withNext(st, { ...run, stopTopic: null }, pool);
  return { ...st, run: { ...run, phase: 'mini', mini: { cur: picked, answers: [] }, current: picked[0] } };
}

/** "Later, end the round": the round is dropped, nothing of it is kept. */
export function abandonRound(st: SmallState): SmallState {
  return { ...st, run: null };
}

/** "Done" on the end screen. */
export function closeRound(st: SmallState): SmallState {
  return { ...st, run: null };
}

// ---------------------------------------------------------------------------------------------------------------------
// the end of a round

function endRound(st: SmallState, run: SmallRun): SmallState {
  const learned = new Set(st.learned);
  const clean = { ...st.clean };
  for (const tp of run.topics) {
    const tr = run.topicRuns[tp.id];
    if (tr.stage === 'learned') {
      learned.add(tp.id);
      clean[tp.id] = 0;
    } else if (tr.stage === 'stopped') {
      learned.delete(tp.id);
      clean[tp.id] = 0;
    } else if (wrongIn(run.answers, tp.id) >= 2) {
      // two or more misses in the round: the topic is not learned (any more)
      learned.delete(tp.id);
      clean[tp.id] = 0;
    } else if (tr.stage === 'base' && tr.asked > 0 && tr.right === tr.asked) {
      clean[tp.id] = (clean[tp.id] ?? 0) + tr.asked;
      if (clean[tp.id] >= CLEAN_ANSWERS) learned.add(tp.id);
    } else if (tr.asked > 0) {
      clean[tp.id] = 0;
    }
  }
  const right = run.answers.filter((a) => a.ok).length;
  const pct = run.answers.length ? Math.round((right / run.answers.length) * 100) : 0;
  return {
    ...st,
    learned: [...learned],
    clean,
    history: [...st.history, pct].slice(-HISTORY_MAX),
    recent: [...st.recent, ...run.answers.map((a) => a.qid)].slice(-RECENT_QUESTIONS),
    run: { ...run, phase: 'end', current: null, mini: null, stopTopic: null },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// the practice after a round (not compulsory: closeRound and a new round work without it)

/**
 * The practice list of the finished round: every question answered wrong once, in the order of the answers; after the last
 * miss of a topic with 2+ misses (a stopped one too) DRILL_EXTRA new questions of that topic (the writing types first); at
 * most DRILL_MAX, the end is cut. A question that is no longer in the content is left out.
 */
export function drillList(st: SmallState, pool: SmallPool): SmallCur[] {
  const run = st.run;
  if (!run) return [];
  const mini = (run.miniAnswers ?? []).filter((a) => !a.ok);
  const asked = new Set([...run.answers, ...(run.miniAnswers ?? [])].map((a) => a.qid));
  const misses = run.answers.filter((a) => !a.ok);
  const lastMiss = (topic: string) => {
    let at = -1;
    misses.forEach((m, i) => {
      if (m.topic === topic) at = i;
    });
    return at;
  };
  const list: SmallCur[] = [];
  const taken = new Set<string>();
  // the wrong answers of the topic's quick check come after its misses of the round, before the new questions
  const addMini = (topic: string) =>
    mini.filter((m) => m.topic === topic && !taken.has(m.qid) && pool(topic).some((q) => q.id === m.qid)).forEach((m) => {
      taken.add(m.qid);
      list.push({ topic, qid: m.qid, type: m.type, role: 'drill' });
    });
  misses.forEach((m, i) => {
    if (!taken.has(m.qid) && pool(m.topic).some((q) => q.id === m.qid)) {
      taken.add(m.qid);
      list.push({ topic: m.topic, qid: m.qid, type: m.type, role: 'drill' });
    }
    if (lastMiss(m.topic) === i) addMini(m.topic);
    if (lastMiss(m.topic) === i && wrongIn(run.answers, m.topic) >= 2) {
      const fresh = shuffleArray(pool(m.topic).filter((q) => !asked.has(q.id) && !taken.has(q.id)), run.seed * 19 + i)
        .map((q, k) => ({ q, k, hard: HARD_TYPES.includes(q.type) ? 0 : 1 }))
        .sort((a, b) => a.hard - b.hard || a.k - b.k)
        .slice(0, DRILL_EXTRA);
      for (const { q } of fresh) {
        taken.add(q.id);
        list.push({ topic: m.topic, qid: q.id, type: q.type, role: 'drill' });
      }
    }
  });
  for (const topic of new Set(mini.map((m) => m.topic))) if (lastMiss(topic) < 0) addMini(topic);
  return list.slice(0, DRILL_MAX);
}

/** From the end screen into the practice (nothing happens with an empty list). */
export function startDrill(st: SmallState, pool: SmallPool): SmallState {
  const run = st.run;
  if (!run || run.phase !== 'end') return st;
  const list = drillList(st, pool);
  if (list.length === 0) return st;
  return { ...st, run: { ...run, phase: 'drill', drill: { list, i: 0, right: 0 }, drilled: undefined, current: list[0], shown: undefined } };
}

// the practice goes on from index `from` (a question that is gone is skipped), or ends with its result
function nextDrill(st: SmallState, run: SmallRun, pool: SmallPool, from: number, right: number): SmallState {
  const list = run.drill?.list ?? [];
  let j = from;
  while (j < list.length && !pool(list[j].topic).some((q) => q.id === list[j].qid)) j++;
  if (j >= list.length) return { ...st, run: { ...run, phase: 'end', current: null, drill: undefined, drilled: { right, total: list.length } } };
  return { ...st, run: { ...run, phase: 'drill', current: list[j], drill: { list, i: j, right } } };
}

/** A practice answer: a miss goes into the miss log (a right one does not count, it is the same round); the topic log, learned and clean stay. */
export function resolveDrill(st: SmallState, pool: SmallPool, ok: boolean): SmallState {
  const run = st.run && st.run.shown ? { ...st.run, shown: undefined } : st.run;
  if (!run || run.phase !== 'drill' || !run.drill || !run.current) return st;
  const cur = run.current;
  const gaps = ok ? st.gaps : addGap(st.gaps, cur, run.round);
  return nextDrill({ ...st, gaps }, run, pool, run.drill.i + 1, run.drill.right + (ok ? 1 : 0));
}

export type RowStatus = 'learned' | 'more' | 'lesson';

export interface SmallRow {
  id: string;
  status: RowStatus;
  /** The topic's right answers over its asked ones in this round. */
  right: number;
  asked: number;
}

/** One row per topic of the finished round: learned (green), one more round (yellow), lesson first (red). */
export function roundRows(st: SmallState): SmallRow[] {
  const run = st.run;
  if (!run) return [];
  const learned = new Set(st.learned);
  return run.topics.map((tp) => {
    const tr = run.topicRuns[tp.id];
    const status: RowStatus = learned.has(tp.id) ? 'learned' : tr.stage === 'stopped' && (tr.mini?.right ?? 0) < 2 ? 'lesson' : 'more';
    return { id: tp.id, status, right: tr.right, asked: tr.asked };
  });
}

export const roundRight = (run: SmallRun): number => run.answers.filter((a) => a.ok).length;

/** The learned core topics over all core topics (ids not in the list do not count). */
export function levelProgress(st: SmallState, coreIds: string[]): { learned: number; total: number } {
  const learned = new Set(st.learned);
  return { learned: coreIds.filter((id) => learned.has(id)).length, total: coreIds.length };
}

/** The level is done when every core topic is learned. */
export function isLevelDone(st: SmallState, coreIds: string[]): boolean {
  const p = levelProgress(st, coreIds);
  return p.total > 0 && p.learned === p.total;
}

/** The open items of the miss log. */
export const gapCount = (st: SmallState): number => Object.keys(st.gaps).length;

/** The level is clean: done, no open miss, every usable topic (core or not) learned and none of them weak. */
export function isLevelClean(st: SmallState, usableIds: string[], coreIds: string[]): boolean {
  const learned = new Set(st.learned);
  return isLevelDone(st, coreIds) && gapCount(st) === 0 && usableIds.every((id) => learned.has(id) && !isWeakTopic(st, id));
}
