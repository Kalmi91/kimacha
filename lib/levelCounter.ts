// The numbers of components/practice/LevelCounter.tsx: the learner's level as the Words tab header shows it
// (its level chip + the "N words" chip = every item of the level), and how many words of the level are still due.
// "Still due" = due today and without a half yet (lib/practice/halfStep.ts): a word drops out of the number as soon as a
// practice answer credits it, not only when its second half moves it a full step, so the learner sees it shrink.

import type { PcicLevel } from '@/data/pcic';
import { cardsForLevel } from '@/lib/pcicLevels';
import { isDueCard } from '@/lib/sentenceTab';
import type { Sm2Card } from '@/lib/sm2';

export interface LevelCounts {
  level: PcicLevel;
  /** Items in the level (the Words tab's "N words" chip). */
  total: number;
  /** Words of the level due today that have no practice half yet. */
  due: number;
}

export function levelCounts(cards: readonly Sm2Card[], level: PcicLevel, total: number, today: string): LevelCounts {
  const due = cardsForLevel([...cards], level).filter((c) => isDueCard(c, today) && (c.halfSteps ?? 0) === 0).length;
  return { level, total, due };
}
