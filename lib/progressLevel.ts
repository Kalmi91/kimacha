// The learner's level A1-C1 (HAROM-JATEK.md 4.3, decision 2026-10-12), shown on the Stats tab.
// A level is cleared when 80% of its words are learned AND every grammar topic of the level is
// done; XP plays no part. The levels build on each other: the learner's level is the highest one
// up to which every lower level is cleared too (no skipping); if not even A1 is cleared, the
// level is null ("heading for A1"). C2 is never offered (the ceiling is C1).
//
// Not the level exam (lib/exam/unlock.ts: 80% words + ONE finished lesson unlocks an exam): that
// is a different concept, this one needs ALL the level's topics and no exam.
// Pure function, no I/O; the DB reader is lib/progressLevelDb.ts.

import type { PcicLevel } from '@/data/pcic';

/** The levels in ascending order; C1 is the ceiling. */
export const PROGRESS_LEVELS: readonly PcicLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

/** Percent of a level's words that must be learned. */
export const LEVEL_WORDS_PCT = 80;

/** What is counted for one level. */
export interface LevelCounts {
  level: PcicLevel;
  /** Learned words of the level. */
  wordsKnown: number;
  /** All words of the level. */
  wordsTotal: number;
  /** Done grammar topics of the level. */
  grammarDone: number;
  /** All grammar topics of the level. */
  grammarTotal: number;
}

/** The progress toward one (not yet cleared) level. */
export interface NextLevelProgress extends LevelCounts {
  /** Learned words needed to clear the words side (80% of wordsTotal, rounded up). */
  wordsNeeded: number;
}

export interface ProgressLevel {
  /** The highest cleared level, or null if not even A1 is cleared. */
  level: PcicLevel | null;
  /** The first level that is not cleared yet; null once C1 is cleared. */
  next: NextLevelProgress | null;
}

/** Words needed at a level: 80% of the total, rounded up. */
export function wordsNeededFor(wordsTotal: number): number {
  return Math.ceil((wordsTotal * LEVEL_WORDS_PCT) / 100);
}

/**
 * Whether the level is cleared. A side with no content (0 words or 0 grammar topics) cannot be
 * satisfied, so an empty or not yet loaded level never counts as cleared.
 */
export function isLevelCleared(c: LevelCounts): boolean {
  if (c.wordsTotal <= 0 || c.grammarTotal <= 0) return false;
  return c.wordsKnown >= wordsNeededFor(c.wordsTotal) && c.grammarDone >= c.grammarTotal;
}

/**
 * `input`: the counts per level, in any order (a level missing from it counts as all zero,
 * i.e. not cleared).
 */
export function computeProgressLevel(input: readonly LevelCounts[]): ProgressLevel {
  const byLevel = new Map(input.map((c) => [c.level, c]));
  let level: PcicLevel | null = null;
  for (const l of PROGRESS_LEVELS) {
    const counts = byLevel.get(l) ?? { level: l, wordsKnown: 0, wordsTotal: 0, grammarDone: 0, grammarTotal: 0 };
    if (isLevelCleared(counts)) {
      level = l;
      continue;
    }
    return { level, next: { ...counts, wordsNeeded: wordsNeededFor(counts.wordsTotal) } };
  }
  return { level, next: null };
}
