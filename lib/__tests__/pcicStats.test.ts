import { countGraduated, countKnown, countLearned, KNOWN_THRESHOLD_DAYS } from '../pcicStats';
import { sm2NewCard, type Sm2Card } from '../sm2';

const review = (id: string, interval: number, known = false): Sm2Card => ({
  ...sm2NewCard(id),
  state: 'review',
  interval,
  due: '2026-09-23',
  known,
});

describe('countGraduated', () => {
  it('counts review-state cards, not new/learning', () => {
    const cards = [
      review('b1-1', 5),
      { ...sm2NewCard('b1-2'), state: 'learning' as const, due: '2026-09-23' },
      sm2NewCard('b1-3'),
    ];
    expect(countGraduated(cards)).toBe(1);
  });

  it('excludes "Don\'t learn this" (known: true) cards', () => {
    const cards = [review('b1-1', 5), review('b1-2', 60, true)];
    expect(countGraduated(cards)).toBe(1);
  });
});

describe('countKnown', () => {
  it('boundary: interval 20 is not known, 21 is (default threshold)', () => {
    expect(KNOWN_THRESHOLD_DAYS).toBe(21);
    const cards = [review('b1-1', 20), review('b1-2', 21)];
    expect(countKnown(cards)).toBe(1);
  });

  it('a learning-state card at any interval is never known', () => {
    const cards = [{ ...sm2NewCard('b1-1'), state: 'learning' as const, interval: 30, due: '2026-09-23' }];
    expect(countKnown(cards)).toBe(0);
  });

  it('excludes "Don\'t learn this" (known: true) cards even past the threshold', () => {
    const cards = [review('b1-1', 60, true), review('b1-2', 25, false)];
    expect(countKnown(cards)).toBe(1);
  });

  it('accepts a custom threshold', () => {
    const cards = [review('b1-1', 10), review('b1-2', 15)];
    expect(countKnown(cards, 10)).toBe(2);
    expect(countKnown(cards, 11)).toBe(1);
  });

  it('empty input gives zero for both counts', () => {
    expect(countKnown([])).toBe(0);
    expect(countGraduated([])).toBe(0);
  });
});

// a "Words Known" kártya a tanult szavakat számolja.
describe('countLearned', () => {
  const card = (over: Partial<import('../sm2').Sm2Card>) =>
    ({ itemId: 'x', state: 'new', step: 0, interval: 0, ease: 2.5, due: '2026-09-30', lapses: 0, ...over }) as import('../sm2').Sm2Card;

  it('a tanuló-lépéseken túljutott (review) és a kézzel ismertnek jelölt szó is számít, az új és a tanuló nem', () => {
    const cards = [
      card({ itemId: 'a', state: 'review', interval: 1 }),
      card({ itemId: 'b', state: 'review', interval: 30 }),
      card({ itemId: 'c', state: 'new', known: true }),
      card({ itemId: 'd', state: 'learning' }),
      card({ itemId: 'e', state: 'new' }),
    ];
    expect(countLearned(cards)).toBe(3);
  });

  it('a 21 napos küszöbű countKnown ettől szigorúbb', () => {
    const cards = [card({ itemId: 'a', state: 'review', interval: 1 }), card({ itemId: 'b', state: 'review', interval: 30 })];
    expect(countKnown(cards)).toBe(1);
    expect(countLearned(cards)).toBe(2);
  });
});
