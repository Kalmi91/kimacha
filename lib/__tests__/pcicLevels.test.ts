// Separating the PCIC progress per level, which the N / total rows of the level-picker
// sheet also use. An item's level comes from the loaded corpus (levelOfItem); an id that
// is not in the corpus belongs to no level.

import { matchesLevel, cardsForLevel, levelProgress } from '../pcicLevels';
import { sm2NewCard } from '../sm2';

describe('matchesLevel', () => {
  it('matches a corpus id to its own level only', () => {
    expect(matchesLevel('o1', 'A1')).toBe(true);
    expect(matchesLevel('o1', 'B1')).toBe(false);
    expect(matchesLevel('o301', 'B1')).toBe(true);
  });

  it('matches an id that is not in the corpus (e.g. a retired "a1-..." id) to no level', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
      expect(matchesLevel('b1-abc123', level)).toBe(false);
      expect(matchesLevel('a2-abc123', level)).toBe(false);
    }
  });
});

describe('cardsForLevel', () => {
  it('keeps only the cards whose id belongs to the level', () => {
    const cards = [sm2NewCard('o1'), sm2NewCard('o301'), sm2NewCard('o302'), sm2NewCard('o451')];
    expect(cardsForLevel(cards, 'B1').map((c) => c.itemId)).toEqual(['o301', 'o302']);
  });
});

describe('levelProgress', () => {
  it('keeps introduced-progress separate per level (RULES 8: no cross-level leak)', () => {
    const cards = [
      { ...sm2NewCard('o1'), state: 'review' as const },
      { ...sm2NewCard('o2'), state: 'review' as const },
      { ...sm2NewCard('o301'), state: 'new' as const },
    ];
    expect(levelProgress(cards, 'A1', 10)).toEqual({ introduced: 2, total: 10 });
    expect(levelProgress(cards, 'B1', 5)).toEqual({ introduced: 0, total: 5 });
  });

  it('reports zero introduced when nothing for that level has started', () => {
    expect(levelProgress([], 'A2', 951)).toEqual({ introduced: 0, total: 951 });
  });
});
