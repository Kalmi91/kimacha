// készségenkénti pontozás (pont, %, erős / gyenge) és a
// gyenge nyelvtanhoz a leggyakrabban elrontott leckék (a lecke-link célja).

import { scoreExam } from '../score';
import { MAX_LESSON_LINKS, skillResults, weakLessons } from '../skills';
import type { ExamItem, ExamItemResult } from '../types';

const word = (id: string): ExamItem => ({ kind: 'word_type', skill: 'words', itemId: id, prompt: 'p', answer: 'a' });
const gap = (topicId: string): ExamItem => ({ kind: 'gap_mc', skill: 'grammar', topicId, sentence: 'Yo ___ .', options: ['a', 'b', 'c'], correctIndex: 0 });
const reading = (id: string): ExamItem => ({ kind: 'reading_mc', skill: 'reading', itemIds: [id], text: 't', options: ['a', 'b', 'c'], correctIndex: 0 });
const res = (item: ExamItem, correct: boolean): ExamItemResult => ({ item, correct });

describe('skillResults', () => {
  it('készségenként pont és %, a sorrend: szó, nyelvtan, olvasás', () => {
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

  it('gyenge = a készség % az átmenési küszöb (80%) alatt: 4 / 5 még erős, 7 / 9 (77%) gyenge', () => {
    const four = Array.from({ length: 5 }, (_, i) => res(word(`w${i}`), i < 4));
    expect(skillResults(scoreExam(four))[0]).toMatchObject({ pct: 80, weak: false });
    const seven = Array.from({ length: 9 }, (_, i) => res(word(`w${i}`), i < 7));
    expect(skillResults(scoreExam(seven))[0]).toMatchObject({ pct: 77, weak: true });
  });

  it('79 / 100 gyenge (nincs felfelé kerekítés 80-ra)', () => {
    const results = Array.from({ length: 100 }, (_, i) => res(word(`w${i}`), i < 79));
    expect(skillResults(scoreExam(results))[0]).toMatchObject({ pct: 79, weak: true });
  });

  it('csak a vizsgában szerepelt készségek jelennek meg', () => {
    expect(skillResults(scoreExam([res(word('w1'), true)])).map((r) => r.skill)).toEqual(['words']);
    expect(skillResults(scoreExam([]))).toEqual([]);
  });
});

describe('weakLessons', () => {
  it('a hibás nyelvtani tételek leckéi, a legtöbbet elrontott elöl', () => {
    const results = [res(gap('a'), false), res(gap('b'), false), res(gap('b'), false), res(gap('c'), true), res(gap('b'), false)];
    expect(weakLessons(results)).toEqual([
      { topicId: 'b', missed: 3 },
      { topicId: 'a', missed: 1 },
    ]);
  });

  it('döntetlennél a vizsgabeli sorrend marad, és legfeljebb MAX_LESSON_LINKS lecke jön', () => {
    const results = ['d', 'c', 'b', 'a'].map((id) => res(gap(id), false));
    expect(weakLessons(results).map((l) => l.topicId)).toEqual(['d', 'c', 'b']);
    expect(MAX_LESSON_LINKS).toBe(3);
    expect(weakLessons(results, 1)).toHaveLength(1);
  });

  it('szó- és olvasás-hiba nem ad lecke-linket, helyes nyelvtani válasz sem', () => {
    expect(weakLessons([res(word('w1'), false), res(reading('r1'), false), res(gap('a'), true)])).toEqual([]);
  });
});
