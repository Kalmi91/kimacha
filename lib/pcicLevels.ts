// PLAN-play 10. lépés: a PCIC haladás szintenkénti elkülönítése. Minden PCIC
// tétel id-je (eredetileg) a saját szintjével kezdődik ("b1-...", "a2-...").
// PLAN-fb0924 7a. lépés (FB396, D3): a szint-igazítás mozgathat egy szót egy
// másik szint fájljába anélkül, hogy az id-je (és ezzel az előtagja) változna
// - a tényleges szintet innentől `levelOfItem` (data/pcic.ts, a betöltött
// korpusz alapján) dönti el, az id-előtag csak tartalék, ha az id nincs a
// korpuszban (pl. teszt-fixture id, ami sosem volt valódi PCIC-tétel).
// Tiszta függvények, I/O nélkül, a hívó (app/(tabs)/index.tsx) adja a kártyákat.

import { levelOfItem, isPlusSentence, realLevelOfView, type PcicLevel, type PcicViewLevel } from '@/data/pcic';
import type { Sm2Card } from './sm2';

export function matchesLevel(itemId: string, level: PcicLevel): boolean {
  const actual = levelOfItem(itemId);
  if (actual) return actual === level;
  return itemId.startsWith(`${level.toLowerCase()}-`);
}

export function cardsForLevel(cards: Sm2Card[], level: PcicLevel): Sm2Card[] {
  return cards.filter((c) => matchesLevel(c.itemId, level));
}

export interface PcicLevelProgress {
  introduced: number;
  total: number;
}

// "Introduced" = már nem 'new' állapotú (megegyezik az index.tsx done-lapjának
// introducedCount számításával), a szint-választó lap N / total sorához.
export function levelProgress(cards: Sm2Card[], level: PcicLevel, total: number): PcicLevelProgress {
  const introduced = cardsForLevel(cards, level).filter((c) => c.state !== 'new').length;
  return { introduced, total };
}

// PLAN-fb0924 8. lépés (FB394/396): mint a fenti hármas, de a "+1" virtuális
// szinteket is érti - egy tétel akkor tartozik egy NORMÁL nézethez, ha a
// valódi szintje egyezik ÉS nem "+1"-be tartozó mondat; egy "+1" nézethez,
// ha a valódi szintje egyezik ÉS "+1"-be tartozó mondat.
export function matchesViewLevel(itemId: string, view: PcicViewLevel): boolean {
  if (!matchesLevel(itemId, realLevelOfView(view))) return false;
  const wantPlus = view === 'A1+' || view === 'A2+';
  return isPlusSentence(itemId) === wantPlus;
}

export function cardsForViewLevel(cards: Sm2Card[], view: PcicViewLevel): Sm2Card[] {
  return cards.filter((c) => matchesViewLevel(c.itemId, view));
}

export function levelProgressView(cards: Sm2Card[], view: PcicViewLevel, total: number): PcicLevelProgress {
  const introduced = cardsForViewLevel(cards, view).filter((c) => c.state !== 'new').length;
  return { introduced, total };
}
