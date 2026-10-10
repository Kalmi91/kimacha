// Per-level separation of PCIC progress. The level of an item is decided by
// `levelOfItem` (data/pcic.ts, based on the loaded corpus); an id that is not
// in the corpus belongs to no level.
// Pure functions, no I/O; the caller (app/(tabs)/index.tsx) supplies the cards.

import { levelOfItem, type PcicLevel } from '@/data/pcic';
import type { Sm2Card } from './sm2';

export function matchesLevel(itemId: string, level: PcicLevel): boolean {
  return levelOfItem(itemId) === level;
}

export function cardsForLevel(cards: Sm2Card[], level: PcicLevel): Sm2Card[] {
  return cards.filter((c) => matchesLevel(c.itemId, level));
}

interface PcicLevelProgress {
  introduced: number;
  total: number;
}

// "Introduced" = no longer in the 'new' state (matches the introducedCount
// calculation of the done sheet in index.tsx), for the N / total row of the level picker sheet.
export function levelProgress(cards: Sm2Card[], level: PcicLevel, total: number): PcicLevelProgress {
  const introduced = cardsForLevel(cards, level).filter((c) => c.state !== 'new').length;
  return { introduced, total };
}
