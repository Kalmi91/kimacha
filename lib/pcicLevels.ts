// PLAN-play 10. lépés: a PCIC haladás szintenkénti elkülönítése. Minden PCIC
// tétel id-je a saját szintjével kezdődik ("b1-...", "a2-..."), ezért a
// pcic_cards tábla NEM tud szintet keverni: elég az id-előtaggal szűrni.
// Tiszta függvények, I/O nélkül, a hívó (app/(tabs)/index.tsx) adja a kártyákat.

import type { PcicLevel } from '@/data/pcic';
import type { Sm2Card } from './sm2';

export function matchesLevel(itemId: string, level: PcicLevel): boolean {
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
