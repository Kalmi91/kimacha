// Random grammar round (Grammar tab): the pure engine, no React, no DB. A round
// is a "mixed" round (10 check questions on a level ladder, 8 practice questions
// on the weak topics, 1 re-check question per weak topic) or a "full" round (20
// questions spread over the whole syllabus). Every answer is also kept as
// per-topic evidence (the last EVIDENCE_WINDOW answers) that feeds the lesson
// row badge and the tick.
//
// Storage is the existing `game_progress` table under its OWN game key, so the
// code that reads the `grammar-course` rows never sees these rows:
//   `${topicId}`  state 'evidence'  data TopicEvidence
//   `_meta`       state 'meta'      data RandomMeta
//   `_run`        state 'run'       data RoundRun   (open round; closed: state 'none', data null)

import type { Level } from '@/data/words';
import type { GrammarKind } from '@/lib/games/content';
import type { GrammarTier } from '@/lib/grammar/syllabus';
import { shuffleArray } from '@/lib/shuffle';

export const GRAMMAR_RANDOM_KEY = 'grammar-random';
export const META_ITEM_ID = '_meta';
export const RUN_ITEM_ID = '_run';

export const CHECK_SIZE = 10;
export const PRACTICE_SIZE = 8;
export const MAX_WEAK_TOPICS = 3;
export const FULL_SIZE = 20;
export const FULL_EVERY = 5;
export const EVIDENCE_WINDOW = 10;
export const MIN_ANSWERS_FOR_PCT = 3;
export const TICK_PCT = 80;
export const TICK_MIN_ANSWERS = 5;
export const TICK_MIN_KINDS = 2;
export const WEAK_PCT = 60;

/** The kinds an evidence answer can have: a lesson item kind, or `cloze` (a gap of the exam round, no lesson item has it). */
export type EvidenceKind = GrammarKind | 'cloze';

/** `at` is `localDateString()` of the answer. */
export interface EvidenceAnswer {
  id: string;
  kind: EvidenceKind;
  ok: boolean;
  at: string;
}

/** Oldest first, at most EVIDENCE_WINDOW answers. */
export interface TopicEvidence {
  answers: EvidenceAnswer[];
  /** When the topic was last answered (ms, `Date.now()`); absent in evidence saved before. The level test asks the least recently asked topic first. */
  stamp?: number;
  /** The question ids asked in the topic's current pass over its questions (FB595); absent in evidence saved before, then the window's ids count. */
  seen?: string[];
}

export type RoundMode = 'mixed' | 'full';
export type RoundPhase = 'check' | 'practice' | 'recheck' | 'full' | 'done';
export type AskPhase = Exclude<RoundPhase, 'done'>;

export interface RoundStep {
  topicId: string;
  qid: string;
  kind: GrammarKind;
  level: Level;
  phase: AskPhase;
  ok: boolean;
}

export interface RoundRun {
  mode: RoundMode;
  seed: number;
  startLevel: Level;
  /** Answered questions in order. */
  steps: RoundStep[];
  /** The question on screen (to resume the round). */
  pending: { topicId: string; qid: string } | null;
  /** Weak topics fixed at the end of the check (mixed only). */
  weak: string[];
  /** topicPercent of the weak topics at the end of the check. */
  before: Record<string, number | null>;
  /** Phases that ran out of unused questions. */
  skipped: AskPhase[];
}

/** `rounds` = number of finished rounds. */
export interface RandomMeta {
  rounds: number;
}

export interface PickTopic {
  id: string;
  level: Level;
  tier: GrammarTier;
}

export interface PickCtx {
  /** The syllabus levels of the learned language, in order. */
  levels: Level[];
  /** Written lessons that have usable questions. */
  topics: PickTopic[];
  /** ALREADY updated with the latest answer. */
  evidence: Map<string, TopicEvidence>;
  /** Usable questions of a topic. */
  questionIds: (topicId: string) => { id: string; kind: GrammarKind }[];
}

interface ProgressRow {
  itemId: string;
  state: string;
  data: unknown;
}

const TIER_ORDER: GrammarTier[] = ['core-plus', 'core', 'exam', 'full', 'perfect'];
const TIER_BONUS: Record<GrammarTier, number> = { 'core-plus': 0.6, core: 0.4, exam: 0.2, full: 0, perfect: 0 };
const ASK_PHASES: readonly string[] = ['check', 'practice', 'recheck', 'full'];

const tierRank = (tier: GrammarTier | undefined): number => {
  const i = tier ? TIER_ORDER.indexOf(tier) : -1;
  return i < 0 ? TIER_ORDER.length : i;
};

const windowOf = (ev?: TopicEvidence): EvidenceAnswer[] => (ev ? ev.answers.slice(-EVIDENCE_WINDOW) : []);

/** `null` below MIN_ANSWERS_FOR_PCT answers, otherwise the rounded percent over the window. */
export function topicPercent(ev?: TopicEvidence): number | null {
  const w = windowOf(ev);
  if (w.length < MIN_ANSWERS_FOR_PCT) return null;
  return Math.round((w.filter((a) => a.ok).length / w.length) * 100);
}

/**
 * Ticked: enough answers, a high enough percent, and at least two different exercise kinds. `kindCount` is the number
 * of kinds the topic has questions of: a topic with fewer than TICK_MIN_KINDS (a lesson of one kind) ticks with the
 * kinds it has, or it could never tick. It is only called when it decides the result.
 */
export function topicTicked(ev?: TopicEvidence, kindCount?: () => number): boolean {
  const w = windowOf(ev);
  if (w.length < TICK_MIN_ANSWERS) return false;
  const pct = topicPercent(ev);
  if (pct === null || pct < TICK_PCT) return false;
  const kinds = new Set(w.map((a) => a.kind)).size;
  if (kinds >= TICK_MIN_KINDS) return true;
  return kindCount !== undefined && kinds >= Math.max(1, Math.min(TICK_MIN_KINDS, kindCount()));
}

/** The question ids asked in the topic's current pass (at most SEEN_CAP). */
export const seenIds = (ev?: TopicEvidence): string[] => (ev ? ev.seen ?? ev.answers.map((x) => x.id) : []);

export const SEEN_CAP = 200;

/**
 * Appends one answer, only the last EVIDENCE_WINDOW stay. `stamp` is when it happened. `qids` (the topic's current question
 * ids, when the caller knows them) lets the pass over the questions run on: ids that are no longer among them are dropped,
 * and when every one of them was already asked the pass starts again with this answer. Without `qids` the id is only added.
 */
export function appendEvidence(ev: TopicEvidence | undefined, a: EvidenceAnswer, stamp: number = Date.now(), qids?: string[]): TopicEvidence {
  let seen = seenIds(ev);
  if (qids) {
    const known = new Set(qids);
    seen = seen.filter((id) => known.has(id));
    if (qids.length > 0 && qids.every((id) => seen.includes(id))) seen = [];
  }
  if (!seen.includes(a.id)) seen = [...seen, a.id];
  return { answers: [...(ev?.answers ?? []), a].slice(-EVIDENCE_WINDOW), stamp, seen: seen.slice(-SEEN_CAP) };
}

function isEvidenceAnswer(v: unknown): v is EvidenceAnswer {
  const o = v as EvidenceAnswer | null;
  return !!o && typeof o.id === 'string' && typeof o.kind === 'string' && typeof o.ok === 'boolean' && typeof o.at === 'string';
}

function isTopicEvidence(v: unknown): v is TopicEvidence {
  const o = v as TopicEvidence | null;
  return (
    !!o &&
    Array.isArray(o.answers) &&
    o.answers.every(isEvidenceAnswer) &&
    (o.stamp === undefined || (typeof o.stamp === 'number' && Number.isFinite(o.stamp))) &&
    (o.seen === undefined || (Array.isArray(o.seen) && o.seen.every((x) => typeof x === 'string')))
  );
}

function isRandomMeta(v: unknown): v is RandomMeta {
  const o = v as RandomMeta | null;
  return !!o && typeof o.rounds === 'number';
}

function isRoundStep(v: unknown): v is RoundStep {
  const o = v as RoundStep | null;
  return (
    !!o &&
    typeof o.topicId === 'string' &&
    typeof o.qid === 'string' &&
    typeof o.kind === 'string' &&
    typeof o.level === 'string' &&
    ASK_PHASES.includes(o.phase) &&
    typeof o.ok === 'boolean'
  );
}

function isRoundRun(v: unknown): v is RoundRun {
  const o = v as RoundRun | null;
  return (
    !!o &&
    (o.mode === 'mixed' || o.mode === 'full') &&
    typeof o.seed === 'number' &&
    typeof o.startLevel === 'string' &&
    Array.isArray(o.steps) &&
    o.steps.every(isRoundStep) &&
    (o.pending === null || (!!o.pending && typeof o.pending.topicId === 'string' && typeof o.pending.qid === 'string')) &&
    Array.isArray(o.weak) &&
    o.weak.every((t) => typeof t === 'string') &&
    !!o.before &&
    typeof o.before === 'object' &&
    !Array.isArray(o.before) &&
    Object.values(o.before).every((p) => p === null || typeof p === 'number') &&
    Array.isArray(o.skipped) &&
    o.skipped.every((p) => ASK_PHASES.includes(p))
  );
}

/** The per-topic evidence from the game_progress rows (`_`-prefixed item ids are not topics). */
export function evidenceFromRows(rows: ProgressRow[]): Map<string, TopicEvidence> {
  const out = new Map<string, TopicEvidence>();
  for (const row of rows) {
    if (row.state !== 'evidence' || row.itemId.startsWith('_')) continue;
    if (isTopicEvidence(row.data)) out.set(row.itemId, row.data);
  }
  return out;
}

/** The round counter, `{ rounds: 0 }` when there is no (valid) row. */
export function metaFromRows(rows: ProgressRow[]): RandomMeta {
  for (const row of rows) {
    if (row.itemId === META_ITEM_ID && row.state === 'meta' && isRandomMeta(row.data)) return { rounds: row.data.rounds };
  }
  return { rounds: 0 };
}

/** The open round, `null` when there is none (or its shape is wrong). */
export function runFromRows(rows: ProgressRow[]): RoundRun | null {
  for (const row of rows) {
    if (row.itemId === RUN_ITEM_ID && row.state === 'run' && isRoundRun(row.data)) return row.data;
  }
  return null;
}

/** The first round (0 finished) and every FULL_EVERY-th one is a full round. */
export function nextMode(meta: RandomMeta): RoundMode {
  return meta.rounds % FULL_EVERY === 0 ? 'full' : 'mixed';
}

export function newRun(mode: RoundMode, seed: number, startLevel: Level): RoundRun {
  return { mode, seed, startLevel, steps: [], pending: null, weak: [], before: {}, skipped: [] };
}

const countPhase = (run: RoundRun, phase: AskPhase): number => run.steps.filter((s) => s.phase === phase).length;

/**
 * The check ladder: starts at the start level, two correct in a row go one level up (ceiling: the
 * last level), a wrong answer goes one level down (floor: the first level).
 */
export function ladderIndex(run: RoundRun, levels: Level[]): number {
  const top = Math.max(levels.length - 1, 0);
  let idx = Math.max(levels.indexOf(run.startLevel), 0);
  let streak = 0;
  for (const s of run.steps) {
    if (s.phase !== 'check') continue;
    if (s.ok) {
      streak += 1;
      if (streak === 2) {
        idx = Math.min(idx + 1, top);
        streak = 0;
      }
    } else {
      idx = Math.max(idx - 1, 0);
      streak = 0;
    }
  }
  return idx;
}

export function ladderLevel(run: RoundRun, levels: Level[]): Level {
  return levels[ladderIndex(run, levels)] ?? run.startLevel;
}

/** The phase the next question belongs to; a phase in `skipped` is passed over. */
export function currentPhase(run: RoundRun): RoundPhase {
  if (run.mode === 'full') {
    return run.steps.length < FULL_SIZE && !run.skipped.includes('full') ? 'full' : 'done';
  }
  if (countPhase(run, 'check') < CHECK_SIZE && !run.skipped.includes('check')) return 'check';
  if (run.weak.length === 0) return 'done';
  if (countPhase(run, 'practice') < PRACTICE_SIZE && !run.skipped.includes('practice')) return 'practice';
  if (countPhase(run, 'recheck') < run.weak.length && !run.skipped.includes('recheck')) return 'recheck';
  return 'done';
}

/** `index` = answered questions of the current phase, `of` = its size. */
export function phaseProgress(run: RoundRun): { phase: RoundPhase; index: number; of: number } {
  const phase = currentPhase(run);
  switch (phase) {
    case 'check':
      return { phase, index: countPhase(run, 'check'), of: CHECK_SIZE };
    case 'practice':
      return { phase, index: countPhase(run, 'practice'), of: PRACTICE_SIZE };
    case 'recheck':
      return { phase, index: countPhase(run, 'recheck'), of: run.weak.length };
    case 'full':
      return { phase, index: countPhase(run, 'full'), of: FULL_SIZE };
    default:
      return { phase, index: 0, of: 0 };
  }
}

// Fixes the weak topics from the check steps: topics with a wrong answer, most wrong first, then the lowest
// percent, then the tier, then the first occurrence. No wrong answer at all: the below-tick topics at or under
// the ladder level (lowest percent first).
function withWeak(run: RoundRun, ctx: PickCtx): RoundRun {
  const order: string[] = [];
  const wrong = new Map<string, number>();
  for (const s of run.steps) {
    if (s.phase !== 'check') continue;
    if (!wrong.has(s.topicId)) {
      wrong.set(s.topicId, 0);
      order.push(s.topicId);
    }
    if (!s.ok) wrong.set(s.topicId, (wrong.get(s.topicId) ?? 0) + 1);
  }
  const pctOf = (id: string) => topicPercent(ctx.evidence.get(id)) ?? 0;
  const rankOf = (id: string) => tierRank(ctx.topics.find((t) => t.id === id)?.tier);
  let weak = order
    .map((id, i) => ({ id, i }))
    .filter(({ id }) => (wrong.get(id) ?? 0) > 0)
    .sort(
      (a, b) =>
        (wrong.get(b.id) ?? 0) - (wrong.get(a.id) ?? 0) ||
        pctOf(a.id) - pctOf(b.id) ||
        rankOf(a.id) - rankOf(b.id) ||
        a.i - b.i,
    )
    .slice(0, MAX_WEAK_TOPICS)
    .map(({ id }) => id);
  if (weak.length === 0) {
    const cap = ladderIndex(run, ctx.levels);
    weak = ctx.topics
      .map((t, i) => ({ id: t.id, pct: topicPercent(ctx.evidence.get(t.id)), li: ctx.levels.indexOf(t.level), i }))
      .filter((x) => x.li >= 0 && x.li <= cap && x.pct !== null && x.pct < TICK_PCT)
      .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0) || a.i - b.i)
      .slice(0, MAX_WEAK_TOPICS)
      .map((x) => x.id);
  }
  const before: Record<string, number | null> = {};
  for (const id of weak) before[id] = topicPercent(ctx.evidence.get(id));
  return { ...run, weak, before };
}

/**
 * Topics with a wrong answer in the round that are not in `weak` (the weak list is capped at MAX_WEAK_TOPICS),
 * in the order they were first asked wrong. The result and end screens list them as tappable rows.
 */
export function otherWrongTopics(run: RoundRun): string[] {
  const out: string[] = [];
  for (const s of run.steps) if (!s.ok && !run.weak.includes(s.topicId) && !out.includes(s.topicId)) out.push(s.topicId);
  return out;
}

/**
 * Appends the answered step and clears `pending`. When the check just reached CHECK_SIZE in a
 * mixed round, the weak topics (and their `before` percents) are fixed.
 */
export function recordAnswer(run: RoundRun, step: RoundStep, ctx: PickCtx): RoundRun {
  const next: RoundRun = { ...run, steps: [...run.steps, step], pending: null };
  if (run.mode === 'mixed' && step.phase === 'check' && countPhase(next, 'check') === CHECK_SIZE) {
    return withWeak(next, ctx);
  }
  return next;
}

/**
 * The current phase has no more unused questions: pass it over (the screen calls this when `pickNext`
 * is null). Skipping the check of a mixed round fixes the weak topics from the check steps so far.
 * (`ctx` is needed for that, the spec's `skipPhase(run)` has no way to get the evidence.)
 */
export function skipPhase(run: RoundRun, ctx: PickCtx): RoundRun {
  const phase = currentPhase(run);
  if (phase === 'done') return run;
  const next: RoundRun = { ...run, skipped: [...run.skipped, phase] };
  return run.mode === 'mixed' && phase === 'check' ? withWeak(next, ctx) : next;
}

// The used set of a round holds `topicId:qid` keys: lesson item ids are not guaranteed to be unique across lessons.
const usedKey = (topicId: string, qid: string): string => `${topicId}:${qid}`;

// A question of the topic: unused in this round, preferably one that is not in the topic's evidence yet,
// within that preferably a kind that this round has not asked at this topic yet; seeded random among those.
function questionFor(topicId: string, run: RoundRun, ctx: PickCtx, used: Set<string>, seed: number): string | null {
  const free = ctx.questionIds(topicId).filter((q) => !used.has(usedKey(topicId, q.id)));
  if (free.length === 0) return null;
  const seen = new Set((ctx.evidence.get(topicId)?.answers ?? []).map((a) => a.id));
  const fresh = free.filter((q) => !seen.has(q.id));
  const pool = fresh.length > 0 ? fresh : free;
  const kindsDone = new Set(run.steps.filter((s) => s.topicId === topicId).map((s) => s.kind));
  const newKind = pool.filter((q) => !kindsDone.has(q.kind));
  return shuffleArray(newKind.length > 0 ? newKind : pool, seed)[0].id;
}

const hasFree = (topicId: string, ctx: PickCtx, used: Set<string>): boolean =>
  ctx.questionIds(topicId).some((q) => !used.has(usedKey(topicId, q.id)));

// Check: a topic of the ladder level (else the nearest level with one, the lower on a tie), scored by how
// much the learner needs it, the previous step's topic left out when there is another candidate. A topic
// without any answer in its evidence always comes first: while one has a free question, only those are
// candidates (so the nearest level that has one is used before any answered topic is asked again).
function pickCheckTopic(run: RoundRun, ctx: PickCtx, used: Set<string>, seed: number): string | null {
  const idx = ladderIndex(run, ctx.levels);
  const levelOrder = ctx.levels.map((_, i) => i).sort((a, b) => Math.abs(a - idx) - Math.abs(b - idx) || a - b);
  const prev = run.steps.length > 0 ? run.steps[run.steps.length - 1].topicId : undefined;
  const neverAnswered = ctx.topics.filter(
    (t) => ctx.levels.includes(t.level) && (ctx.evidence.get(t.id)?.answers.length ?? 0) === 0 && hasFree(t.id, ctx, used),
  );
  const pool = neverAnswered.length > 0 ? neverAnswered : ctx.topics;
  for (const li of levelOrder) {
    const level = ctx.levels[li];
    const all = pool.filter((t) => t.level === level && hasFree(t.id, ctx, used));
    if (all.length === 0) continue;
    const others = all.filter((t) => t.id !== prev);
    const cands = others.length > 0 ? others : all;
    const score = (t: PickTopic): number => {
      const pct = topicPercent(ctx.evidence.get(t.id));
      const base = pct === null ? 2 : pct < WEAK_PCT ? 3 : pct < TICK_PCT ? 2 : 1;
      const asked = run.steps.filter((s) => s.topicId === t.id).length;
      return base + (TIER_BONUS[t.tier] ?? 0) - asked;
    };
    let best: PickTopic | null = null;
    let bestScore = -Infinity;
    for (const t of shuffleArray(cands, seed)) {
      const sc = score(t);
      if (sc > bestScore) {
        best = t;
        bestScore = sc;
      }
    }
    return best ? best.id : null;
  }
  return null;
}

// Practice: the weak topics in turn, the next one when a topic has no unused question left.
function pickPracticeTopic(run: RoundRun, ctx: PickCtx, used: Set<string>): string | null {
  const n = run.weak.length;
  const done = countPhase(run, 'practice');
  for (let k = 0; k < n; k++) {
    const id = run.weak[(done + k) % n];
    if (hasFree(id, ctx, used)) return id;
  }
  return null;
}

// Re-check: one question per weak topic, in the order of `weak`. A weak topic without a free question is left
// out (the next one is asked); `null` when no unchecked weak topic has one, then the screen passes the phase over.
function pickRecheckTopic(run: RoundRun, ctx: PickCtx, used: Set<string>): string | null {
  const checked = new Set(run.steps.filter((s) => s.phase === 'recheck').map((s) => s.topicId));
  return run.weak.find((id) => !checked.has(id) && hasFree(id, ctx, used)) ?? null;
}

// Full: fill the topics started in this round up to MIN_ANSWERS_FOR_PCT answers, then start a new topic (a
// never-answered one first) in the level with the fewest started topics; when no topic needs answers any more, the topics whose last
// answer is the oldest (at most 2 questions per topic in the round).
function pickFullTopic(run: RoundRun, ctx: PickCtx, used: Set<string>, seed: number): string | null {
  const answersOf = (id: string) => windowOf(ctx.evidence.get(id)).length;
  const demand = (id: string) => Math.max(0, MIN_ANSWERS_FOR_PCT - answersOf(id));
  // Last answer's date as YYYYMMDD, 0 = no answer yet (sorts first).
  const lastAt = (id: string) => {
    const a = windowOf(ctx.evidence.get(id));
    return a.length > 0 ? Number(a[a.length - 1].at.replace(/\D/g, '')) || 0 : 0;
  };
  const prev = run.steps.length > 0 ? run.steps[run.steps.length - 1].topicId : undefined;
  const startedLevel = new Map<string, Level>();
  for (const s of run.steps) if (!startedLevel.has(s.topicId)) startedLevel.set(s.topicId, s.level);
  const available = ctx.topics.filter((t) => hasFree(t.id, ctx, used));

  const startedNeedy = [...startedLevel.keys()].filter((id) => demand(id) > 0 && available.some((t) => t.id === id));
  // Only the previous step's topic is left among the started ones: a new topic goes between (A B A B A B, C D C D C D),
  // the same topic again only when no other topic needs answers.
  const startNew = startedNeedy.length > 0 && startedNeedy.every((id) => id === prev) && available.some((t) => t.id !== prev && demand(t.id) > 0);
  if (startedNeedy.length > 0 && !startNew) {
    const others = startedNeedy.filter((id) => id !== prev);
    return (others.length > 0 ? others : startedNeedy)[0];
  }

  const lowest = (topics: PickTopic[], key: (t: PickTopic) => number[]): string | null => {
    let best: PickTopic | null = null;
    let bestKey: number[] = [];
    for (const t of shuffleArray(topics, seed)) {
      const k = key(t);
      let less = best === null;
      for (let i = 0; !less && i < k.length; i++) {
        if (k[i] < bestKey[i]) less = true;
        else if (k[i] > bestKey[i]) break;
      }
      if (less) {
        best = t;
        bestKey = k;
      }
    }
    return best ? best.id : null;
  };

  const fresh = available.filter((t) => demand(t.id) > 0 && !(startNew && t.id === prev));
  if (fresh.length > 0) {
    const perLevel = new Map<Level, number>();
    for (const lv of startedLevel.values()) perLevel.set(lv, (perLevel.get(lv) ?? 0) + 1);
    // A topic with no answer at all comes before one with 1-2 answers, then the level spread applies.
    return lowest(fresh, (t) => [answersOf(t.id) > 0 ? 1 : 0, perLevel.get(t.level) ?? 0, answersOf(t.id), lastAt(t.id), tierRank(t.tier)]);
  }

  const inRound = (id: string) => run.steps.filter((s) => s.topicId === id).length;
  return lowest(
    available.filter((t) => inRound(t.id) < 2),
    (t) => [lastAt(t.id)],
  );
}

/**
 * The next question of the current phase, `null` when the phase has no unused question left. The
 * randomness is seeded (`run.seed + steps.length`), so the same state gives the same question.
 */
export function pickNext(run: RoundRun, ctx: PickCtx): { topicId: string; qid: string } | null {
  const phase = currentPhase(run);
  if (phase === 'done') return null;
  const seed = run.seed + run.steps.length;
  const used = new Set(run.steps.map((s) => usedKey(s.topicId, s.qid)));
  if (run.pending) used.add(usedKey(run.pending.topicId, run.pending.qid));
  let topicId: string | null;
  if (phase === 'check') topicId = pickCheckTopic(run, ctx, used, seed);
  else if (phase === 'practice') topicId = pickPracticeTopic(run, ctx, used);
  else if (phase === 'recheck') topicId = pickRecheckTopic(run, ctx, used);
  else topicId = pickFullTopic(run, ctx, used, seed);
  if (topicId === null) return null;
  const qid = questionFor(topicId, run, ctx, used, seed);
  return qid === null ? null : { topicId, qid };
}

/**
 * The lesson row badge: the larger of the lesson % and the test (evidence) %, `fromTest` when the
 * test % is strictly the larger one, `ticked` from the evidence.
 */
export function badgeForTopic(
  lessonPct: number | null,
  ev?: TopicEvidence,
  kindCount?: () => number,
): { pct: number | null; fromTest: boolean; ticked: boolean } {
  const testPct = topicPercent(ev);
  const pct = lessonPct === null ? testPct : testPct === null ? lessonPct : Math.max(lessonPct, testPct);
  const fromTest = testPct !== null && (lessonPct === null || testPct > lessonPct);
  return { pct, fromTest, ticked: topicTicked(ev, kindCount) };
}

/** The grammar score: the average over the topics of the better of the lesson % and the test %, 0 for no topics. */
export function overallScore(
  topicIds: string[],
  lessonPct: Map<string, number>,
  evidence: Map<string, TopicEvidence>,
): number {
  if (topicIds.length === 0) return 0;
  const sum = topicIds.reduce(
    (acc, id) => acc + Math.max(lessonPct.get(id) ?? 0, topicPercent(evidence.get(id)) ?? 0),
    0,
  );
  return Math.round(sum / topicIds.length);
}

/** Topics with a test % under WEAK_PCT (no % yet = not counted). */
export function weakTopicCount(evidence: Map<string, TopicEvidence>): number {
  let n = 0;
  for (const ev of evidence.values()) {
    const pct = topicPercent(ev);
    if (pct !== null && pct < WEAK_PCT) n += 1;
  }
  return n;
}
