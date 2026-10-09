// Per-level separation of PCIC progress. The id of every PCIC item
// (originally) starts with its own level ("b1-...", "a2-...").
// Difficulty re-leveling can move a word into another level's file
// without changing its id (and thus its prefix)
// - from now on the actual level is decided by `levelOfItem` (data/pcic.ts,
// based on the loaded corpus); the id prefix is only a fallback when the id is
// not in the corpus (e.g. a test fixture id that was never a real PCIC item).
// Pure functions, no I/O; the caller (app/(tabs)/index.tsx) supplies the cards.

import { levelOfItem, type PcicLevel } from '@/data/pcic';
import type { Sm2Card } from './sm2';

export function matchesLevel(itemId: string, level: PcicLevel): boolean {
  const actual = levelOfItem(itemId);
  if (actual) return actual === level;
  return itemId.startsWith(`${level.toLowerCase()}-`);
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
