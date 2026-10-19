// Invariants of the SRS scheduler under long seeded-random grade sequences: sm2Review and
// recordPracticeResult (memory db). Deterministic: mulberry32 with fixed seeds.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { getDb } from '@/lib/database';
import { addDays, MAX_INTERVAL_DAYS, sm2MarkKnown, sm2NewCard, sm2Review, type Sm2Card, type Sm2Grade } from '@/lib/sm2';
import { recordPracticeResult, type PracticeResult } from '@/lib/practice/halfStep';

const STEPS = 200;
const SEEDS = [1, 7, 42, 2026, 123456];
const START = '2026-10-01';
const GRADES: Sm2Grade[] = ['again', 'hard', 'good', 'easy'];
const RESULTS: PracticeResult[] = ['correct', 'correct', 'wrongTyped', 'wrongOther'];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rnd: () => number, list: T[]): T => list[Math.floor(rnd() * list.length)];

// 0-3 days later, but never past the card's due date (the learner reviews it when it is due).
function nextDay(rnd: () => number, today: string, due: string): string {
  const day = addDays(today, Math.floor(rnd() * 4));
  return due && due < day ? (due > today ? due : today) : day;
}

const reviewCard = (itemId: string, over: Partial<Sm2Card> = {}): Sm2Card => ({
  ...sm2NewCard(itemId),
  state: 'review',
  interval: 10,
  reps: 3,
  due: addDays(START, 4),
  lastReview: addDays(START, -6),
  introducedAt: addDays(START, -30),
  ...over,
});

const STARTS: Array<[string, () => Sm2Card]> = [
  ['new card', () => sm2NewCard('x1')],
  ['review card', () => reviewCard('x2')],
  ['known card', () => sm2MarkKnown(sm2NewCard('x3'), addDays(START, -2))],
];

describe('sm2Review invariants (200 random grades)', () => {
  for (const [name, start] of STARTS) {
    for (const seed of SEEDS) {
      it(`${name}, seed ${seed}`, () => {
        const rnd = mulberry32(seed);
        let card = start();
        let today = START;
        let graduated = card.state === 'review';
        const reps0 = card.reps;
        for (let n = 1; n <= STEPS; n++) {
          today = nextDay(rnd, today, card.due);
          const grade = pick(rnd, GRADES);
          card = sm2Review(card, grade, today);
          if (card.state === 'review') graduated = true;
          expect(card.ease).toBeGreaterThanOrEqual(1.3);
          expect(card.interval).toBeLessThanOrEqual(MAX_INTERVAL_DAYS);
          expect(card.due >= today).toBe(true);
          if (graduated) expect(card.interval).toBeGreaterThanOrEqual(1);
          expect(card.reps).toBe(reps0 + n);
          if (grade === 'again') expect(card.known ?? false).toBe(false);
        }
      });
    }
  }
});

describe('recordPracticeResult invariants (200 random results, memory db)', () => {
  const db = getDb();
  beforeEach(async () => {
    await db.resetPcicCards();
  });

  for (const seed of SEEDS) {
    it(`seed ${seed}: ease, due and interval stay sane; a word that is not due never grows`, async () => {
      const rnd = mulberry32(seed);
      let today = START;
      await db.upsertPcicCard(reviewCard('p1'));
      let before = (await db.getPcicCard('p1'))!;
      for (let n = 0; n < STEPS; n++) {
        today = nextDay(rnd, today, before.due);
        const notDue = before.due > today;
        const result = pick(rnd, RESULTS);
        const outcome = await recordPracticeResult('p1', result, today);
        const after = (await db.getPcicCard('p1'))!;
        expect(outcome).not.toBeNull();
        expect(after.ease).toBeGreaterThanOrEqual(1.3);
        expect(after.interval).toBeLessThanOrEqual(MAX_INTERVAL_DAYS);
        expect(after.due >= today).toBe(true);
        expect(after.interval).toBeGreaterThanOrEqual(1);
        const stepped = outcome!.srs === 'forward' && !notDue;
        expect(after.reps).toBe(before.reps + (stepped ? 1 : 0));
        if (notDue) expect(after.interval).toBeLessThanOrEqual(before.interval);
        before = after;
      }
    });
  }
});
