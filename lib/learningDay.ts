import { getDb } from '@/lib/database';

/**
 * Every answered learning task counts for the daily streak ("minden tanulás számít", Kálmán 2026-10-19): the Practice
 * and Sentences tabs, the grammar drills and the table decks call this on an answer, the PCIC grading calls
 * getDb().updateStreak() itself (lib/learn/usePcicSession.ts). It is that one write: only the first call of the local
 * day moves the streak, later calls are no-ops. A failed streak write must not break the exercise, so the rejection
 * is swallowed here once. Resolves after the write, so a screen that shows the streak can read it again.
 */
export async function countLearningToday(): Promise<void> {
  try {
    await getDb().updateStreak();
  } catch {
    // the exercise goes on, the day is counted by the next answer
  }
}
