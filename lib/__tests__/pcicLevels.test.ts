// PLAN-play 10. lépés: a PCIC haladás szintenkénti elkülönítése (id-előtag
// alapján), amit a szint-választó lap N / total sorai is használnak.

import { matchesLevel, cardsForLevel, levelProgress } from '../pcicLevels';
import { sm2NewCard } from '../sm2';

describe('matchesLevel', () => {
  it('matches an item id to its own level prefix', () => {
    expect(matchesLevel('b1-abc123', 'B1')).toBe(true);
    expect(matchesLevel('a1-abc123', 'B1')).toBe(false);
    expect(matchesLevel('a2-abc123', 'A2')).toBe(true);
  });
});

describe('cardsForLevel', () => {
  it('keeps only the cards whose id belongs to the level', () => {
    const cards = [sm2NewCard('a1-1'), sm2NewCard('b1-1'), sm2NewCard('b1-2'), sm2NewCard('b2-1')];
    expect(cardsForLevel(cards, 'B1').map((c) => c.itemId)).toEqual(['b1-1', 'b1-2']);
  });
});

describe('levelProgress', () => {
  it('keeps introduced-progress separate per level (RULES 8: no cross-level leak)', () => {
    const cards = [
      { ...sm2NewCard('a1-1'), state: 'review' as const },
      { ...sm2NewCard('a1-2'), state: 'review' as const },
      { ...sm2NewCard('b1-1'), state: 'new' as const },
    ];
    expect(levelProgress(cards, 'A1', 10)).toEqual({ introduced: 2, total: 10 });
    expect(levelProgress(cards, 'B1', 5)).toEqual({ introduced: 0, total: 5 });
  });

  it('reports zero introduced when nothing for that level has started', () => {
    expect(levelProgress([], 'A2', 951)).toEqual({ introduced: 0, total: 951 });
  });
});
