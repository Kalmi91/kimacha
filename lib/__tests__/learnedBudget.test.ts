// FB210, Kálmán 2026-09-10: „a napi új-szó számláló is csak helyes leírásra
// fogyjon". A 🌱 keret tehát a MEGTANULT szavakat számolja, és megtanult az a szó,
// amelyik végigment a létrán (a gépelős lapot is megírta helyesen).
//
// Két dolgot kell bizonyítani: a szó a létra végén kap dátumot (és csak egyszer),
// és amíg félkész, addig „kézben van", tehát nem jön helyette új.

import { getDb } from '../database.web';
import { newWordIntake, newWordsLeftToday } from '../newWordBudget';
import { getWordsForLevel } from '@/data/words';

const WORD = getWordsForLevel('A1', 'es')[0];

function card(reps: number, lapses = 0) {
  return {
    due: new Date(Date.now() + 60_000),
    stability: 1,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 1,
    learning_steps: 1,
    reps,
    lapses,
    state: reps >= 3 ? 2 : 1,
    last_review: new Date(),
  } as any;
}

describe('the daily budget waits for the word to be learned', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');
    await db.resetAllProgress();
    await db.ensureCard(WORD.id, 'word');
  });

  it('a word met but not yet spelled is in hand, not learned', async () => {
    // UTEMEZO 11. szakasz: a lap-állás most a tárolt lap/in_hand mezőkből jön,
    // nem az FSRS reps−lapses különbségéből, ezért a haladást startWord/passLap
    // szimulálja, nem updateCard.
    const db = getDb();
    await db.startWord(WORD.id);
    await db.passLap(WORD.id);

    expect(await db.getWordsLearnedToday()).toBe(0);
    expect(await db.getUnlearnedWordCount()).toBe(1);
  });

  it('a word still counts as in hand after two flashcard passes', async () => {
    // This is the case the old FSRS-state test missed: the card can graduate to
    // Review before its typing card has ever been shown.
    const db = getDb();
    await db.startWord(WORD.id);
    await db.passLap(WORD.id);
    await db.passLap(WORD.id);

    expect(await db.getWordsLearnedToday()).toBe(0);
    expect(await db.getUnlearnedWordCount()).toBe(1);
  });

  it('finishing the ladder spends one of the day\'s new words', async () => {
    const db = getDb();
    await db.startWord(WORD.id);
    await db.passLap(WORD.id);
    await db.passLap(WORD.id);
    await db.passLap(WORD.id);

    expect(await db.getWordsLearnedToday()).toBe(1);
    expect(await db.getUnlearnedWordCount()).toBe(0);
  });

  it('a later review of the same word does not spend a second one', async () => {
    const db = getDb();
    await db.startWord(WORD.id);
    await db.passLap(WORD.id);
    await db.passLap(WORD.id);
    await db.passLap(WORD.id);
    // A tanulás utáni FSRS-ismétlés updateCard-on megy, a lap-ot nem érinti.
    await db.updateCard(WORD.id, 'word', card(5));

    expect(await db.getWordsLearnedToday()).toBe(1);
  });

  it('a later FSRS lapse does not refund the budget or reopen the hand', async () => {
    // UTEMEZO 3.4: a 3 lap után az FSRS-t a további ismétlések (és lapse-ek)
    // már nem küldik vissza kézbe, a lap/in_hand csak a laponkénti haladást
    // tükrözi, nem a napi ismétlő-forgást.
    const db = getDb();
    await db.startWord(WORD.id);
    await db.passLap(WORD.id);
    await db.passLap(WORD.id);
    await db.passLap(WORD.id);
    await db.updateCard(WORD.id, 'word', card(4, 2));

    expect(await db.getUnlearnedWordCount()).toBe(0);
    expect(await db.getWordsLearnedToday()).toBe(1);
  });
});

// A két szám együtt: a keret a megtanultaktól fogy, az adagolás pedig a kézben
// lévőktől függ, tehát a napi új szavak száma nem szalad el.
describe('badge and intake together', () => {
  it('hands out the limit, then waits until they are learned', () => {
    const limit = 5;
    // Reggel: semmi kézben, semmi megtanulva.
    expect(newWordsLeftToday({ limit, bonus: 0, learnedToday: 0 })).toBe(5);
    expect(newWordIntake({ limit, bonus: 0, learnedToday: 0, unlearned: 0 })).toBe(5);

    // Öt szót elkezdett, egyiket sem tudja még leírni: a szám nem mozdul, és új
    // szó sem jön.
    expect(newWordsLeftToday({ limit, bonus: 0, learnedToday: 0, unlearned: 5 })).toBe(5);
    expect(newWordIntake({ limit, bonus: 0, learnedToday: 0, unlearned: 5 })).toBe(0);

    // Kettőt megtanult: a szám 3-ra megy, három van kézben, még mindig nincs új.
    expect(newWordsLeftToday({ limit, bonus: 0, learnedToday: 2, unlearned: 3 })).toBe(3);
    expect(newWordIntake({ limit, bonus: 0, learnedToday: 2, unlearned: 3 })).toBe(0);

    // Mind az ötöt megtanulta: a nap kerete elfogyott.
    expect(newWordsLeftToday({ limit, bonus: 0, learnedToday: 5, unlearned: 0 })).toBe(0);
    expect(newWordIntake({ limit, bonus: 0, learnedToday: 5, unlearned: 0 })).toBe(0);
  });
});
