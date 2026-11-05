// Grammar level test (Grammar tab, FB571): the pure engine, no React, no DB. A level's test is an endless stream of
// questions from the topics of ONE level. Which topic comes next is decided only by the per-topic evidence of the
// random round (lib/grammar/randomRound.ts): the core topics first and evenly, then the lowest test percent first, a ticked
// topic only when nothing else is open; a question comes back only after all questions of its topic were asked. Every answer goes into the same evidence, so there is nothing to resume.

import type { GrammarKind } from '@/lib/games/content';
import { shuffleArray } from '@/lib/shuffle';
import {
  EVIDENCE_WINDOW,
  MIN_ANSWERS_FOR_PCT,
  askedCount,
  seenIds,
  topicPercent,
  topicTicked,
  type PickTopic,
  type TopicEvidence,
} from '@/lib/grammar/randomRound';

export interface LevelTestCtx {
  /** The topics of the level that have at least one usable question, in syllabus order. */
  topics: PickTopic[];
  /** ALREADY updated with the latest answer. */
  evidence: Map<string, TopicEvidence>;
  /** Usable questions of a topic. */
  questionIds: (topicId: string) => { id: string; kind: GrammarKind }[];
}

const TIER_RANK: Record<string, number> = { 'core-plus': 0, core: 1, exam: 2, full: 3, perfect: 4 };
const isCore = (t: PickTopic): boolean => t.tier === 'core-plus' || t.tier === 'core';

const windowOf = (ev?: TopicEvidence) => (ev ? ev.answers.slice(-EVIDENCE_WINDOW) : []);

/**
 * A topic's share in the level percent: its test percent from MIN_ANSWERS_FOR_PCT answers on; with 1 or 2 answers the
 * right ones over MIN_ANSWERS_FOR_PCT (1 right of 1 = 33, 2 right of 2 = 67), so every answer moves the level. The tick and
 * the topic's own percent (topicPercent) do not use this.
 */
export function topicShare(ev?: TopicEvidence): number {
  const full = topicPercent(ev);
  if (full !== null) return full;
  const w = windowOf(ev);
  return Math.round((w.filter((a) => a.ok).length / MIN_ANSWERS_FOR_PCT) * 100);
}

/** The average of the topics' shares (no answer = 0), 0 for no topics. */
export function levelPercent(topicIds: string[], evidence: Map<string, TopicEvidence>): number {
  if (topicIds.length === 0) return 0;
  const sum = topicIds.reduce((acc, id) => acc + topicShare(evidence.get(id)), 0);
  return Math.round(sum / topicIds.length);
}

/** How many exercise kinds a topic has questions of: the tick asks for two kinds, but never more than the topic has. */
export type KindsOf = (topicId: string) => number;

/** The kind counts of the topics of a level test context. */
export const kindsOfCtx =
  (ctx: LevelTestCtx): KindsOf =>
  (topicId) =>
    new Set(ctx.questionIds(topicId).map((q) => q.kind)).size;

/** Every topic ticked (at least one topic). */
export function levelDone(topicIds: string[], evidence: Map<string, TopicEvidence>, kindsOf: KindsOf): boolean {
  return topicIds.length > 0 && topicIds.every((id) => topicTicked(evidence.get(id), () => kindsOf(id)));
}

// How much a topic needs the learner, lowest first: a topic without any answer is below everything, a topic with
// 1-2 answers (no percent yet) counts with the share of its right answers, then fewer answers first.
function needKey(ev: TopicEvidence | undefined): number[] {
  const w = windowOf(ev);
  if (w.length === 0) return [-1, 0];
  const pct = topicPercent(ev) ?? Math.round((w.filter((a) => a.ok).length / w.length) * 100);
  return [pct, w.length];
}

function lessThan(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/** Core topics (core+ and core) are asked first and evenly: an open topic may be at most this many questions ahead of the least asked open topic (FB595). */
export const SPREAD_SLACK = 2;
/** A topic outside the core counts as this many questions already asked, so it joins only once the core topics have had their first turns. */
export const NON_CORE_LAG = 4;

/**
 * The next topic, the same rule on every level: the topics that are not ticked yet (all of them again when everything is
 * ticked) compete; the core topics count as they are, the others as NON_CORE_LAG questions ahead, so the core comes first.
 * Only the topics within SPREAD_SLACK of the least asked one are candidates, so every topic gets its turn and the asked
 * counts stay close; among those the lowest percent first (an unasked topic below everything). The previous question's
 * topic is left out when there is another candidate. Ties: core+ before core before the rest, then syllabus order.
 */
export function pickLevelTopic(
  topics: PickTopic[],
  evidence: Map<string, TopicEvidence>,
  kindsOf: KindsOf,
  prev?: string,
): string | null {
  if (topics.length === 0) return null;
  const open = topics.filter((t) => !topicTicked(evidence.get(t.id), () => kindsOf(t.id)));
  const pool = open.length > 0 ? open : topics;
  const others = pool.filter((t) => t.id !== prev);
  const eligible = others.length > 0 ? others : pool;
  const turns = (t: PickTopic) => askedCount(evidence.get(t.id)) + (isCore(t) ? 0 : NON_CORE_LAG);
  const fewest = Math.min(...eligible.map(turns));
  const cands = eligible.filter((t) => turns(t) <= fewest + SPREAD_SLACK);
  let best = cands[0];
  let bestKey = [...needKey(evidence.get(best.id)), TIER_RANK[best.tier] ?? 5];
  for (const t of cands.slice(1)) {
    const key = [...needKey(evidence.get(t.id)), TIER_RANK[t.tier] ?? 5];
    if (lessThan(key, bestKey)) {
      best = t;
      bestKey = key;
    }
  }
  return best.id;
}

/**
 * A question of the topic: one that has not had its turn in the current pass over the topic's questions (the evidence's
 * `seen`), of the kind the last answers hold least (a new kind first); seeded random among those. When every question had
 * its turn the pass starts again with the ones not among the last EVIDENCE_WINDOW answers, or the one answered longest
 * ago, so the stream never runs dry and no question comes back before all of its topic's were asked.
 */
export function pickLevelQuestion(topicId: string, ctx: LevelTestCtx, seed: number): string | null {
  const qs = ctx.questionIds(topicId);
  if (qs.length === 0) return null;
  const ev = ctx.evidence.get(topicId);
  const answers = windowOf(ev);
  const lastAt = new Map<string, number>();
  answers.forEach((a, i) => lastAt.set(a.id, i));
  const seen = new Set(seenIds(ev));
  let fresh = qs.filter((q) => !seen.has(q.id));
  // a new pass: the questions that were not asked lately (right after a pass the last answers are still in the window)
  const away = (list: typeof qs) => list.filter((q) => !lastAt.has(q.id));
  if (fresh.length === 0) fresh = qs;
  if (away(fresh).length > 0) fresh = away(fresh);
  else if (fresh === qs) return qs.reduce((oldest, q) => ((lastAt.get(q.id) ?? 0) < (lastAt.get(oldest.id) ?? 0) ? q : oldest)).id;
  const kindCount = new Map<GrammarKind, number>();
  for (const a of answers) kindCount.set(a.kind, (kindCount.get(a.kind) ?? 0) + 1);
  const count = (q: { kind: GrammarKind }) => kindCount.get(q.kind) ?? 0;
  const least = Math.min(...fresh.map(count));
  return shuffleArray(fresh.filter((q) => count(q) === least), seed)[0].id;
}

/** The next question of the stream, `null` only for a level without any usable question. */
export function pickLevelNext(ctx: LevelTestCtx, prev: string | undefined, seed: number): { topicId: string; qid: string } | null {
  const topicId = pickLevelTopic(ctx.topics, ctx.evidence, kindsOfCtx(ctx), prev);
  if (topicId === null) return null;
  const qid = pickLevelQuestion(topicId, ctx, seed);
  return qid === null ? null : { topicId, qid };
}

// ---------------------------------------------------------------------------
// Rounds of 20 (FB581): the stream stays endless, but the learner sees "3/20" and, after the 20th result, a short round
// summary. The position and the right count are kept per language pair and level in the resume store (lib/resumeStore.ts).

export const LEVEL_ROUND_SIZE = 20;

export interface LevelRound {
  /** Answers given in this round (0..LEVEL_ROUND_SIZE). */
  n: number;
  /** How many of them were right. */
  right: number;
  /** The level percent when the round started. */
  startPct: number;
  /** Per topic asked in this round (FB596): answers, right ones and the topic's share before its first answer. Absent in rounds saved before. */
  topics?: Record<string, RoundTopic>;
}

export interface RoundTopic {
  n: number;
  right: number;
  /** The topic's share (topicShare) before its first answer of this round. */
  start: number;
}

export const levelRoundKey = (pair: string, level: string): string => `grammar-level-round:${pair}:${level}`;

/** A saved round, or null when the value is missing or damaged (the caller starts a new round). */
export function parseLevelRound(raw: unknown): LevelRound | null {
  const r = raw as Partial<LevelRound> | null | undefined;
  if (!r || typeof r !== 'object') return null;
  const { n, right, startPct } = r;
  if (!Number.isInteger(n) || !Number.isInteger(right) || typeof startPct !== 'number' || !Number.isFinite(startPct)) return null;
  if ((n as number) < 0 || (n as number) > LEVEL_ROUND_SIZE || (right as number) < 0 || (right as number) > (n as number)) return null;
  const topics = parseRoundTopics((r as { topics?: unknown }).topics);
  return { n: n as number, right: right as number, startPct, ...(topics ? { topics } : {}) };
}

function parseRoundTopics(raw: unknown): Record<string, RoundTopic> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, RoundTopic> = {};
  for (const [id, v] of Object.entries(raw as Record<string, Partial<RoundTopic>>)) {
    if (!v || !Number.isInteger(v.n) || !Number.isInteger(v.right) || typeof v.start !== 'number' || !Number.isFinite(v.start)) continue;
    if ((v.right as number) < 0 || (v.right as number) > (v.n as number)) continue;
    out[id] = { n: v.n as number, right: v.right as number, start: v.start };
  }
  return out;
}

/** The round's per-topic record after one more answer; `startShare` is the topic's share BEFORE this answer (kept only for its first one). */
export function recordRoundAnswer(
  topics: Record<string, RoundTopic> | undefined,
  topicId: string,
  ok: boolean,
  startShare: number,
): Record<string, RoundTopic> {
  const old = topics?.[topicId];
  return { ...topics, [topicId]: { n: (old?.n ?? 0) + 1, right: (old?.right ?? 0) + (ok ? 1 : 0), start: old ? old.start : startShare } };
}

export interface RoundTopicRow {
  id: string;
  n: number;
  right: number;
  /** The change of the topic's share in this round, in points: up > 0, down < 0; null while the topic has too few answers for a percent. */
  delta: number | null;
}

/** One row per topic asked in the round, the weakest (lowest share now, then lowest right/asked) first. */
export function roundTopicRows(topics: Record<string, RoundTopic> | undefined, evidence: Map<string, TopicEvidence>): RoundTopicRow[] {
  const rows = Object.entries(topics ?? {}).map(([id, t]) => {
    const now = topicShare(evidence.get(id));
    return { id, n: t.n, right: t.right, delta: topicPercent(evidence.get(id)) === null ? null : now - t.start, now };
  });
  rows.sort((a, b) => a.now - b.now || a.right / a.n - b.right / b.n);
  return rows.map(({ id, n, right, delta }) => ({ id, n, right, delta }));
}

/** The topic of the level with the lowest percent (no percent yet = 0), ties in syllabus order; null for no topic. */
export function weakestTopic(topicIds: string[], evidence: Map<string, TopicEvidence>): { id: string; pct: number } | null {
  let best: { id: string; pct: number } | null = null;
  for (const id of topicIds) {
    const pct = topicPercent(evidence.get(id)) ?? 0;
    if (!best || pct < best.pct) best = { id, pct };
  }
  return best;
}

// ---------------------------------------------------------------------------
// The level's standing (FB593, FB594, FB616): the number on the level test's bar, the test button and the syllabus header.
// It never goes down and grows a little with every right answer, so the bar always moves; the real percent (levelPercent)
// is the floor it can never sink below. Stored per language pair and level in the resume store.

export const LEVEL_SHOWN_STEP = 0.5;

export const levelShownKey = (pair: string, level: string): string => `grammar-level-shown:${pair}:${level}`;

/** A saved standing, or null when the value is missing or damaged. */
export function parseShownPct(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 100 ? raw : null;
}

/** The standing after an answer: right = one step up (never above 99 unless the real percent is 100; a stored 100 stays), wrong = unchanged. */
export function nextShownPct(shown: number, real: number, ok: boolean): number {
  if (!ok) return shown;
  return Math.min(Math.max(shown, real) + LEVEL_SHOWN_STEP, real >= 100 ? 100 : Math.max(shown, 99));
}

/** What is drawn: the larger of the stored standing and the real percent. */
export const shownPctOf = (shown: number | null | undefined, real: number): number => Math.max(shown ?? 0, real);

/** The whole-percent label of a standing (never rounds up to the next point, so 100 appears only at 100). */
export const shownLabel = (pct: number): number => Math.floor(pct + 1e-9);
