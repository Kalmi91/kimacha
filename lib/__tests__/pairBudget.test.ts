import { getDb } from '../database.web';
import { newWordIntake, newWordsLeftToday } from '../newWordBudget';

// FB129/FB130, Kálmán 2026-08-14: "Nem tudom elkezdeni a szavakat tanulni spanyol
// rol magyarra", "A0 resz bugos nem kezdi el". A day spent on the en→es course had
// already used up the daily new-word budget, and the counter was shared by every
// language pair, so the fresh es→hu course started with an intake of zero: every
// new word was capped away, the sentence cadence then dropped the rest, and the
// learner landed straight on the Done screen.
describe('daily new-word budget is per language pair', () => {
  it('does not let one course exhaust another course\'s budget', async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    for (const wordId of [1001, 1002, 1003]) {
      await db.ensureCard(wordId, 'word');
      await db.recordAttempt(wordId, 'word', true, 900);
    }
    expect(await db.getNewWordsToday()).toBe(3);

    await db.setOnboarding('es', 'hu');
    expect(await db.getNewWordsToday()).toBe(0);

    const budget = {
      limit: await db.getDailyNewLimit(),
      bonus: await db.getNewLimitBonus(),
      learnedToday: await db.getWordsLearnedToday(),
      unlearned: await db.getUnlearnedWordCount(),
    };
    expect(newWordsLeftToday(budget)).toBeGreaterThan(0);
    expect(newWordIntake(budget)).toBeGreaterThan(0);
  });

  it('still counts the words started in the active pair', async () => {
    const db = getDb();
    await db.setOnboarding('es', 'hu');
    await db.ensureCard(6100, 'word');
    await db.recordAttempt(6100, 'word', true, 800);
    expect(await db.getNewWordsToday()).toBe(1);
  });

  // FB210: a keretet innentől a MEGTANULT szavak fogyasztják, tehát a pár-szerinti
  // elkülönítésnek erre a számra is állnia kell.
  it('counts the words learned today per pair as well', async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    // UTEMEZO 11. szakasz: megtanultság a lap-mezőből jön, startWord/passLap
    // szimulálja, nem az updateCard-nak adott reps.
    await db.startWord(6200);
    await db.passLap(6200);
    await db.passLap(6200);
    await db.passLap(6200);
    expect(await db.getWordsLearnedToday()).toBe(1);

    await db.setOnboarding('es', 'hu');
    expect(await db.getWordsLearnedToday()).toBe(0);
  });
});
