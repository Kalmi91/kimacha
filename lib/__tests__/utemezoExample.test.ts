// UTEMEZO 10. szakasz: a spec pelda-kore, sorrol sorra. Ha ez a teszt nem
// egyezik a tablazattal, a MOTOR a hibas, nem a teszt (lasd UTEMEZO 10. a
// "Ellenorzesi pontok a tesztekhez" resz).

import {
  createQueue,
  nextLap,
  answer,
  header,
  labelOf,
  type QueueState,
  type ReviewLap,
} from '../sessionQueue';

// Szavak: A..F = 1..6. Review-lapok (mar megtanult szavak esedekes 3. lapja):
// r1..r8 = 101..108, hogy a hibaüzenetek elkülönítsék öket a kézben lévö
// szavaktól.
const A = 1, B = 2, C = 3, D = 4, E = 5, F = 6;
const wordReview = (wordId: number): ReviewLap => ({
  wordId,
  type: 'word',
  isTyping: true,
  typingDirection: 'native-to-learned',
  repair: false,
});
const R = [101, 102, 103, 104, 105, 106, 107, 108].map(wordReview); // r1..r8

interface Row {
  label: string;
  wordId: number;
  correct: boolean;
  headerAfter: [number, number, number]; // black/blue/pink
}

// UTEMEZO 10. szakasz peldatablazata, sorrol sorra (23 lap).
const ROWS: Row[] = [
  { label: 'ismétlés', wordId: 101, correct: true, headerAfter: [15, 0, 7] }, // 1
  { label: 'ismétlés', wordId: 102, correct: true, headerAfter: [15, 0, 6] }, // 2
  { label: 'ismétlés', wordId: 103, correct: true, headerAfter: [15, 0, 5] }, // 3
  { label: 'ismétlés', wordId: 104, correct: true, headerAfter: [15, 0, 4] }, // 4
  { label: 'új · 1/3', wordId: A, correct: true, headerAfter: [14, 2, 4] }, // 5
  { label: 'ismétlés', wordId: 105, correct: true, headerAfter: [14, 2, 3] }, // 6
  { label: 'ismétlés', wordId: 106, correct: false, headerAfter: [14, 2, 3] }, // 7 RONTVA
  { label: 'ismétlés', wordId: 107, correct: true, headerAfter: [14, 2, 2] }, // 8
  { label: 'ismétlés', wordId: 108, correct: true, headerAfter: [14, 2, 1] }, // 9
  { label: 'új · 1/3', wordId: B, correct: true, headerAfter: [13, 4, 1] }, // 10
  { label: 'javítás', wordId: 106, correct: true, headerAfter: [13, 4, 0] }, // 11
  { label: 'új · 2/3', wordId: A, correct: true, headerAfter: [13, 3, 0] }, // 12
  { label: 'új · 1/3', wordId: C, correct: true, headerAfter: [12, 5, 0] }, // 13
  { label: 'új · 1/3', wordId: D, correct: true, headerAfter: [11, 7, 0] }, // 14
  { label: 'új · 1/3', wordId: E, correct: true, headerAfter: [10, 9, 0] }, // 15
  { label: 'új · 2/3', wordId: B, correct: true, headerAfter: [10, 8, 0] }, // 16
  { label: 'új · 3/3', wordId: A, correct: false, headerAfter: [10, 8, 0] }, // 17 RONTVA
  { label: 'új · 2/3', wordId: C, correct: true, headerAfter: [10, 7, 0] }, // 18
  { label: 'új · 2/3', wordId: D, correct: true, headerAfter: [10, 6, 0] }, // 19
  { label: 'új · 2/3', wordId: E, correct: true, headerAfter: [10, 5, 0] }, // 20
  { label: 'új · 3/3', wordId: B, correct: true, headerAfter: [10, 4, 0] }, // 21 (B megtanult)
  { label: 'új · 1/3', wordId: F, correct: true, headerAfter: [9, 6, 0] }, // 22
  { label: 'javítás · 3/3', wordId: A, correct: true, headerAfter: [9, 5, 0] }, // 23 (A megtanult)
];

function freshQueue(): QueueState {
  return createQueue({ black: 15, hand: [], reviews: R, fresh: [A, B, C, D, E, F] });
}

// Egy segéd, ami a teljes 23 lapos kört végigviszi, és minden lépés utáni
// állapotot visszaadja, hogy a checkpoint-tesztek ne kelljen újra végigmenjenek
// rajta.
function driveRound(): QueueState[] {
  let state = freshQueue();
  const after: QueueState[] = [];
  for (const row of ROWS) {
    state = nextLap(state);
    expect(state.current).not.toBeNull();
    expect(state.current!.wordId).toBe(row.wordId);
    expect(labelOf(state.current!)).toBe(row.label);
    const result = answer(state, row.correct);
    state = result.state;
    expect(state.current).toBeNull();
    const h = header(state);
    expect([h.black, h.blue, h.pink]).toEqual(row.headerAfter);
    after.push(state);
  }
  return after;
}

describe('UTEMEZO 10. szakasz: a pelda-kor', () => {
  it('a 23 lap sorban, cimkevel es fejleccel egyezik a spec tablazattal', () => {
    driveRound();
  });

  it('a fekete az 1. lapnal fogy, nem a 3/3-nal (5. lap)', () => {
    const after = driveRound();
    // 4. lap utan (index 3) a fekete meg 15, az 5. lap (index 4, A inditasa)
    // utan mar 14, az inditaskor fogy, nem a megtanulaskor.
    expect(header(after[3]).black).toBe(15);
    expect(header(after[4]).black).toBe(14);
  });

  it('a 7. es 11. lap ugyanaz a review-lap (106), legalabb R mas lap kozte', () => {
    let state = freshQueue();
    let step7 = -1;
    let step11 = -1;
    for (let i = 0; i < ROWS.length; i++) {
      state = nextLap(state);
      if (i === 6) {
        expect(state.current!.wordId).toBe(106);
        expect(state.current!.repair).toBe(false);
        step7 = state.step;
      }
      if (i === 10) {
        expect(state.current!.wordId).toBe(106);
        expect(state.current!.repair).toBe(true); // "javítás", mert visszajott
        step11 = state.step;
      }
      state = answer(state, ROWS[i].correct).state;
    }
    // UTEMEZO 4.2: "ha a sorban nincs elég másik lap a rés tartásához, a rés
    // annyi, amennyi van", itt csak 3 másik lap fért be (8,9,10), a 11. lap
    // ezért lép, mielőtt a teljes R (5) megvolna.
    expect(step11 - step7).toBe(4);
  });

  it('a 15. lapnal 5 szo van kezben, F csak a 22.-nel jon eloszor', () => {
    let state = freshQueue();
    for (let i = 0; i < ROWS.length; i++) {
      state = nextLap(state);
      if (i === 14) {
        // a 15. lap meg nincs megvalaszolva, de a szo mar bekerult kezbe
        expect(state.hand.length).toBe(5);
        expect(state.hand.map((h) => h.wordId).sort()).toEqual([A, B, C, D, E]);
      }
      if (i < 21) {
        expect(state.hand.some((h) => h.wordId === F)).toBe(false);
      }
      if (i === 21) {
        expect(state.current!.wordId).toBe(F);
        expect(state.current!.label).toBe('új · 1/3');
      }
      state = answer(state, ROWS[i].correct).state;
    }
  });

  it('determinisztikus: ugyanabbol az allapotbol ugyanaz a kovetkezo lap jon', () => {
    const state = freshQueue();
    const next1 = nextLap(state);
    const next2 = nextLap(state);
    expect(next2.current).toEqual(next1.current);
    expect(next2.step).toBe(next1.step);
  });

  it('egy megtanult szo effect-listaja: attempt, passLap, learned', () => {
    // A B szo a 21. lapnal tanul meg (3. lapja helyes).
    let state = freshQueue();
    for (let i = 0; i < 20; i++) {
      state = nextLap(state);
      state = answer(state, ROWS[i].correct).state;
    }
    state = nextLap(state);
    expect(state.current!.wordId).toBe(B);
    expect(state.current!.lap).toBe(3);
    const { effects, state: after } = answer(state, true);
    expect(effects).toEqual([
      { type: 'attempt', wordId: B, cardType: 'word', correct: true },
      { type: 'passLap', wordId: B },
      { type: 'learned', wordId: B },
    ]);
    expect(after.hand.some((h) => h.wordId === B)).toBe(false);
    expect(after.stats.wordsLearned).toBe(1);
  });

  it('kilepes a 15. lap utan: uj korben a kezben levok jonnek elore, a res tartva, fekete valtozatlan', () => {
    let state = freshQueue();
    for (let i = 0; i < 15; i++) {
      state = nextLap(state);
      state = answer(state, ROWS[i].correct).state;
    }
    expect(state.black).toBe(10);
    expect(state.hand.map((h) => h.wordId)).toEqual([A, B, C, D, E]);

    // Uj kor: a kezben levo szavak (wordId + lap) athozva, nincs review, es
    // csak F maradt a fresh listaban.
    let round2 = createQueue({
      black: state.black,
      hand: state.hand.map(({ wordId, lap }) => ({ wordId, lap })),
      reviews: [],
      fresh: [F],
    });

    const expected: Array<{ wordId: number; label: string }> = [
      { wordId: A, label: 'új · 3/3' },
      { wordId: B, label: 'új · 2/3' },
      { wordId: C, label: 'új · 2/3' },
      { wordId: D, label: 'új · 2/3' },
      { wordId: E, label: 'új · 2/3' },
    ];
    for (const exp of expected) {
      round2 = nextLap(round2);
      expect(round2.current!.wordId).toBe(exp.wordId);
      expect(labelOf(round2.current!)).toBe(exp.label);
      round2 = answer(round2, true).state;
    }
    expect(round2.black).toBe(10); // F meg nem indult, mert mindig volt eselyes kezben-levo lap
  });
});
