import type { DB } from '@/lib/database';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { shuffleArray } from '@/lib/shuffle';
import type { GrammarKind } from '@/lib/games/content';
import { TASK_TYPE_IDS, type TaskTypeId } from './taskTypes';

// The grammar Small test (one per level, "A1 test"): 10 questions per round, every round a new mix of the level's topics
// (the core topics first), adaptive: a miss brings 2 more questions of that topic within the next 5 (never right after each
// other); both right -> a 3rd, right -> learned; mixed -> a 3rd; both wrong -> the test stops, the lesson opens, a 3-question
// check follows and the test goes on where it was. The level is done when every core topic is learned. Everything here is
// pure (no React); the screen is app/grammar/small-test.tsx. The state lives in the resume store.
//
// How a topic is learned (decided here, the spec names only the miss path): miss -> 2 right -> 3rd right, or mixed -> 3rd
// right; or 3 right answers in a row on the topic without a miss, counted across rounds (a topic that is never missed would
// never be learned otherwise; a miss resets the count). A topic that stops the test loses its learned mark.

export const SMALL_TEST_SIZE = 10;
export const SMALL_TEST_TOPICS = 6;
export const MINI_CHECK_SIZE = 3;
const RECENT_TYPES = 6;
const RECENT_QUESTIONS = 60;
const HISTORY_MAX = 12;
const CLEAN_ANSWERS = 3;

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

export type SmallRole = 'base' | 'f1' | 'f2' | 'f3' | 'mini';

export interface SmallCur {
  topic: string;
  qid: string;
  type: TaskTypeId;
  role: SmallRole;
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

export type SmallPhase = 'intro' | 'ask' | 'stop' | 'lesson' | 'mini' | 'end';

export interface SmallRun {
  round: number;
  seed: number;
  phase: SmallPhase;
  topics: { id: string; isNew: boolean }[];
  topicRuns: Record<string, TopicRun>;
  answers: SmallAnswer[];
  pending: Pending[];
  current: SmallCur | null;
  stopTopic: string | null;
  mini: { cur: SmallCur[]; answers: boolean[] } | null;
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
}

export const newSmallState = (): SmallState => ({ v: 1, learned: [], clean: {}, seen: [], history: [], recent: [], rounds: 0, run: null });

export const smallKey = (pair: string, level: string): string => `grammar-small-test:${pair}:${level}`;

const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []);

/** A saved state, or a fresh one when the value is missing or damaged. */
export function parseSmallState(raw: unknown): SmallState {
  const r = raw as Partial<SmallState> | null | undefined;
  if (!r || typeof r !== 'object' || r.v !== 1 || !Array.isArray(r.learned) || !Array.isArray(r.seen) || !Array.isArray(r.history)) return newSmallState();
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries((r.clean ?? {}) as Record<string, unknown>)) if (typeof v === 'number' && Number.isFinite(v)) clean[k] = v;
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
    run: okRun && whole ? { ...(run as SmallRun), pending: Array.isArray(run!.pending) ? run!.pending : [], mini: run!.mini ?? null, stopTopic: run!.stopTopic ?? null, current: run!.current ?? null } : null,
  };
}

export async function loadSmallState(db: DB, pair: string, level: string): Promise<SmallState> {
  return parseSmallState(await loadResumeValue(db, smallKey(pair, level)));
}

export async function saveSmallState(db: DB, pair: string, level: string, st: SmallState): Promise<boolean> {
  return saveResumeValue(db, smallKey(pair, level), st);
}

// ---------------------------------------------------------------------------------------------------------------------
// the round's topics

/** A new round (phase 'intro'): up to SMALL_TEST_TOPICS topics, unlearned core first, then learned core, then the others; new ones first inside a group. */
export function startRound(st: SmallState, topics: SmallTopicInfo[], pool: SmallPool, seed: number): SmallState {
  const usable = topics.filter((tp) => pool(tp.id).length > 0);
  const learned = new Set(st.learned);
  const seen = new Set(st.seen);
  const group = (list: SmallTopicInfo[], salt: number) =>
    shuffleArray(list, seed + salt)
      .map((tp, i) => ({ tp, i }))
      .sort((a, b) => Number(seen.has(a.tp.id)) - Number(seen.has(b.tp.id)) || a.i - b.i)
      .map((x) => x.tp);
  const order = [
    ...group(usable.filter((tp) => tp.core && !learned.has(tp.id)), 1),
    ...group(usable.filter((tp) => tp.core && learned.has(tp.id)), 2),
    ...group(usable.filter((tp) => !tp.core), 3),
  ].slice(0, SMALL_TEST_TOPICS);
  const picked = shuffleArray(order, seed + 4);
  const run: SmallRun = {
    round: st.rounds + 1,
    seed,
    phase: 'intro',
    topics: picked.map((tp) => ({ id: tp.id, isNew: !seen.has(tp.id) })),
    topicRuns: Object.fromEntries(picked.map((tp) => [tp.id, { stage: 'base' as TopicStage, fu: [], asked: 0, right: 0 }])),
    answers: [],
    pending: [],
    current: null,
    stopTopic: null,
    mini: null,
  };
  return { ...st, rounds: st.rounds + 1, seen: [...new Set([...st.seen, ...picked.map((tp) => tp.id)])], run };
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
  return st;
}

/** From the intro to the first question. */
export function beginRound(st: SmallState, pool: SmallPool): SmallState {
  if (!st.run || st.run.phase !== 'intro') return st;
  return withNext(st, { ...st.run, phase: 'ask' }, pool);
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
  const all = pool(topic);
  const used = new Set([...run.answers.map((a) => a.qid), ...taken]);
  let cands = all.filter((q) => !used.has(q.id));
  if (cands.length === 0) {
    const last = run.answers.length ? run.answers[run.answers.length - 1].qid : '';
    cands = all.filter((q) => q.id !== last && !taken.includes(q.id));
  }
  if (cands.length === 0) return null;
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

// The next question of the round: a due follow-up (never of the topic that was just asked, when something else can come),
// else the next base question: the round's topic with the fewest answers that is still in its base stage.
function pickNext(st: SmallState, run: SmallRun, pool: SmallPool): SmallCur | null {
  const n = run.answers.length;
  const prev = n > 0 ? run.answers[n - 1].topic : '';
  const due = run.pending
    .filter((p) => p.due <= n && !(p.role === 'f2' && run.pending.some((o) => o.topic === p.topic && o.role === 'f1')))
    .sort((a, b) => a.due - b.due);
  const other = due.filter((p) => p.topic !== prev);
  const wantsFollow = other.length > 0 ? other : due.length > 0 && !hasBaseElsewhere(run, prev, pool) ? due : [];
  for (const p of wantsFollow) {
    const first = run.answers.find((a) => a.topic === p.topic);
    const cur = pickQuestion(st, run, p.topic, p.role, pool, [], first ? [first.type] : [], n);
    if (cur) return cur;
  }
  const order = run.topics.map((tp) => tp.id);
  const eligible = order.filter((id) => run.topicRuns[id].stage === 'base' && pool(id).length > 0);
  const ranked = (list: string[]) => list.map((id, i) => ({ id, i, asked: run.topicRuns[id].asked })).sort((a, b) => a.asked - b.asked || a.i - b.i).map((x) => x.id);
  const away = ranked(eligible.filter((id) => id !== prev));
  for (const id of [...away, ...ranked(eligible.filter((id) => id === prev))]) {
    const cur = pickQuestion(st, run, id, 'base', pool, [], [], n);
    if (cur) return cur;
  }
  // nothing in a base stage is left: any topic of the round that still has an unasked question
  for (const id of ranked(order.filter((x) => x !== prev).concat(order.filter((x) => x === prev)))) {
    const cur = pickQuestion(st, run, id, 'base', pool, [], [], n);
    if (cur) return cur;
  }
  return null;
}

function hasBaseElsewhere(run: SmallRun, prev: string, pool: SmallPool): boolean {
  return run.topics.some((tp) => tp.id !== prev && run.topicRuns[tp.id].stage === 'base' && pool(tp.id).length > 0);
}

// ---------------------------------------------------------------------------------------------------------------------
// answering

function withNext(st: SmallState, run: SmallRun, pool: SmallPool): SmallState {
  if (run.answers.length >= SMALL_TEST_SIZE) return endRound(st, run);
  const cur = pickNext(st, run, pool);
  if (!cur) return endRound(st, run);
  return { ...st, run: { ...run, phase: 'ask', current: cur } };
}

/**
 * The current question is settled: `ok` is the result (a typo the learner owned up to counts as right, `mistyped`). The
 * topic's state moves on, the follow-ups are planned, and the next question, the stop, the end of the round or the next
 * question of the mini check follows.
 */
export function resolveAnswer(st: SmallState, pool: SmallPool, ok: boolean, mistyped = false): SmallState {
  const run = st.run;
  if (!run || !run.current) return st;
  if (run.phase === 'mini') return resolveMini(st, run, pool, ok);
  if (run.phase !== 'ask') return st;
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
    tr.stage = ok ? 'learned' : 'open';
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
  return withNext(st, { ...run, topicRuns, mini: null, stopTopic: null, current: null }, pool);
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
