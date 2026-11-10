// The XP of a practice answer. A correct answer in a practice mode
// is one half: it is recorded (lib/practice/halfStep.ts) and earns xpForHalf (lib/dailyXp.ts).
// A word with no card yet (null from recordPracticeResult) earns nothing either.

import { addXp, xpForHalf } from '../dailyXp';
import { getDb } from '../database';
import { recordPracticeResult, type PracticeOutcome } from './halfStep';

// `reviewCount` is the card's reps at the time of the answer, read BEFORE the half is recorded
// (the second half moves the card one step, reps + 1), as xpForCard gets it on the main card.
// `today` is for tests; left out, recordPracticeResult uses the local date.
export async function recordCorrectHalf(cardId: string, today?: string): Promise<PracticeOutcome | null> {
  const before = await getDb().getPcicCard(cardId);
  const outcome = today === undefined ? await recordPracticeResult(cardId, 'correct') : await recordPracticeResult(cardId, 'correct', today);
  if (outcome && before) {
    const points = xpForHalf({ reviewCount: before.reps });
    if (points > 0) await addXp(points);
  }
  return outcome;
}
