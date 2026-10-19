// The practice-mode half-step logic (spec HAROM-JATEK.md 5.1): the pure counter rules and the DB
// function that moves the word on the SRS ladder. Memory db, the pattern of lib/__tests__/pcicDb.test.ts.


import { getDb } from '@/lib/database';
import { sm2NewCard, sm2Review, type Sm2Card } from '@/lib/sm2';
import { applyPracticeResult, recordPracticeResult, sm2StepBack } from '../halfStep';

const TODAY = '2026-10-12';

const review = (itemId: string, over: Partial<Sm2Card> = {}): Sm2Card => ({
  ...sm2NewCard(itemId),
  state: 'review',
  interval: 3,
  reps: 2,
  due: '2026-10-15',
  lastReview: '2026-10-12',
  introducedAt: '2026-10-09',
  ...over,
});

describe('applyPracticeResult (pure)', () => {
  it('correct: +1 half, the wrong streak resets; no SRS move yet', () => {
    expect(applyPracticeResult({ halfSteps: 0, wrongStreak: 0 }, 'correct')).toEqual({ halfSteps: 1, wrongStreak: 0, srs: 'none' });
    expect(applyPracticeResult({ halfSteps: 0, wrongStreak: 1 }, 'correct')).toEqual({ halfSteps: 1, wrongStreak: 0, srs: 'none' });
  });

  it('2 halves = 1 full step: the second correct answer moves forward and the halves reset', () => {
    expect(applyPracticeResult({ halfSteps: 1, wrongStreak: 0 }, 'correct')).toEqual({ halfSteps: 0, wrongStreak: 0, srs: 'forward' });
    expect(applyPracticeResult({ halfSteps: 1, wrongStreak: 1 }, 'correct')).toEqual({ halfSteps: 0, wrongStreak: 0, srs: 'forward' });
  });

  it('wrongTyped: the first one only counts; halves stay', () => {
    expect(applyPracticeResult({ halfSteps: 1, wrongStreak: 0 }, 'wrongTyped')).toEqual({ halfSteps: 1, wrongStreak: 1, srs: 'none' });
  });

  it('2 wrong typed answers in a row = 1 step back; halves and streak reset', () => {
    expect(applyPracticeResult({ halfSteps: 1, wrongStreak: 1 }, 'wrongTyped')).toEqual({ halfSteps: 0, wrongStreak: 0, srs: 'back' });
  });

  it('a correct answer between two wrong typed ones breaks the "in a row"', () => {
    let st = applyPracticeResult({ halfSteps: 0, wrongStreak: 0 }, 'wrongTyped');
    st = applyPracticeResult(st, 'correct');
    st = applyPracticeResult(st, 'wrongTyped');
    expect(st).toEqual({ halfSteps: 1, wrongStreak: 1, srs: 'none' });
  });

  it('wrongOther changes nothing, whatever the state', () => {
    expect(applyPracticeResult({ halfSteps: 0, wrongStreak: 0 }, 'wrongOther')).toEqual({ halfSteps: 0, wrongStreak: 0, srs: 'none' });
    expect(applyPracticeResult({ halfSteps: 1, wrongStreak: 1 }, 'wrongOther')).toEqual({ halfSteps: 1, wrongStreak: 1, srs: 'none' });
  });
});

describe('sm2StepBack', () => {
  it('a review card goes one interval back down the ladder (the inverse of a good), due from today', () => {
    const back = sm2StepBack(review('x', { interval: 8, ease: 2.5, due: '2026-10-20' }), TODAY);
    expect(back).toMatchObject({ state: 'review', interval: 3, due: '2026-10-15', lastReview: TODAY, ease: 2.5, lapses: 0 });
  });

  it('a card on its first review interval drops back to learning, due today', () => {
    expect(sm2StepBack(review('x', { interval: 1, due: '2026-10-13' }), TODAY)).toMatchObject({ state: 'learning', step: 0, due: TODAY });
  });

  it('a learning card stays learning, due today; never below 1 day; a new card is left alone', () => {
    expect(sm2StepBack({ ...review('l'), state: 'learning', step: 1 }, TODAY)).toMatchObject({ state: 'learning', step: 0, due: TODAY });
    expect(sm2StepBack(review('x', { interval: 2, ease: 1.3 }), TODAY).interval).toBe(2);
    expect(sm2StepBack(review('x', { interval: 2, ease: 3 }), TODAY).interval).toBe(1);
    const fresh = sm2NewCard('n');
    expect(sm2StepBack(fresh, TODAY)).toBe(fresh);
  });
});

describe('recordPracticeResult (memory db)', () => {
  const db = getDb();
  beforeEach(async () => {
    await db.resetPcicCards();
  });

  it('a word with no card, or a still-new card, is left alone', async () => {
    expect(await recordPracticeResult('nope', 'correct', TODAY)).toBeNull();
    await db.upsertPcicCard(sm2NewCard('fresh'));
    expect(await recordPracticeResult('fresh', 'correct', TODAY)).toBeNull();
    expect(await db.getPcicCard('nope')).toBeNull();
    expect((await db.getPcicCard('fresh'))?.halfSteps).toBe(0);
  });

  it('first correct answer = a half: saved, the schedule untouched, even if the word is not due', async () => {
    const card = review('w1', { due: '2026-11-30', interval: 6 });
    await db.upsertPcicCard(card);
    expect(await recordPracticeResult('w1', 'correct', TODAY)).toEqual({ halfSteps: 1, wrongStreak: 0, srs: 'none' });
    expect(await db.getPcicCard('w1')).toMatchObject({ halfSteps: 1, wrongStreak: 0, due: '2026-11-30', interval: 6, reps: 2 });
  });

  it('2 correct answers = 1 full step: the same schedule as the main card "Knew it" (good)', async () => {
    const card = review('w2', { due: TODAY, interval: 3 });
    await db.upsertPcicCard(card);
    await recordPracticeResult('w2', 'correct', TODAY);
    expect(await recordPracticeResult('w2', 'correct', TODAY)).toEqual({ halfSteps: 0, wrongStreak: 0, srs: 'forward' });
    const knewIt = sm2Review(card, 'good', TODAY);
    expect(await db.getPcicCard('w2')).toEqual({ ...knewIt, halfSteps: 0, wrongStreak: 0 });
  });

  it('2 correct answers on a word that is not due: the halves reset, but the interval and reps stay', async () => {
    const card = review('w2b', { due: '2026-10-13', interval: 3 });
    await db.upsertPcicCard(card);
    await recordPracticeResult('w2b', 'correct', TODAY);
    expect(await recordPracticeResult('w2b', 'correct', TODAY)).toEqual({ halfSteps: 0, wrongStreak: 0, srs: 'forward' });
    expect(await db.getPcicCard('w2b')).toEqual({ ...card, halfSteps: 0, wrongStreak: 0 });
  });

  it('2 wrong typed answers in a row = 1 step back; a wrong pick in between changes nothing', async () => {
    await db.upsertPcicCard(review('w3', { interval: 8, ease: 2.5, due: '2026-10-20' }));
    await recordPracticeResult('w3', 'wrongTyped', TODAY);
    await recordPracticeResult('w3', 'wrongOther', TODAY);
    expect(await db.getPcicCard('w3')).toMatchObject({ wrongStreak: 1, interval: 8, due: '2026-10-20' });
    expect(await recordPracticeResult('w3', 'wrongTyped', TODAY)).toEqual({ halfSteps: 0, wrongStreak: 0, srs: 'back' });
    expect(await db.getPcicCard('w3')).toMatchObject({ interval: 3, due: '2026-10-15', halfSteps: 0, wrongStreak: 0 });
  });

  it('a card from before the practice tab (no counters) starts from 0', async () => {
    await db.upsertPcicCard(review('old')); // halfSteps / wrongStreak undefined
    expect(await recordPracticeResult('old', 'correct', TODAY)).toMatchObject({ halfSteps: 1 });
  });
});
