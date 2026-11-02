import * as fc from 'fast-check';
import { LEARNING_STEPS, MAX_INTERVAL_DAYS, addDays, pickSm2Session, sm2NewCard, sm2PreviewDays, sm2Review, type Sm2Card, type Sm2Grade } from '../sm2';

// Property tests of the SM-2 scheduler: whatever the answers and the gaps between the days, the schedule
// stays sane. The seed is fixed so CI is deterministic; FC_SEED=<n> searches elsewhere.
const RUN = { numRuns: 300, seed: Number(process.env.FC_SEED ?? 20261101) };
const GRADES: Sm2Grade[] = ['again', 'hard', 'good', 'easy'];
const EASE_FLOOR = 1.3;

// Independent calendar oracle: whole UTC days, so no time zone or DST can leak into the expected value.
const utcMs = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`);
const dayDiff = (a: string, b: string) => (utcMs(b) - utcMs(a)) / 86_400_000;
const ymdOf = (dayOffset: number) => new Date(Date.UTC(2000, 0, 1 + dayOffset)).toISOString().slice(0, 10);
const isRealDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(utcMs(s)) && new Date(utcMs(s)).toISOString().slice(0, 10) === s;

const todayArb = fc.integer({ min: 0, max: 365 * 60 }).map(ymdOf);
const gradeArb = fc.constantFrom(...GRADES);
const easeArb = fc.double({ min: EASE_FLOOR, max: 6, noNaN: true });
const countArb = fc.integer({ min: 0, max: 5000 });
const dayArb = fc.integer({ min: 0, max: 365 * 60 }).map(ymdOf);

const cardArb: fc.Arbitrary<Sm2Card> = fc.oneof(
  fc.string({ minLength: 1, maxLength: 8 }).map(sm2NewCard),
  fc.record({
    itemId: fc.string({ minLength: 1, maxLength: 8 }),
    state: fc.constant('learning' as const),
    step: fc.integer({ min: 0, max: LEARNING_STEPS - 1 }),
    ease: easeArb,
    interval: fc.integer({ min: 0, max: MAX_INTERVAL_DAYS }),
    reps: countArb,
    lapses: countArb,
    due: dayArb,
    lastReview: fc.option(dayArb, { nil: null }),
    introducedAt: fc.option(dayArb, { nil: null }),
  }),
  fc.record({
    itemId: fc.string({ minLength: 1, maxLength: 8 }),
    state: fc.constant('review' as const),
    step: fc.constant(0),
    ease: easeArb,
    interval: fc.integer({ min: 1, max: MAX_INTERVAL_DAYS }),
    reps: countArb,
    lapses: countArb,
    due: dayArb,
    lastReview: fc.option(dayArb, { nil: null }),
    introducedAt: fc.option(dayArb, { nil: null }),
  })
);

const stepArb = fc.record({ grade: gradeArb, gap: fc.integer({ min: 0, max: 400 }) });

// What must hold for a card right after a review on `today`, whatever happened before. Plain checks, not expect():
// this runs for every step of every generated run, and expect() makes that minutes long.
function must(ok: boolean, what: string, card: Sm2Card, today: string) {
  if (!ok) throw new Error(`${what} (today ${today}, card ${JSON.stringify(card)})`);
}

function expectSane(card: Sm2Card, today: string) {
  must(Number.isInteger(card.interval), 'interval is not an integer', card, today);
  must(card.interval >= 0 && card.interval <= MAX_INTERVAL_DAYS, 'interval outside 0..MAX_INTERVAL_DAYS', card, today);
  must(Number.isFinite(card.ease) && card.ease >= EASE_FLOOR, 'ease is not a finite number at or above the floor', card, today);
  must(Number.isInteger(card.reps) && card.reps > 0, 'reps is not a positive integer', card, today);
  must(Number.isInteger(card.lapses) && card.lapses >= 0, 'lapses is not a non-negative integer', card, today);
  must(card.lastReview === today, 'lastReview is not today', card, today);
  must(card.state !== 'new', 'a reviewed card is still new', card, today);
  must(isRealDate(card.due), 'due is not a real YYYY-MM-DD date', card, today);
  must(card.due >= today, 'due is in the past', card, today);
  if (card.state === 'review') {
    must(card.interval >= 1, 'a review card with an interval under 1 day', card, today);
    must(card.due > today, 'a review card that is not due on a later day', card, today);
    must(dayDiff(today, card.due) === card.interval, 'due is not today + interval', card, today);
  } else {
    must(card.due === today, 'a card in learning that does not come back today', card, today);
  }
}

describe('sm2Review properties', () => {
  it('addDays moves a real calendar date by exactly n days, in any time zone', () => {
    fc.assert(
      fc.property(todayArb, fc.integer({ min: -4000, max: 4000 }), (day, n) => {
        const moved = addDays(day, n);
        expect(isRealDate(moved)).toBe(true);
        expect(dayDiff(day, moved)).toBe(n);
      }),
      RUN
    );
  });

  it('keeps every card sane over any answer sequence and any gaps between the days', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 8 }), todayArb, fc.array(stepArb, { minLength: 1, maxLength: 60 }), (itemId, start, steps) => {
        let card = sm2NewCard(itemId);
        let today = start;
        let reps = 0;
        let lapses = 0;
        let firstDay = '';
        for (const { grade, gap } of steps) {
          today = addDays(today, gap);
          if (firstDay === '') firstDay = today;
          const before = card;
          card = sm2Review(card, grade, today);
          reps += 1;
          if (before.state === 'review' && grade === 'again') lapses += 1;
          expectSane(card, today);
          must(card.reps === reps && card.lapses === lapses, 'reps / lapses do not count the answers', card, today);
          must(card.introducedAt === firstDay, 'introducedAt is not the day of the first answer', card, today);
        }
      }),
      RUN
    );
  });

  it('keeps the interval at the ceiling (no NaN date) after a long run of good / easy answers', () => {
    fc.assert(
      fc.property(todayArb, fc.array(fc.constantFrom<Sm2Grade>('good', 'easy'), { minLength: 40, maxLength: 80 }), (start, grades) => {
        let card = sm2NewCard('x');
        let today = start;
        for (const grade of grades) {
          card = sm2Review(card, grade, today);
          expectSane(card, today);
          today = card.due; // the learner comes back exactly when it is due
        }
        expect(card.interval).toBe(MAX_INTERVAL_DAYS);
      }),
      { ...RUN, numRuns: 60 }
    );
  });

  it('moves the interval in the direction of the grade (any card, any ease)', () => {
    fc.assert(
      fc.property(cardArb, todayArb, (card, today) => {
        const next = Object.fromEntries(GRADES.map((g) => [g, sm2Review(card, g, today)])) as Record<Sm2Grade, Sm2Card>;
        for (const g of GRADES) expectSane(next[g], today);

        if (card.state === 'review') {
          // a lapse takes one day off (never below 1), the other answers push the interval out, up to the ceiling
          expect(next.again.interval).toBe(Math.max(1, card.interval - 1));
          expect(next.again.state).toBe('learning');
          expect(next.again.lapses).toBe(card.lapses + 1);
          for (const g of ['hard', 'good', 'easy'] as const) {
            expect(next[g].state).toBe('review');
            expect(next[g].interval).toBeGreaterThanOrEqual(Math.min(MAX_INTERVAL_DAYS, card.interval + 1));
          }
          expect(next.again.interval).toBeLessThan(next.hard.interval);
          expect(next.hard.interval).toBeLessThanOrEqual(next.good.interval);
          expect(next.good.interval).toBeLessThanOrEqual(next.easy.interval);
          // the ease moves with the grade and never leaves the floor
          expect(next.again.ease).toBeLessThanOrEqual(card.ease);
          expect(next.hard.ease).toBeLessThanOrEqual(card.ease);
          expect(next.good.ease).toBe(card.ease);
          expect(next.easy.ease).toBeGreaterThanOrEqual(card.ease);
        } else {
          expect(next.again.state).toBe('learning');
          expect(next.hard.state).toBe('learning');
          expect(next.good.state).toBe('review');
          expect(next.easy.state).toBe('review');
          expect(next.good.interval).toBeGreaterThanOrEqual(1);
          expect(next.easy.interval).toBeGreaterThanOrEqual(4);
          expect(next.good.interval).toBeLessThanOrEqual(next.easy.interval);
        }
      }),
      RUN
    );
  });

  it('does not change the card it was given', () => {
    fc.assert(
      fc.property(cardArb, gradeArb, todayArb, (card, grade, today) => {
        const copy = JSON.parse(JSON.stringify(card));
        sm2Review(card, grade, today);
        expect(card).toEqual(copy);
      }),
      RUN
    );
  });

  it('previews the days of each button exactly as the review would schedule them', () => {
    fc.assert(
      fc.property(cardArb, todayArb, (card, today) => {
        const days = sm2PreviewDays(card, today);
        for (const g of GRADES) {
          expect(Number.isInteger(days[g]) && days[g] >= 0).toBe(true);
          expect(days[g]).toBe(dayDiff(today, sm2Review(card, g, today).due));
        }
      }),
      RUN
    );
  });
});

describe('pickSm2Session properties', () => {
  it('lists each card once, only what is due or new, new ones within the daily budget', () => {
    const ids = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), { maxLength: 40 });
    fc.assert(
      fc.property(ids, fc.array(cardArb, { maxLength: 40 }), todayArb, fc.integer({ min: 0, max: 30 }), (order, pool, today, limit) => {
        // cards with unique ids; a few of them "introduced today"
        const cards = pool.map((c, i) => ({ ...c, itemId: `c${i}`, introducedAt: i % 4 === 0 ? today : c.introducedAt }));
        const newOrder = [...cards.map((c) => c.itemId), ...order.map((s) => `n-${s}`)];
        const session = pickSm2Session(cards, newOrder, today, limit);

        expect(new Set(session.map((c) => c.itemId)).size).toBe(session.length);
        const introducedToday = cards.filter((c) => c.introducedAt === today).length;
        const newOnes = session.filter((c) => c.state === 'new');
        expect(newOnes.length).toBeLessThanOrEqual(Math.max(0, limit - introducedToday));
        for (const c of session) {
          if (c.state === 'new') continue;
          expect(c.due <= today).toBe(true);
        }
        const reviews = session.filter((c) => c.state === 'review').map((c) => c.due);
        expect([...reviews].sort()).toEqual(reviews);
        // order: due reviews, then learning cards, then new cards
        const rank = (c: Sm2Card) => (c.state === 'review' ? 0 : c.state === 'learning' ? 1 : 2);
        const ranks = session.map(rank);
        expect([...ranks].sort()).toEqual(ranks);
      }),
      RUN
    );
  });
});
