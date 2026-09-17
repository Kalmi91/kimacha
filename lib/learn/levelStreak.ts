import { getDb } from '@/lib/database';
import { LEVELS, type Level } from '@/data/words';

// Moved from app/(tabs)/index.tsx, structural extraction only, no behavior
// change: tracks the correct/mistake/fail streaks that drive level-up.
export async function checkLevelChange(wasCorrect: boolean): Promise<void> {
  const db = getDb();
  const levelData = await db.getLevel();
  let { correct_streak, mistakes_in_window, fail_streak } = levelData;
  const currentLevel = levelData.level as Level;
  const levelIdx = LEVELS.indexOf(currentLevel);

  if (wasCorrect) {
    correct_streak += 1;
    fail_streak = 0;
  } else {
    fail_streak += 1;
    mistakes_in_window += 1;
    correct_streak = 0;
  }
  await db.updateLevel(currentLevel, correct_streak, mistakes_in_window, fail_streak);
}
