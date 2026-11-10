// Exam answers as grammar evidence (slice 3 of the exam strip): a wrong grammar answer in the level exam or in a mock exam
// gap that carries a topic counts as test evidence of its topic. The topic then stands first in the next exam round and
// first in the strip's "Weakest now" list. Pure module: no React, no DB, no Date.now. Ids start with `exam:`, so a retried
// save is recognised and never doubles (see mergeExamAnswers).

import type { ExamItemResult } from '@/lib/exam/types';
import { weakestTopics } from '@/lib/grammar/levelTest';
import { EVIDENCE_WINDOW, appendEvidence, topicPercent, type EvidenceKind, type TopicEvidence } from '@/lib/grammar/randomRound';

export const EXAM_ID_PREFIX = 'exam:';

export interface ExamAnswer {
  topicId: string;
  id: string;
  kind: EvidenceKind;
  ok: boolean;
}

/** One answer per grammar gap of the level exam, right or wrong; `run` tells the exam runs apart. */
export function levelExamAnswers(results: ExamItemResult[], run: number): ExamAnswer[] {
  const out: ExamAnswer[] = [];
  for (const { item, correct } of results) {
    if (item.kind !== 'gap_mc') continue;
    out.push({ topicId: item.topicId, id: `${EXAM_ID_PREFIX}L${run}:${item.itemId}`, kind: 'choice', ok: correct });
  }
  return out;
}

/**
 * Appends the answers to the evidence (a copy). An answer whose id the topic already holds (in `answers` or `seen`) is
 * skipped, so a retried save never doubles. The topic's `stamp` stays what it was, so an exam answer never moves a topic
 * back in the level test's order. `touched` = the topics that got at least one answer.
 */
export function mergeExamAnswers(
  evidence: Map<string, TopicEvidence>,
  answers: ExamAnswer[],
  at: string,
): { evidence: Map<string, TopicEvidence>; touched: string[] } {
  const next = new Map(evidence);
  const touched: string[] = [];
  for (const a of answers) {
    const before = next.get(a.topicId);
    if (before && (before.answers.some((x) => x.id === a.id) || (before.seen ?? []).includes(a.id))) continue;
    const merged = appendEvidence(before, { id: a.id, kind: a.kind, ok: a.ok, at }, before?.stamp ?? 0);
    if (before?.stamp === undefined) delete merged.stamp;
    next.set(a.topicId, merged);
    if (!touched.includes(a.topicId)) touched.push(a.topicId);
  }
  return { evidence: next, touched };
}

/** The latest exam answer of the topic's window is wrong and no right answer (any id, any kind) stands after it. */
export function examMissed(ev?: TopicEvidence): boolean {
  if (!ev) return false;
  const w = ev.answers.slice(-EVIDENCE_WINDOW);
  let last = -1;
  for (let i = w.length - 1; i >= 0; i--) {
    if (w[i].id.startsWith(EXAM_ID_PREFIX)) {
      last = i;
      break;
    }
  }
  if (last < 0 || w[last].ok) return false;
  return !w.slice(last + 1).some((a) => a.ok);
}

/** The exam-missed topics among `topicIds`, in the given order. */
export const examMissedTopics = (topicIds: string[], evidence: Map<string, TopicEvidence>): string[] =>
  topicIds.filter((id) => examMissed(evidence.get(id)));

/** The strip's weak list: exam-missed topics first (given order), then the rows of weakestTopics without those; `max` rows in all. */
export function examStripWeak(
  topicIds: string[],
  evidence: Map<string, TopicEvidence>,
  max = 3,
): { id: string; pct: number | null; missed: boolean }[] {
  const missed = examMissedTopics(topicIds, evidence);
  const head = missed.map((id) => ({ id, pct: topicPercent(evidence.get(id)), missed: true }));
  const tail = weakestTopics(topicIds, evidence, topicIds.length)
    .filter((w) => !missed.includes(w.id))
    .map((w) => ({ id: w.id, pct: w.pct as number | null, missed: false }));
  return [...head, ...tail].slice(0, max);
}
