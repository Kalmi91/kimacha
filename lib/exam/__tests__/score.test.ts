// The pass mark is 80%.

import { EXAM_PASS_PCT, examPassed, scoreExam } from '../score';
import type { ExamItem, ExamItemResult, ExamSkill } from '../types';

const item = (skill: ExamSkill): ExamItem =>
  skill === 'words'
    ? { kind: 'word_type', skill, itemId: 'o1', prompt: 'a', answer: 'b' }
    : skill === 'grammar'
      ? { kind: 'gap_mc', skill, topicId: 't', sentence: 'x ___', options: ['a', 'b'], correctIndex: 0 }
      : skill === 'reading'
        ? { kind: 'reading_mc', skill, itemIds: ['o1'], text: 'x', options: ['a', 'b'], correctIndex: 0 }
        : { kind: 'speak', skill, itemId: 'o1', prompt: 'a', expected: 'b', mode: 'translate' };

const results = (correct: number, total: number, skill: ExamSkill = 'words'): ExamItemResult[] =>
  Array.from({ length: total }, (_, i) => ({ item: item(skill), correct: i < correct }));

describe('examPassed (80%)', () => {
  it('the threshold is 80', () => expect(EXAM_PASS_PCT).toBe(80));

  it('exactly 80% passes, below it fails', () => {
    expect(examPassed(24, 30)).toBe(true);
    expect(examPassed(23, 30)).toBe(false);
    expect(examPassed(4, 5)).toBe(true);
    expect(examPassed(3, 5)).toBe(false);
    expect(examPassed(80, 100)).toBe(true);
    expect(examPassed(79, 100)).toBe(false);
  });

  it('79.9% does not round to 80', () => {
    expect(examPassed(799, 1000)).toBe(false);
  });

  it('an empty exam does not pass', () => {
    expect(examPassed(0, 0)).toBe(false);
  });
});

describe('scoreExam', () => {
  it('counts: right / total / whole percent (rounded down) / passed', () => {
    const score = scoreExam(results(24, 30));
    expect(score).toMatchObject({ correct: 24, total: 30, pct: 80, passed: true });
    const fail = scoreExam(results(23, 29));
    expect(fail).toMatchObject({ correct: 23, total: 29, pct: 79, passed: false });
  });

  it('also sums per skill (for a later step of the result sheet)', () => {
    const score = scoreExam([...results(2, 3, 'words'), ...results(1, 2, 'grammar'), ...results(1, 1, 'reading')]);
    expect(score.bySkill).toEqual({
      words: { correct: 2, total: 3 },
      grammar: { correct: 1, total: 2 },
      reading: { correct: 1, total: 1 },
    });
  });

  it('empty list: 0 points, not passed', () => {
    expect(scoreExam([])).toMatchObject({ correct: 0, total: 0, pct: 0, passed: false });
  });
});
