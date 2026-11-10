// Exam answers as grammar evidence (lib/grammar/examEvidence.ts) and what they change in the exam round's pick.
// Pure engine, no React, no DB.

import type { ExamItem, ExamItemResult } from '@/lib/exam/types';
import {
  EXAM_ID_PREFIX,
  examMissed,
  examMissedTopics,
  examStripWeak,
  levelExamAnswers,
  mergeExamAnswers,
  type ExamAnswer,
} from '@/lib/grammar/examEvidence';
import { pickRoundTexts, type ExamRoundText } from '@/lib/grammar/examRound';
import { EVIDENCE_WINDOW, appendEvidence, type EvidenceAnswer, type EvidenceKind, type TopicEvidence } from '@/lib/grammar/randomRound';

const ans = (id: string, ok: boolean, kind: EvidenceKind = 'choice'): EvidenceAnswer => ({ id, kind, ok, at: '2026-11-01' });
const ev = (...a: EvidenceAnswer[]): TopicEvidence => ({ answers: a });
const exam = (n: number, ok: boolean) => ans(`${EXAM_ID_PREFIX}L1:g${n}`, ok);

describe('examMissed', () => {
  it('a wrong exam answer → true', () => {
    expect(examMissed(ev(ans('q1', true), exam(1, false)))).toBe(true);
  });
  it('a right exam answer → false', () => {
    expect(examMissed(ev(exam(1, true)))).toBe(false);
  });
  it('a later right answer of another kind → false', () => {
    expect(examMissed(ev(exam(1, false), ans('q2', true, 'form')))).toBe(false);
  });
  it('a later wrong answer → still true', () => {
    expect(examMissed(ev(exam(1, false), ans('q2', false, 'form')))).toBe(true);
  });
  it('no exam answer, or no evidence → false', () => {
    expect(examMissed(ev(ans('q1', false)))).toBe(false);
    expect(examMissed(undefined)).toBe(false);
  });
  it('the exam answer pushed out of the window → false', () => {
    const later = Array.from({ length: EVIDENCE_WINDOW }, (_, i) => ans(`q${i}`, false));
    let e: TopicEvidence | undefined;
    for (const a of [exam(1, false), ...later]) e = appendEvidence(e, a);
    expect(e?.answers.some((a) => a.id.startsWith(EXAM_ID_PREFIX))).toBe(false);
    expect(examMissed(e)).toBe(false);
  });
});

describe('mergeExamAnswers', () => {
  const answers: ExamAnswer[] = [
    { topicId: 'a', id: 'exam:L1:x', kind: 'choice', ok: false },
    { topicId: 'a', id: 'exam:L1:y', kind: 'choice', ok: true },
    { topicId: 'b', id: 'exam:L1:z', kind: 'choice', ok: false },
  ];

  it('the same answers merged twice leave one copy', () => {
    const once = mergeExamAnswers(new Map(), answers, '2026-11-09');
    const twice = mergeExamAnswers(once.evidence, answers, '2026-11-09');
    expect(twice.touched).toEqual([]);
    expect(twice.evidence.get('a')?.answers).toHaveLength(2);
    expect(twice.evidence.get('b')?.answers).toHaveLength(1);
    expect(once.touched).toEqual(['a', 'b']);
  });

  it('a topic without evidence gets one, without a stamp', () => {
    const r = mergeExamAnswers(new Map(), answers, '2026-11-09');
    expect(r.evidence.get('b')?.answers[0]).toEqual({ id: 'exam:L1:z', kind: 'choice', ok: false, at: '2026-11-09' });
    expect(r.evidence.get('b')?.stamp).toBeUndefined();
  });

  it('the stamp stays what it was; the input map is not changed', () => {
    const before = new Map<string, TopicEvidence>([['a', { answers: [ans('q1', true)], stamp: 1234 }]]);
    const r = mergeExamAnswers(before, answers, '2026-11-09');
    expect(r.evidence.get('a')?.stamp).toBe(1234);
    expect(before.get('a')?.answers).toHaveLength(1);
  });

  it('an id that only stands in `seen` is skipped too', () => {
    const before = new Map<string, TopicEvidence>([['a', { answers: [], seen: ['exam:L1:x'] }]]);
    const r = mergeExamAnswers(before, [answers[0]], '2026-11-09');
    expect(r.touched).toEqual([]);
  });
});

describe('levelExamAnswers', () => {
  const gap = (itemId: string, topicId: string): ExamItem => ({ kind: 'gap_mc', skill: 'grammar', itemId, topicId, sentence: 'x ___', options: ['a', 'b', 'c'], correctIndex: 0 });
  const word: ExamItem = { kind: 'word_type', skill: 'words', itemId: 'w1', prompt: 'p', answer: 'a' };

  it('only gap_mc results, right or wrong, with the specified ids', () => {
    const results: ExamItemResult[] = [
      { item: word, correct: false },
      { item: gap('g1', 't1'), correct: false },
      { item: gap('g2', 't2'), correct: true },
    ];
    expect(levelExamAnswers(results, 77)).toEqual([
      { topicId: 't1', id: 'exam:L77:g1', kind: 'choice', ok: false },
      { topicId: 't2', id: 'exam:L77:g2', kind: 'choice', ok: true },
    ]);
  });
});

describe('examStripWeak and examMissedTopics', () => {
  const ids = ['t1', 't2', 't3', 't4', 't5'];
  const pctEv = (ok: number, total: number): TopicEvidence => ev(...Array.from({ length: total }, (_, i) => ans(`q${i}`, i < ok)));

  it('a missed topic without a percent comes first with pct null; never more than max', () => {
    const evidence = new Map<string, TopicEvidence>([
      ['t1', pctEv(0, 5)],
      ['t2', pctEv(1, 5)],
      ['t3', pctEv(2, 5)],
      ['t5', ev(exam(1, false))],
    ]);
    expect(examMissedTopics(ids, evidence)).toEqual(['t5']);
    expect(examStripWeak(ids, evidence)).toEqual([
      { id: 't5', pct: null, missed: true },
      { id: 't1', pct: 0, missed: false },
      { id: 't2', pct: 20, missed: false },
    ]);
    expect(examStripWeak(ids, evidence, 2)).toHaveLength(2);
  });

  it('a missed topic with a percent is listed once, as missed', () => {
    const evidence = new Map<string, TopicEvidence>([['t2', ev(ans('q0', true), ans('q1', true), ans('q3', false), exam(1, false))]]);
    expect(examStripWeak(ids, evidence)).toEqual([{ id: 't2', pct: 50, missed: true }]);
  });

  it('nothing missed → exactly the weakestTopics rows', () => {
    const evidence = new Map<string, TopicEvidence>([['t1', pctEv(0, 5)], ['t4', pctEv(5, 5)]]);
    expect(examStripWeak(ids, evidence)).toEqual([{ id: 't1', pct: 0, missed: false }]);
  });
});

describe('pickRoundTexts with an exam-missed topic', () => {
  const ids = ['t1', 't2', 't3', 't4'];
  const text = (id: string, topics: string[]): ExamRoundText => ({
    id,
    title: id,
    text: topics.map((_, i) => `w{{${i + 1}}}`).join(' '),
    gaps: topics.map((topic, i) => ({ options: ['a', 'b', 'c'], correct: i % 3, topic })),
  });
  const texts = [text('x1', ['t1', 't2']), text('x2', ['t3', 't4']), text('x3', ['t2', 't3']), text('x4', ['t1', 't4'])];
  const holdsT4 = (r: ExamRoundText) => r.gaps.some((g) => g.topic === 't4');

  it('ACCEPTANCE: the texts holding the missed topic come first even when they were all seen', () => {
    const evidence = new Map<string, TopicEvidence>([['t4', ev(exam(1, false))]]);
    // x2 and x4 hold t4 and are seen; x1 and x3 are unseen
    for (let seed = 1; seed <= 12; seed++) {
      const picked = pickRoundTexts(texts, ids, evidence, ['x2', 'x4'], seed);
      expect(holdsT4(picked[0])).toBe(true);
    }
  });

  it('after one right cloze answer on the topic an unseen text comes first again', () => {
    const evidence = new Map<string, TopicEvidence>([['t4', ev(exam(1, false), ans('x9#1', true, 'cloze'))]]);
    for (let seed = 1; seed <= 12; seed++) {
      const picked = pickRoundTexts(texts, ids, evidence, ['x2', 'x4'], seed);
      expect(['x1', 'x3']).toContain(picked[0].id);
    }
  });
});
