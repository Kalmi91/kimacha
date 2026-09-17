// UTEMEZO 3.5/3.6, 2.2/2.4 es a `defer`/`insertNext` motor-fuggvenyek tesztjei
// (lasd sessionQueue.ts engine resze es database.web.ts). Ezek a step 3
// UJ darabjai: a resume (kilepes kozepen), a szintvaltas, a valasz nelkuli
// tavozas (defer), a "mutasd mondatban" beszuras (insertNext), es a ket uj
// DB-fuggveny (getWordsStartedToday, getUntouchedWordIds), plusz hogy a
// review-lekerdezesek tenyleg kizarjak a kezben levo szavakat.

import {
  createQueue,
  nextLap,
  answer,
  defer,
  insertNext,
  header,
  labelOf,
  type LapNo,
  type ReviewLap,
} from '../sessionQueue';
import { getDb } from '../database.web';
import { getWordsForLevel } from '@/data/words';

describe('UTEMEZO 3.5: resume - a kezben levo szo a kovetkezo korben elore jon', () => {
  it('startWord + 1 passLap utan a hand-mappolt szo "uj · 2/3" cimkevel jon, meg uj szo elott', async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');
    await db.resetAllProgress();
    const [w1, w2, w3] = getWordsForLevel('A1', 'es');

    await db.startWord(w1.id);
    await db.passLap(w1.id); // 1. lap helyes: tarolt lap = 1

    const handRows = await db.getInHandWordCards();
    expect(handRows).toEqual([{ word_id: w1.id, lap: 1 }]);
    // A tarolt lap a MAR teljesitett lapok szama; a motor lap-je a KOVETKEZO
    // felkinalando lap, tehat +1.
    const hand = handRows.map((r) => ({ wordId: r.word_id, lap: Math.min(3, r.lap + 1) as LapNo }));

    let state = createQueue({ black: 5, hand, reviews: [], fresh: [w2.id, w3.id] });
    state = nextLap(state);
    expect(state.current!.wordId).toBe(w1.id);
    expect(labelOf(state.current!)).toBe('új · 2/3');
  });
});

describe('UTEMEZO 3.6: szintvaltas - a regi szint kezben levo szavai befejezodnek, uj szo mar az uj szintrol', () => {
  it('az A1 hand-szavak elorejonnek, az elso uj szo mar A2-rol indul es a fekete akkor csokken', () => {
    const a1 = getWordsForLevel('A1', 'es').slice(0, 2);
    const a2 = getWordsForLevel('A2', 'es').slice(0, 2);
    const hand = a1.map((w) => ({ wordId: w.id, lap: 2 as LapNo }));

    let state = createQueue({ black: 5, hand, reviews: [], fresh: a2.map((w) => w.id) });
    const seen: number[] = [];
    for (let i = 0; i < 2; i++) {
      state = nextLap(state);
      seen.push(state.current!.wordId);
      state = answer(state, true).state;
    }
    expect(seen).toEqual(a1.map((w) => w.id));

    const blackBefore = header(state).black;
    state = nextLap(state);
    expect(a2.some((w) => w.id === state.current!.wordId)).toBe(true);
    expect(header(state).black).toBeLessThan(blackBefore);
  });
});

describe('defer', () => {
  it('review-lap, drop=false: R hellyel kesobb ter vissza, a pink nem valtozik', () => {
    const reviews: ReviewLap[] = Array.from({ length: 10 }, (_, i) => ({
      wordId: 300 + i,
      type: 'word',
      isTyping: true,
      typingDirection: 'native-to-learned',
      repair: false,
    }));
    // FB296/297/298: black > 0, hogy ne a kerdes-lap johjon (fresh ures, tehat
    // uj szo ugysem indulna, a black erteke itt lenyegtelen a teszt celjahoz).
    let state = createQueue({ black: 1, hand: [], reviews, fresh: [] });
    state = nextLap(state);
    const shownWordId = state.current!.wordId;
    const pinkBefore = header(state).pink;

    const deferred = defer(state, { drop: false });
    expect(deferred.current).toBeNull();
    const at = Math.min(state.config.gap, state.reviews.length);
    expect(deferred.reviews[at].wordId).toBe(shownWordId);
    expect(header(deferred).pink).toBe(pinkBefore);
  });

  it('review-lap, drop=true: kikerul a korbol, pink -1', () => {
    const reviews: ReviewLap[] = Array.from({ length: 5 }, (_, i) => ({
      wordId: 400 + i,
      type: 'word',
      isTyping: true,
      typingDirection: 'native-to-learned',
      repair: false,
    }));
    // FB296/297/298: black > 0, hogy ne a kerdes-lap johjon (fresh ures, tehat
    // uj szo ugysem indulna, a black erteke itt lenyegtelen a teszt celjahoz).
    let state = createQueue({ black: 1, hand: [], reviews, fresh: [] });
    state = nextLap(state);
    const shownWordId = state.current!.wordId;
    const pinkBefore = header(state).pink;

    const dropped = defer(state, { drop: true });
    expect(dropped.reviews.some((r) => r.wordId === shownWordId)).toBe(false);
    expect(header(dropped).pink).toBe(pinkBefore - 1);
  });

  it('kezben-levo lap, drop=true: kikerul a hand-bol ERRE a korre, a kek a hatralevo lapjaival csokken', () => {
    const hand: { wordId: number; lap: LapNo }[] = [
      { wordId: 5001, lap: 1 },
      { wordId: 5002, lap: 2 },
    ];
    let state = createQueue({ black: 0, hand, reviews: [], fresh: [] });
    state = nextLap(state);
    const shownWordId = state.current!.wordId;
    const shownLap = state.current!.lap!;
    const blueBefore = header(state).blue;

    const dropped = defer(state, { drop: true });
    expect(dropped.hand.some((h) => h.wordId === shownWordId)).toBe(false);
    expect(header(dropped).blue).toBe(blueBefore - (4 - shownLap));
  });

  it('kezben-levo lap, drop=false: a helyen marad (a lastShown mar erre a lepesre all)', () => {
    const hand: { wordId: number; lap: LapNo }[] = [{ wordId: 6001, lap: 1 }];
    let state = createQueue({ black: 0, hand, reviews: [], fresh: [] });
    state = nextLap(state);
    const deferred = defer(state, { drop: false });
    expect(deferred.hand.some((h) => h.wordId === 6001)).toBe(true);
    expect(deferred.current).toBeNull();
  });
});

describe('insertNext', () => {
  it('a beszurt lap a legkozelebbi kovetkezo lap egy rontott kezben-levo lap utan', () => {
    const hand: { wordId: number; lap: LapNo }[] = [{ wordId: 7001, lap: 1 }];
    let state = createQueue({ black: 0, hand, reviews: [], fresh: [] });
    state = nextLap(state);
    expect(state.current!.wordId).toBe(7001);

    const { state: afterAnswer } = answer(state, false);
    const sentenceLap: ReviewLap = {
      wordId: 7001,
      type: 'sentence',
      isTyping: false,
      isEasySentence: true,
      repair: false,
    };
    const inserted = insertNext(afterAnswer, sentenceLap);
    const next = nextLap(inserted);
    expect(next.current!.wordId).toBe(7001);
    expect(next.current!.type).toBe('sentence');
  });
});

describe('UTEMEZO 2.2: getWordsStartedToday (database.web)', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');
    await db.resetAllProgress();
  });

  it('csak a MA elindult szot szamolja, a tegnapit nem', async () => {
    const db = getDb();
    const [w1, w2] = getWordsForLevel('A1', 'es');
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-01-01T10:00:00Z'));
      await db.startWord(w1.id);
      jest.setSystemTime(new Date('2026-01-02T10:00:00Z'));
      await db.startWord(w2.id);
      expect(await db.getWordsStartedToday()).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('UTEMEZO 2.4/12.1: getUntouchedWordIds (database.web)', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');
    await db.resetAllProgress();
  });

  it('kizarja az elindult es az eltemetett szavakat, az erintetlent (kartya nelkulit is) megtartja', async () => {
    const db = getDb();
    const [w1, w2, w3, w4] = getWordsForLevel('A1', 'es');
    await db.startWord(w2.id); // in_hand = 1
    await db.ensureCard(w3.id, 'word');
    await db.buryCard(w3.id, 'word');
    // w1, w4: meg ensureCard sem futott rajuk.

    const untouched = await db.getUntouchedWordIds([w1.id, w2.id, w3.id, w4.id]);
    expect(untouched.has(w1.id)).toBe(true);
    expect(untouched.has(w4.id)).toBe(true);
    expect(untouched.has(w2.id)).toBe(false);
    expect(untouched.has(w3.id)).toBe(false);
  });
});

describe('UTEMEZO 11. szakasz: a due-lekerdezesek kizarjak a kezben levo szavakat', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');
    await db.resetAllProgress();
  });

  it('lap=1/in_hand=1/esedekes szo hianyzik, lap=3-nal mar bennne van', async () => {
    const db = getDb();
    const [w1] = getWordsForLevel('A1', 'es');
    const past = new Date(Date.now() - 60_000);

    await db.startWord(w1.id);
    await db.passLap(w1.id); // lap = 1, in_hand = 1
    await db.updateCard(w1.id, 'word', {
      due: past, stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 1,
      learning_steps: 0, reps: 1, lapses: 0, state: 1, last_review: past,
    } as any);

    let due = await db.getDueCardsForLevel('A1', 100);
    expect(due.some((r: any) => r.word_id === w1.id)).toBe(false);

    await db.passLap(w1.id); // lap = 2
    await db.passLap(w1.id); // lap = 3, in_hand = 0 (megtanult)

    due = await db.getDueCardsForLevel('A1', 100);
    expect(due.some((r: any) => r.word_id === w1.id)).toBe(true);
  });
});
