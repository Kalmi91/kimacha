// PLAN-vizsga A. szakasz 3. lépés (Kálmán, 2026-10-01, A2 b + A3 a + A4 b): a szintvizsga
// akkor nyílik, ha a szint kártyáinak 80%-a TANULT (SM-2 `review`) ÉS van kész szint-lecke.

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { syllabusForLevel } from '@/lib/grammar/syllabus';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { doneLessonsOfLevel, examStatusFor, examUnlock, isExamLearned } from '../unlock';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `o${i + 1}`);
const review = (itemId: string): Sm2Card => ({ ...sm2NewCard(itemId), state: 'review', interval: 3, due: '2026-10-05' });

describe('isExamLearned (A2 b: graduált, nem csak bemutatott)', () => {
  it('csak a review állapotú kártya tanult', () => {
    expect(isExamLearned(sm2NewCard('o1'))).toBe(false);
    expect(isExamLearned({ ...sm2NewCard('o1'), state: 'learning' })).toBe(false);
    expect(isExamLearned(review('o1'))).toBe(true);
  });

  it('a visszaesett (lapse után újra learning) kártya nem tanult', () => {
    expect(isExamLearned({ ...sm2NewCard('o1'), state: 'learning', lapses: 2, reps: 5 })).toBe(false);
  });

  it('a kézzel tudottnak jelölt (review, known) kártya tanult', () => {
    expect(isExamLearned({ ...review('o1'), known: true, interval: 60 })).toBe(true);
  });
});

describe('examUnlock (A3 a + A4 b: 80% tanult szó + egy kész lecke)', () => {
  const level = ids(150);

  it('120 / 150 tanult szó és egy kész lecke: nyitva', () => {
    const u = examUnlock('A1', level, ids(120).map(review), true);
    expect(u).toMatchObject({ total: 150, learned: 120, needed: 120, missing: 0, lessonDone: true, unlocked: true });
  });

  it('79% (119 / 150) zárva, és megmondja, mennyi hiányzik', () => {
    const u = examUnlock('A1', level, ids(119).map(review), true);
    expect(u).toMatchObject({ learned: 119, needed: 120, missing: 1, unlocked: false });
  });

  it('a 118 / 150 (78,7%) is zárva', () => {
    expect(examUnlock('A1', level, ids(118).map(review), true).unlocked).toBe(false);
  });

  it('elég szó, de nincs kész lecke: zárva', () => {
    const u = examUnlock('A1', level, ids(150).map(review), false);
    expect(u).toMatchObject({ missing: 0, lessonDone: false, unlocked: false });
  });

  it('a bemutatott (learning) és az új kártya nem számít tanultnak', () => {
    const cards = [
      ...ids(100).map(review),
      ...ids(150)
        .slice(100)
        .map((id) => ({ ...sm2NewCard(id), state: 'learning' as const })),
    ];
    const u = examUnlock('A1', level, cards, true);
    expect(u.learned).toBe(100);
    expect(u.unlocked).toBe(false);
  });

  it('másik szint kártyái (és árva kártyák) nem számítanak bele', () => {
    const cards = [...ids(119).map(review), review('o151'), review('a1-0184')];
    expect(examUnlock('A1', level, cards, true).learned).toBe(119);
  });

  it('üres szintnél nincs vizsga', () => {
    expect(examUnlock('A1', [], [], true).unlocked).toBe(false);
  });
});

describe('examStatusFor (a valódi A1 words-open pakli + a kész leckék)', () => {
  beforeEach(() => setPcicTarget('es'));

  const a1 = () => pcicItemsForLevel('A1').map((i) => i.id);
  const row = (topic: string) => ({ itemId: topic, state: 'done', data: { correct: 1, total: 1 } });

  it('a szint 150 kártyájának 80%-a (120) + egy A1 lecke nyitja, 119 nem', () => {
    expect(a1()).toHaveLength(150);
    const open = examStatusFor('A1', 'es', a1().slice(0, 120).map(review), [row('presente-regular')]);
    expect(open.unlocked).toBe(true);
    const closed = examStatusFor('A1', 'es', a1().slice(0, 119).map(review), [row('presente-regular')]);
    expect(closed).toMatchObject({ unlocked: false, missing: 1, lessonDone: true });
  });

  it('A2 szintű kész lecke nem nyitja az A1 vizsgát', () => {
    const a2Topic = syllabusForLevel('A2', 'es')[0].id;
    const status = examStatusFor('A1', 'es', a1().map(review), [row(a2Topic)]);
    expect(status).toMatchObject({ lessonDone: false, unlocked: false });
  });

  it('a fajtánkénti sorok közül csak a teljesen kész lecke számít (doneGrammarTopicProgress)', () => {
    // presente-regular fajtái közül csak egy kész: nem kész lecke.
    const partial = [{ itemId: 'presente-regular:choice', state: 'done', data: { correct: 1, total: 1 } }];
    expect(examStatusFor('A1', 'es', a1().map(review), partial).lessonDone).toBe(false);
  });

  it('a mentett eredmény a státuszba kerül', () => {
    const result = { passed: true, best: 92, bestAt: '2026-10-01', last: 92, lastAt: '2026-10-01' };
    const status = examStatusFor('A1', 'es', a1().map(review), [row('presente-regular')], result);
    expect(status.result).toEqual(result);
  });
});

describe('doneLessonsOfLevel', () => {
  it('csak a megadott szint tantervében lévő kész leckéket adja', () => {
    const a2Topic = syllabusForLevel('A2', 'es')[0].id;
    expect(doneLessonsOfLevel('A1', 'es', ['presente-regular', a2Topic, 'nincs-ilyen'])).toEqual(['presente-regular']);
  });
});
