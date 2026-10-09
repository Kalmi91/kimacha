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
  it('a küszöb 80', () => expect(EXAM_PASS_PCT).toBe(80));

  it('pontosan 80% átmegy, alatta bukik', () => {
    expect(examPassed(24, 30)).toBe(true);
    expect(examPassed(23, 30)).toBe(false);
    expect(examPassed(4, 5)).toBe(true);
    expect(examPassed(3, 5)).toBe(false);
    expect(examPassed(80, 100)).toBe(true);
    expect(examPassed(79, 100)).toBe(false);
  });

  it('a 79,9% nem kerekedik 80-ra', () => {
    expect(examPassed(799, 1000)).toBe(false);
  });

  it('üres vizsga nem megy át', () => {
    expect(examPassed(0, 0)).toBe(false);
  });
});

describe('scoreExam', () => {
  it('számol: jó / összes / egész százalék (lefelé) / átment', () => {
    const score = scoreExam(results(24, 30));
    expect(score).toMatchObject({ correct: 24, total: 30, pct: 80, passed: true });
    const fail = scoreExam(results(23, 29));
    expect(fail).toMatchObject({ correct: 23, total: 29, pct: 79, passed: false });
  });

  it('készségenként is összesít (az eredmény-lap későbbi lépéséhez)', () => {
    const score = scoreExam([...results(2, 3, 'words'), ...results(1, 2, 'grammar'), ...results(1, 1, 'reading')]);
    expect(score.bySkill).toEqual({
      words: { correct: 2, total: 3 },
      grammar: { correct: 1, total: 2 },
      reading: { correct: 1, total: 1 },
    });
  });

  it('üres lista: 0 pont, nem ment át', () => {
    expect(scoreExam([])).toMatchObject({ correct: 0, total: 0, pct: 0, passed: false });
  });
});
