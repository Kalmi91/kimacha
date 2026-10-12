// The XP of a practice answer (beta xpV2, HAROM-JATEK.md step 6). A correct answer in a practice mode
// is one half: it is recorded (lib/practice/halfStep.ts) and, with the XP v2 switch on, earns
// xpForHalf (lib/dailyXp.ts). With the switch off a half earns nothing: the old behavior.
// A word with no card yet (null from recordPracticeResult) earns nothing either.

import { addXp, xpForHalf } from '../dailyXp';
import { getDb } from '../database';
import { recordPracticeResult, type PracticeOutcome } from './halfStep';

// `reviewCount` is the card's reps at the time of the answer, read BEFORE the half is recorded
// (the second half moves the card one step, reps + 1), as xpForCard gets it on the main card.
export async function recordCorrectHalf(cardId: string, v2: boolean): Promise<PracticeOutcome | null> {
  const before = await getDb().getPcicCard(cardId);
  const outcome = await recordPracticeResult(cardId, 'correct');
  if (outcome && before) {
    const points = xpForHalf({ reviewCount: before.reps }, { v2 });
    if (points > 0) await addXp(points);
  }
  return outcome;
}
