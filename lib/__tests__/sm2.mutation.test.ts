// Cases of lib/sm2.ts that the mutation run (`npm run test:mutation`) showed nobody checks: the one-day floor of a review
// interval, the shape of a new card, a learning card left over from the 2-step era, the exact content and order of a session,
// what uses up the daily budget of new cards. Each test states the right behavior from the rules written in sm2.ts, not the
// current output of one input.

import { addDays, pickSm2Session, sm2NewCard, sm2Review, type Sm2Card, type Sm2Grade } from '../sm2';

const TODAY = '2026-09-18';
const YESTERDAY = addDays(TODAY, -1);
const TOMORROW = addDays(TODAY, 1);

function reviewCard(overrides: Partial<Sm2Card> = {}): Sm2Card {
  return {
    itemId: 'b1-0001',
    state: 'review',
    step: 0,
    ease: 2.5,
    interval: 10,
    reps: 3,
    lapses: 0,
    due: TODAY,
    lastReview: addDays(TODAY, -10),
    introducedAt: addDays(TODAY, -30),
    ...overrides,
  };
}

function learningCard(itemId: string, overrides: Partial<Sm2Card> = {}): Sm2Card {
  return { ...sm2NewCard(itemId), state: 'learning', due: TODAY, introducedAt: TODAY, ...overrides };
}

const ids = (cards: Sm2Card[]) => cards.map((c) => c.itemId);

describe('sm2NewCard', () => {
  it('has no due day until the first answer (an empty string), and no introduction or review day', () => {
    expect(sm2NewCard('b1-0001')).toEqual({ itemId: 'b1-0001', state: 'new', step: 0, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: '', lastReview: null, introducedAt: null });
  });
});

describe('a successful review always pushes a review card at least one day further', () => {
  // round(interval * factor) alone would give the same or a shorter interval for a short interval and a low ease.
  it.each([
    ['hard', 1, 1.3, 2],
    ['hard', 2, 1.3, 3],
    ['good', 1, 1.3, 2],
    ['good', 2, 1.3, 3],
  ] as [Sm2Grade, number, number, number][])('%s on interval %i at ease %s gives %i days', (grade, interval, ease, expected) => {
    const next = sm2Review(reviewCard({ interval, ease }), grade, TODAY);
    expect(next.interval).toBe(expected);
    expect(next.due).toBe(addDays(TODAY, expected));
  });

  it.each(['hard', 'good', 'easy'] as Sm2Grade[])('%s never leaves a card whose stored interval is 0 due today again', (grade) => {
    const next = sm2Review(reviewCard({ interval: 0 }), grade, TODAY);
    expect(next.interval).toBeGreaterThanOrEqual(1);
    expect(next.due > TODAY).toBe(true);
  });
});

describe('a learning card left over from the 2-step era (step 1 in the database)', () => {
  const old = learningCard('b1-0002', { step: 1, reps: 1 });

  it('again sends it back to the first step, hard keeps the step it is on', () => {
    expect(sm2Review(old, 'again', TODAY).step).toBe(0);
    expect(sm2Review(old, 'hard', TODAY).step).toBe(1);
  });

  it('good graduates it to review, easy too', () => {
    expect(sm2Review(old, 'good', TODAY)).toMatchObject({ state: 'review', step: 0, interval: 1, due: TOMORROW });
    expect(sm2Review(old, 'easy', TODAY)).toMatchObject({ state: 'review', step: 0, interval: 4 });
  });
});

describe('pickSm2Session', () => {
  it('lists each card once: due reviews oldest first, then due learning cards, then the new cards in file order', () => {
    const storedNew = sm2NewCard('n1'); // seen by the database layer before, still new: it is a new card of today's round, not skipped
    const cards = [
      reviewCard({ itemId: 'rToday', due: TODAY }),
      reviewCard({ itemId: 'rLater', due: TOMORROW }),
      learningCard('lToday', { due: TODAY }),
      learningCard('lLater', { due: TOMORROW }), // not due yet
      storedNew,
      reviewCard({ itemId: 'rOld', due: addDays(TODAY, -4) }),
    ];
    const session = pickSm2Session(cards, ['n1', 'n2'], TODAY, 20);
    expect(ids(session)).toEqual(['rOld', 'rToday', 'lToday', 'n1', 'n2']);
    expect(session[3]).toBe(storedNew);
  });

  it('sorts the due reviews by day whichever way the input is ordered', () => {
    const days = [0, -2, -9, -5];
    const cards = days.map((d) => reviewCard({ itemId: `d${d}`, due: addDays(TODAY, d) }));
    const expected = ['d-9', 'd-5', 'd-2', 'd0'];
    expect(ids(pickSm2Session(cards, [], TODAY))).toEqual(expected);
    expect(ids(pickSm2Session([...cards].reverse(), [], TODAY))).toEqual(expected);
  });

  it('keeps the input order of reviews that are due on the same day, also in a long list', () => {
    const cards: Sm2Card[] = [];
    for (let i = 0; i < 36; i++) cards.push(reviewCard({ itemId: `c${String(i).padStart(2, '0')}`, due: addDays(TODAY, -((i * 7) % 3)) }));
    const expected = [2, 1, 0].flatMap((back) => cards.filter((c) => c.due === addDays(TODAY, -back)).map((c) => c.itemId));
    expect(ids(pickSm2Session(cards, [], TODAY))).toEqual(expected);
  });

  it('counts only the cards introduced today against the daily budget of new cards', () => {
    // 5 cards introduced on earlier days do not use up today's budget; the 1 introduced today does.
    const earlier = ['a', 'b', 'c', 'd', 'e'].map((itemId) => reviewCard({ itemId, due: TOMORROW, introducedAt: YESTERDAY }));
    const today = learningCard('t', { due: TOMORROW, introducedAt: TODAY });
    const session = pickSm2Session([...earlier, today], ['n1', 'n2', 'n3', 'n4'], TODAY, 3);
    expect(ids(session)).toEqual(['n1', 'n2']);
  });
});
