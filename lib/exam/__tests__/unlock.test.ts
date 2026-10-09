// The level exam opens when 80% of the level's cards are LEARNED (SM-2 `review`) AND
// there is a finished level lesson.

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { syllabusForLevel } from '@/lib/grammar/syllabus';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { doneLessonsOfLevel, examStatusFor, examUnlock, isExamLearned } from '../unlock';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `o${i + 1}`);
const review = (itemId: string): Sm2Card => ({ ...sm2NewCard(itemId), state: 'review', interval: 3, due: '2026-10-05' });

describe('isExamLearned (graduated, not only introduced)', () => {
  it('only a card in review state is learned', () => {
    expect(isExamLearned(sm2NewCard('o1'))).toBe(false);
    expect(isExamLearned({ ...sm2NewCard('o1'), state: 'learning' })).toBe(false);
    expect(isExamLearned(review('o1'))).toBe(true);
  });

  it('a lapsed card (learning again after a lapse) is not learned', () => {
    expect(isExamLearned({ ...sm2NewCard('o1'), state: 'learning', lapses: 2, reps: 5 })).toBe(false);
  });

  it('a card marked known by hand (review, known) is learned', () => {
    expect(isExamLearned({ ...review('o1'), known: true, interval: 60 })).toBe(true);
  });
});

describe('examUnlock (80% learned words + one finished lesson)', () => {
  const level = ids(150);

  it('120 / 150 learned words and one finished lesson: open', () => {
    const u = examUnlock('A1', level, ids(120).map(review), true);
    expect(u).toMatchObject({ total: 150, learned: 120, needed: 120, missing: 0, lessonDone: true, unlocked: true });
  });

  it('79% (119 / 150) locked, and says how much is missing', () => {
    const u = examUnlock('A1', level, ids(119).map(review), true);
    expect(u).toMatchObject({ learned: 119, needed: 120, missing: 1, unlocked: false });
  });

  it('118 / 150 (78.7%) is locked too', () => {
    expect(examUnlock('A1', level, ids(118).map(review), true).unlocked).toBe(false);
  });

  it('enough words, but no finished lesson: locked', () => {
    const u = examUnlock('A1', level, ids(150).map(review), false);
    expect(u).toMatchObject({ missing: 0, lessonDone: false, unlocked: false });
  });

  it('an introduced (learning) and a new card do not count as learned', () => {
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

  it('cards of another level (and orphan cards) do not count', () => {
    const cards = [...ids(119).map(review), review('o151'), review('a1-0184')];
    expect(examUnlock('A1', level, cards, true).learned).toBe(119);
  });

  it('no exam for an empty level', () => {
    expect(examUnlock('A1', [], [], true).unlocked).toBe(false);
  });
});

describe('examStatusFor (the real A1 words-open deck + the finished lessons)', () => {
  beforeEach(() => setPcicTarget('es'));

  const a1 = () => pcicItemsForLevel('A1').map((i) => i.id);
  const row = (topic: string) => ({ itemId: topic, state: 'done', data: { correct: 1, total: 1 } });

  it('80% of the level cards + one A1 lesson opens it, one fewer does not', () => {
    const needed = Math.ceil(0.8 * a1().length);
    expect(needed).toBeGreaterThan(1);
    const open = examStatusFor('A1', 'es', a1().slice(0, needed).map(review), [row('presente-regular')]);
    expect(open.unlocked).toBe(true);
    const closed = examStatusFor('A1', 'es', a1().slice(0, needed - 1).map(review), [row('presente-regular')]);
    expect(closed).toMatchObject({ unlocked: false, missing: 1, lessonDone: true });
  });

  it('a finished A2-level lesson does not open the A1 exam', () => {
    const a2Topic = syllabusForLevel('A2', 'es')[0].id;
    const status = examStatusFor('A1', 'es', a1().map(review), [row(a2Topic)]);
    expect(status).toMatchObject({ lessonDone: false, unlocked: false });
  });

  it('of the per-kind rows only a fully finished lesson counts (doneGrammarTopicProgress)', () => {
    // Only one of the presente-regular task kinds is done: the lesson is not finished.
    const partial = [{ itemId: 'presente-regular:choice', state: 'done', data: { correct: 1, total: 1 } }];
    expect(examStatusFor('A1', 'es', a1().map(review), partial).lessonDone).toBe(false);
  });

  it('the saved result goes into the status', () => {
    const result = { passed: true, best: 92, bestAt: '2026-10-01', last: 92, lastAt: '2026-10-01' };
    const status = examStatusFor('A1', 'es', a1().map(review), [row('presente-regular')], result);
    expect(status.result).toEqual(result);
  });
});

describe('doneLessonsOfLevel', () => {
  it('gives only the finished lessons that are in the syllabus of the given level', () => {
    const a2Topic = syllabusForLevel('A2', 'es')[0].id;
    expect(doneLessonsOfLevel('A1', 'es', ['presente-regular', a2Topic, 'nincs-ilyen'])).toEqual(['presente-regular']);
  });
});
