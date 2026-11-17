// Which test a level's row on the Grammar tab starts. One place decides it: a level with a Small test
// (app/grammar/small-test.tsx) opens that, every other level keeps the level test (app/grammar/level-test.tsx).
// A level that gets its Small test later is added to SMALL_TEST_LEVELS, nothing else changes.
export const SMALL_TEST_LEVELS: readonly string[] = ['A1'];

export const hasSmallTest = (level: string): boolean => SMALL_TEST_LEVELS.includes(level);

export const levelTestRoute = (level: string): string =>
  hasSmallTest(level) ? `/grammar/small-test?level=${level.toLowerCase()}` : `/grammar/level-test?level=${level}`;

// The level the learner last picked on the Grammar tab, kept per language pair (lib/resumeStore.ts).
export const grammarTabLevelKey = (pair: string): string => `grammar-tab-level:${pair}`;

/** A saved level pick, or null when it is missing, damaged or not a level of this course. */
export function parseTabLevel(raw: unknown, levels: readonly string[]): string | null {
  return typeof raw === 'string' && levels.includes(raw) ? raw : null;
}
