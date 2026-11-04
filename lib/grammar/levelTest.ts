// Grammar level test (Grammar tab, FB571): the pure engine, no React, no DB. A level's test is an endless stream of
// questions from the topics of ONE level. Which topic comes next is decided only by the per-topic evidence of the
// random round (lib/grammar/randomRound.ts): the core topics first, the lowest test percent first, a ticked topic
// only when nothing else is open. Every answer goes into the same evidence, so there is nothing to resume.

import type { GrammarKind } from '@/lib/games/content';
import { shuffleArray } from '@/lib/shuffle';
import {
  EVIDENCE_WINDOW,
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

/** The average test percent of the topics (no percent yet = 0), 0 for no topics. */
export function levelPercent(topicIds: string[], evidence: Map<string, TopicEvidence>): number {
  if (topicIds.length === 0) return 0;
  const sum = topicIds.reduce((acc, id) => acc + (topicPercent(evidence.get(id)) ?? 0), 0);
  return Math.round(sum / topicIds.length);
}

/** Every topic ticked (at least one topic). */
export function levelDone(topicIds: string[], evidence: Map<string, TopicEvidence>): boolean {
  return topicIds.length > 0 && topicIds.every((id) => topicTicked(evidence.get(id)));
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
export function pickLevelTopic(topics: PickTopic[], evidence: Map<string, TopicEvidence>, prev?: string): string | null {
  if (topics.length === 0) return null;
  const open = (list: PickTopic[]) => list.filter((t) => !topicTicked(evidence.get(t.id)));
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
  const topicId = pickLevelTopic(ctx.topics, ctx.evidence, prev);
  if (topicId === null) return null;
  const qid = pickLevelQuestion(topicId, ctx, seed);
  return qid === null ? null : { topicId, qid };
}
