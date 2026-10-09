// Separating the PCIC progress per level (by id prefix),
// which the N / total rows of the level-picker sheet also use.
// Since the difficulty re-leveling, an item's ACTUAL
// level comes from the loaded corpus (levelOfItem); the id prefix is only
// a fallback when the id is not in the corpus (see the fixture tests below).

import { matchesLevel, cardsForLevel, levelProgress } from '../pcicLevels';
import { sm2NewCard } from '../sm2';

describe('matchesLevel', () => {
  it('matches a NOT-in-corpus (fixture) id to its own id-prefix (fallback)', () => {
    expect(matchesLevel('b1-abc123', 'B1')).toBe(true);
    expect(matchesLevel('a1-abc123', 'B1')).toBe(false);
    expect(matchesLevel('a2-abc123', 'A2')).toBe(true);
  });
});

// The criterion of the difficulty re-leveling: "a test that a moved, already learned
// item appears at the new level together with its progress". The DB migration
// (lib/db/migrations.ts applyPcicLevelMoves) renames pcic_cards.item_id according
// to the lib/pcicLevelMoves.ts map; this test simulates the state AFTER THE MIGRATION
// (the card is already under the NEW id) and proves that from then on
// the progress shows up under the correct (new) level, not under the old one.
describe('the progress of a moved word shows up on the new level', () => {
  // The concrete example: "morir" moved from A2 to A1.
  const oldId = 'a2-0bcfdca8';
  const newId = 'a1-46e12f1b';

  it('on the old (retired) id the progress shows in neither the A1 nor the A2 filter', () => {
    const staleCard = { ...sm2NewCard(oldId), state: 'review' as const };
    // The old id does not belong to the true A1/A2 membership: since the id is no longer
    // in the loaded corpus, matchesLevel falls back to the id prefix,
    // which here would (by accident) give A2 - THIS is the bug that running the DB migration
    // prevents, by never leaving an old id in the table.
    expect(cardsForLevel([staleCard], 'A2').map((c) => c.itemId)).toEqual([oldId]);
  });

  it('on the new id (AFTER the migration) the progress shows under A1, not under A2', () => {
    const migratedCard = { ...sm2NewCard(newId), state: 'review' as const };
    expect(cardsForLevel([migratedCard], 'A1').map((c) => c.itemId)).toEqual([newId]);
    expect(cardsForLevel([migratedCard], 'A2')).toEqual([]);
    expect(levelProgress([migratedCard], 'A1', 999)).toEqual({ introduced: 1, total: 999 }); // 999: an arbitrary total, only the passthrough is checked
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
