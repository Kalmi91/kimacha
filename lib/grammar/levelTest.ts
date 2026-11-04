// Grammar level test (Grammar tab, FB571): the pure engine, no React, no DB. A level's test is an endless stream of
// questions from the topics of ONE level. Which topic comes next is decided only by the per-topic evidence of the
// random round (lib/grammar/randomRound.ts): the core topics first, the lowest test percent first, a ticked topic
// only when nothing else is open. Every answer goes into the same evidence, so there is nothing to resume.

import type { GrammarKind } from '@/lib/games/content';
import { shuffleArray } from '@/lib/shuffle';
import {
  EVIDENCE_WINDOW,
  MIN_ANSWERS_FOR_PCT,
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

/**
 * The next topic: the core topics (core+ and core) that are not ticked yet, lowest percent first; when all of them
 * are ticked the other tiers the same way; when everything is ticked the whole level again, lowest percent first.
 * The previous question's topic is left out when the pool has another candidate. Ties: core+ before core before
 * the rest, then syllabus order.
 */
export function pickLevelTopic(
  topics: PickTopic[],
  evidence: Map<string, TopicEvidence>,
  kindsOf: KindsOf,
  prev?: string,
): string | null {
  if (topics.length === 0) return null;
  const open = (list: PickTopic[]) => list.filter((t) => !topicTicked(evidence.get(t.id), () => kindsOf(t.id)));
  const pool = [open(topics.filter(isCore)), open(topics.filter((t) => !isCore(t))), topics].find((l) => l.length > 0) ?? topics;
  const others = pool.filter((t) => t.id !== prev);
  const cands = others.length > 0 ? others : pool;
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
 * A question of the topic: one that is not among the topic's last EVIDENCE_WINDOW answers, of the kind that window
 * holds least (a new kind first); seeded random among those. A topic whose questions are all in the window gives back
 * the one answered longest ago, so the stream never runs dry.
 */
export function pickLevelQuestion(topicId: string, ctx: LevelTestCtx, seed: number): string | null {
  const qs = ctx.questionIds(topicId);
  if (qs.length === 0) return null;
  const answers = windowOf(ctx.evidence.get(topicId));
  const lastAt = new Map<string, number>();
  answers.forEach((a, i) => lastAt.set(a.id, i));
  const fresh = qs.filter((q) => !lastAt.has(q.id));
  if (fresh.length === 0) {
    return qs.reduce((oldest, q) => ((lastAt.get(q.id) ?? 0) < (lastAt.get(oldest.id) ?? 0) ? q : oldest)).id;
  }
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
}

export const levelRoundKey = (pair: string, level: string): string => `grammar-level-round:${pair}:${level}`;

/** A saved round, or null when the value is missing or damaged (the caller starts a new round). */
export function parseLevelRound(raw: unknown): LevelRound | null {
  const r = raw as Partial<LevelRound> | null | undefined;
  if (!r || typeof r !== 'object') return null;
  const { n, right, startPct } = r;
  if (!Number.isInteger(n) || !Number.isInteger(right) || typeof startPct !== 'number' || !Number.isFinite(startPct)) return null;
  if ((n as number) < 0 || (n as number) > LEVEL_ROUND_SIZE || (right as number) < 0 || (right as number) > (n as number)) return null;
  return { n: n as number, right: right as number, startPct };
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
