// PLAN-play 10. lépés: a PCIC haladás szintenkénti elkülönítése (id-előtag
// alapján), amit a szint-választó lap N / total sorai is használnak.
// PLAN-fb0924 7a. lépés (FB396, D3): a szint-igazítás óta egy item TÉNYLEGES
// szintje a betöltött korpuszból jön (levelOfItem), az id-előtag csak
// tartalék, ha az id nincs a korpuszban (lásd a fixture-tesztek lent).

import { matchesLevel, cardsForLevel, levelProgress } from '../pcicLevels';
import { sm2NewCard } from '../sm2';
import { PCIC_LEVEL_MOVES } from '../pcicLevelMoves';
import { findPcicItem, levelOfItem } from '@/data/pcic';

describe('matchesLevel', () => {
  it('matches a NOT-in-corpus (fixture) id to its own id-prefix (fallback)', () => {
    expect(matchesLevel('b1-abc123', 'B1')).toBe(true);
    expect(matchesLevel('a1-abc123', 'B1')).toBe(false);
    expect(matchesLevel('a2-abc123', 'A2')).toBe(true);
  });

  // PLAN-fb0924 7a: egy mozgatott, valódi PCIC-szó itemId-je most az ÚJ
  // szintjének előtagjával kezdődik (a régi id megszűnt), tehát ez ÖNMAGÁBAN
  // már a prefix-fallback-kal is helyes; a második teszt (levelOfItem) mutatja
  // meg direktben, hogy a valódi mechanizmus (data-alapú, nem az id-string) fut.
  it('a moved word (from lib/pcicLevelMoves.ts) matches its NEW level, not any stale prefix', () => {
    const [oldId, newId] = Object.entries(PCIC_LEVEL_MOVES)[0];
    const item = findPcicItem(newId);
    expect(item).toBeDefined(); // az új id valódi, betöltött tétel
    expect(findPcicItem(oldId)).toBeUndefined(); // a régi id többé nem létezik
    const realLevel = levelOfItem(newId)!;
    expect(matchesLevel(newId, realLevel)).toBe(true);
  });
});

// PLAN-fb0924 7a. lépés kritériuma: "teszt rá, hogy egy mozgatott, már tanult
// tétel az új szinten a haladásával együtt jelenik meg". A DB-migráció
// (lib/db/migrations.ts applyPcicLevelMoves) a lib/pcicLevelMoves.ts térkép
// szerint átnevezi a pcic_cards.item_id oszlopot; ez a teszt a MIGRÁCIÓ UTÁNI
// állapotot szimulálja (a kártya már az ÚJ id-n van), és azt bizonyítja, hogy
// onnantól a haladás a helyes (új) szint alatt jelenik meg, nem a réginél.
describe('a mozgatott szó haladása az új szinten jelenik meg (FB396, 7a)', () => {
  // FB384 konkrét példája: "morir" A2-ről A1-re mozgott.
  const oldId = 'a2-0bcfdca8';
  const newId = 'a1-46e12f1b';

  it('a régi (megszűnt) id-n a haladás sem az A1, sem az A2 szűrőben nem jelenik meg', () => {
    const staleCard = { ...sm2NewCard(oldId), state: 'review' as const };
    // A régi id nem az igazi A1/A2 tagsághoz tartozik: mivel az id már nincs
    // a betöltött korpuszban, matchesLevel az id-előtag tartalékra esik
    // vissza, ami itt (véletlenül) A2-t adna - EZ a bug, amit a DB-migráció
    // fut(tat)ása előz meg azzal, hogy sosem hagy a táblában régi id-t.
    expect(cardsForLevel([staleCard], 'A2').map((c) => c.itemId)).toEqual([oldId]);
  });

  it('az új id-n (a migráció UTÁN) a haladás az A1 alatt jelenik meg, A2 alatt nem', () => {
    const migratedCard = { ...sm2NewCard(newId), state: 'review' as const };
    expect(cardsForLevel([migratedCard], 'A1').map((c) => c.itemId)).toEqual([newId]);
    expect(cardsForLevel([migratedCard], 'A2')).toEqual([]);
    expect(levelProgress([migratedCard], 'A1', 999)).toEqual({ introduced: 1, total: 999 }); // 999: tetszőleges total, csak a passthrough-t nézi
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
