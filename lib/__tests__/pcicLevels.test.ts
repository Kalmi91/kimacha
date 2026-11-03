// Separating the PCIC progress per level, which the N / total rows of the level-picker
// sheet also use. An item's level comes from the loaded corpus (levelOfItem); an id that
// is not in the corpus belongs to no level.

import { matchesLevel, cardsForLevel, levelProgress, levelDone } from '../pcicLevels';
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

// FB547: the done look is decided per level (started + nothing due), not for the active level only.
describe('levelDone', () => {
  const today = '2026-11-02';
  const review = (id: string, due: string) => ({ ...sm2NewCard(id), state: 'review' as const, due });

  it('a started level with nothing due is done', () => {
    expect(levelDone([review('o1', '2026-11-05'), review('o2', '2026-11-09')], 'A1', today)).toBe(true);
  });

  it('a started level with one due card is not done', () => {
    expect(levelDone([review('o1', '2026-11-05'), review('o2', today)], 'A1', today)).toBe(false);
    expect(levelDone([review('o1', '2026-11-05'), review('o2', '2026-10-30')], 'A1', today)).toBe(false);
  });

  it('a card missed today (learning, due today) counts as due', () => {
    const missed = { ...sm2NewCard('o1'), state: 'learning' as const, due: today };
    expect(levelDone([missed], 'A1', today)).toBe(false);
  });

  it('a level with no started card is not done', () => {
    expect(levelDone([], 'A1', today)).toBe(false);
    expect(levelDone([sm2NewCard('o1')], 'A1', today)).toBe(false);
  });

  it('only the cards of the asked level count (A2 finished, A1 still due)', () => {
    const cards = [review('o151', '2026-11-08'), review('o1', today)];
    expect(levelDone(cards, 'A2', today)).toBe(true);
    expect(levelDone(cards, 'A1', today)).toBe(false);
    expect(levelDone(cards, 'B1', today)).toBe(false);
  });
});
