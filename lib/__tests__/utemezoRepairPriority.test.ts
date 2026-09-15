// UTEMEZO 4.7: a rontott kezben-levo lap elsobbsege. A rontott lap
// R_javitas = min(config.repairGap, R) lap utan esedekes, es megelozi a
// review-lapokat, de ket kezben-levo lap kozt legalabb egy review-lap van
// (ha van review). R_javitas a nehezseg-ablakban allithato (1-10, alap 2).

import {
  createQueue,
  nextLap,
  answer,
  labelOf,
  DEFAULT_REPAIR_GAP,
  type QueueState,
  type ReviewLap,
} from '../sessionQueue';

const A = 1, B = 2;
const wordReview = (wordId: number): ReviewLap => ({
  wordId,
  type: 'word',
  isTyping: true,
  typingDirection: 'native-to-learned',
  repair: false,
});
// Bo review-keszlet, hogy a 4.4 ("elfogyott a review") ne szoljon bele.
const REVIEWS = Array.from({ length: 40 }, (_, i) => wordReview(200 + i));

// Addig huzza a sort, amig a megadott szo lapja fel nem jon; minden mas lapra
// helyes valasszal felel. A visszaadott szam a lepes, ahol a szo lapja jott.
function runUntil(state: QueueState, wordId: number, maxSteps = 60): { state: QueueState; step: number } {
  for (let i = 0; i < maxSteps; i++) {
    state = nextLap(state);
    if (state.current === null) break;
    if (state.current.wordId === wordId) return { state, step: state.step };
    state = answer(state, true).state;
  }
  throw new Error(`a ${wordId} szo lapja nem jott fel ${maxSteps} lepes alatt`);
}

function freshQueue(gap = 5, repairGap = DEFAULT_REPAIR_GAP): QueueState {
  return createQueue({
    config: { hand: 5, gap, rhythm: 4, repairGap },
    black: 15,
    hand: [],
    reviews: [...REVIEWS],
    fresh: [A, B],
  });
}

describe('UTEMEZO 4.7: rontott kezben-levo lap elsobbsege', () => {
  it('a rontott lap R_javitas (alap 2) lappal kesobb jon, nem a teljes R (5) utan', () => {
    let state = freshQueue();
    // A elso lapja feljon, es elrontjuk.
    const first = runUntil(state, A);
    state = answer(first.state, false).state;
    expect(state.hand[0].repair).toBe(true);

    // Ugyanaz a lap jon vissza, "javitas" cimkevel, pontosan REPAIR_GAP + 1
    // lepessel kesobb (kozte 2 mas lap).
    const back = runUntil(state, A);
    expect(back.step - first.step).toBe(DEFAULT_REPAIR_GAP + 1);
    expect(labelOf(back.state.current!)).toBe('javítás · 1/3');
    expect(back.state.current!.lap).toBe(1);
  });

  it('a rontott lap nem varja ki a 4.1 negyes ritmusat, de egy review-lap befer', () => {
    let state = freshQueue();
    const first = runUntil(state, A);
    state = answer(first.state, false).state;

    // A rontas utani ket lap review, a harmadik mar A javitasa: a negyes
    // ritmus (4 review / 1 kezben-levo lap) nem erveny az elsobbseg miatt.
    const labels: string[] = [];
    for (let i = 0; i < 3; i++) {
      state = nextLap(state);
      labels.push(state.current!.wordId === A ? 'A' : 'review');
      if (state.current!.wordId === A) break;
      state = answer(state, true).state;
    }
    expect(labels).toEqual(['review', 'review', 'A']);
  });

  it('a nehezseg-ablakban allitott R_javitas szamol: 4 lap eseten 4 lap', () => {
    let state = freshQueue(10, 4);
    const first = runUntil(state, A);
    state = answer(first.state, false).state;
    const back = runUntil(state, A);
    expect(back.step - first.step).toBe(5); // 4 mas lap, aztan a javitas
  });

  it('R = 1 eseten a javitas-res is 1, mert R_javitas sosem nagyobb R-nel', () => {
    let state = freshQueue(1);
    const first = runUntil(state, A);
    state = answer(first.state, false).state;
    const back = runUntil(state, A);
    // Egy review-lap fer be (a "legalabb 1 review-lap" korlat), aztan a javitas.
    expect(back.step - first.step).toBe(2);
  });

  it('a helyes valasz torli a javitas-jelzot, onnan mar a teljes R szamol', () => {
    let state = freshQueue();
    const first = runUntil(state, A);
    state = answer(first.state, false).state;
    const back = runUntil(state, A);
    state = answer(back.state, true).state; // javitas helyes: repair = false, lap 2
    expect(state.hand.find((h) => h.wordId === A)!.repair).toBe(false);

    const third = runUntil(state, A);
    expect(third.step - back.step).toBeGreaterThan(5); // R = 5, nem a rovid res
  });
});
