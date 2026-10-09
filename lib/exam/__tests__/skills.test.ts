// Per-skill scoring (points, %, strong / weak) and, for weak grammar, the most often
// failed lessons (the target of the lesson link).

import { scoreExam } from '../score';
import { MAX_LESSON_LINKS, skillResults, weakLessons } from '../skills';
import type { ExamItem, ExamItemResult } from '../types';

const word = (id: string): ExamItem => ({ kind: 'word_type', skill: 'words', itemId: id, prompt: 'p', answer: 'a' });
const gap = (topicId: string): ExamItem => ({ kind: 'gap_mc', skill: 'grammar', topicId, sentence: 'Yo ___ .', options: ['a', 'b', 'c'], correctIndex: 0 });
const reading = (id: string): ExamItem => ({ kind: 'reading_mc', skill: 'reading', itemIds: [id], text: 't', options: ['a', 'b', 'c'], correctIndex: 0 });
const res = (item: ExamItem, correct: boolean): ExamItemResult => ({ item, correct });

describe('skillResults', () => {
  it('score and % per skill, order: word, grammar, reading', () => {
    const results = [
      res(reading('r1'), true),
      res(gap('t1'), true),
      res(gap('t1'), false),
      res(word('w1'), true),
      res(word('w2'), true),
      res(word('w3'), true),
    ];
    expect(skillResults(scoreExam(results))).toEqual([
      { skill: 'words', correct: 3, total: 3, pct: 100, weak: false },
      { skill: 'grammar', correct: 1, total: 2, pct: 50, weak: true },
      { skill: 'reading', correct: 1, total: 1, pct: 100, weak: false },
    ]);
  });

  it('weak = the skill % is below the pass threshold (80%): 4 / 5 is still strong, 7 / 9 (77%) is weak', () => {
    const four = Array.from({ length: 5 }, (_, i) => res(word(`w${i}`), i < 4));
    expect(skillResults(scoreExam(four))[0]).toMatchObject({ pct: 80, weak: false });
    const seven = Array.from({ length: 9 }, (_, i) => res(word(`w${i}`), i < 7));
    expect(skillResults(scoreExam(seven))[0]).toMatchObject({ pct: 77, weak: true });
  });

  it('79 / 100 is weak (no rounding up to 80)', () => {
    const results = Array.from({ length: 100 }, (_, i) => res(word(`w${i}`), i < 79));
    expect(skillResults(scoreExam(results))[0]).toMatchObject({ pct: 79, weak: true });
  });

  it('only the skills that were in the exam appear', () => {
    expect(skillResults(scoreExam([res(word('w1'), true)])).map((r) => r.skill)).toEqual(['words']);
    expect(skillResults(scoreExam([]))).toEqual([]);
  });
});

describe('weakLessons', () => {
  it('the lessons of the wrong grammar items, the most-missed first', () => {
    const results = [res(gap('a'), false), res(gap('b'), false), res(gap('b'), false), res(gap('c'), true), res(gap('b'), false)];
    expect(weakLessons(results)).toEqual([
      { topicId: 'b', missed: 3 },
      { topicId: 'a', missed: 1 },
    ]);
  });

  it('on a tie the exam order stays, and at most MAX_LESSON_LINKS lessons come', () => {
    const results = ['d', 'c', 'b', 'a'].map((id) => res(gap(id), false));
    expect(weakLessons(results).map((l) => l.topicId)).toEqual(['d', 'c', 'b']);
    expect(MAX_LESSON_LINKS).toBe(3);
    expect(weakLessons(results, 1)).toHaveLength(1);
  });

  it('a word or reading error gives no lesson link, nor does a correct grammar answer', () => {
    expect(weakLessons([res(word('w1'), false), res(reading('r1'), false), res(gap('a'), true)])).toEqual([]);
  });
});
