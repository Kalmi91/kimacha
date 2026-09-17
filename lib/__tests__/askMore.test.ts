// UTEMEZO 5. szakasz (FB296/297/298, Kálmán döntése 2026-09-17): a kérdés-lap
// ("+N új szó / csak ismétlés / mára ennyi"), ami akkor jön, amikor ELŐSZÖR áll
// fenn a körben, hogy black === 0 ÉS hand üres ÉS van még reviews-lap. Lásd
// nextLap és answerAskMore (lib/sessionQueue.ts).

import {
  createQueue,
  nextLap,
  answer,
  answerAskMore,
  type LapNo,
  type ReviewLap,
} from '../sessionQueue';

const reviewLap = (wordId: number): ReviewLap => ({
  wordId,
  type: 'word',
  isTyping: true,
  typingDirection: 'native-to-learned',
  repair: false,
});

describe('kerdes-lap: "+N uj / csak ismetles / mara ennyi" (FB296/297/298)', () => {
  it('(a) az utolso kezben-levo szo 3. lapja utan a kovetkezo current a kerdes-lap, nem review', () => {
    const hand: { wordId: number; lap: LapNo }[] = [{ wordId: 501, lap: 3 }];
    let state = createQueue({ black: 0, hand, reviews: [reviewLap(701)], fresh: [] });
    // sinceHand magasra allitva, hogy a meg varakozo review ne elozze meg a
    // szo utolso lapjat (4. szakasz alapritmusa maskepp a review-t hozna elobb).
    state = { ...state, sinceHand: 10 };
    state = nextLap(state);
    expect(state.current!.kind).toBe('hand');
    expect(state.current!.wordId).toBe(501);
    expect(state.current!.lap).toBe(3);

    const { state: after } = answer(state, true);
    expect(after.hand.length).toBe(0);
    expect(after.reviews.length).toBe(1);

    const next = nextLap(after);
    expect(next.current).toEqual({ kind: 'ask-more', wordId: -1, type: 'word', label: 'kérdés', isTyping: false, repair: false });
    expect(next.askedMore).toBe(true);
  });

  it('(b) kezben levo szoval black 0: nincs kerdes, a kez lapja jon', () => {
    const hand: { wordId: number; lap: LapNo }[] = [{ wordId: 601, lap: 2 }];
    let state = createQueue({ black: 0, hand, reviews: [], fresh: [] });
    state = nextLap(state);
    expect(state.current!.kind).toBe('hand');
    expect(state.current!.wordId).toBe(601);
  });

  it('(c) "more" n=5: black 5, a kovetkezo lap uj szo, ha van fresh', () => {
    let state = createQueue({ black: 0, hand: [], reviews: [reviewLap(801)], fresh: [901] });
    state = { ...state, sinceHand: 10 };
    state = nextLap(state);
    expect(state.current!.kind).toBe('ask-more');

    const afterMore = answerAskMore(state, { kind: 'more', n: 5 });
    expect(afterMore.black).toBe(5);
    expect(afterMore.current).toBeNull();

    const next = nextLap(afterMore);
    expect(next.current!.kind).toBe('hand');
    expect(next.current!.wordId).toBe(901);
    expect(next.black).toBe(4); // uj szo inditasakor -1 (UTEMEZO 2.2)
  });

  it('(d) "review-only": review-lap jon, a kerdes nem ismetlodik a korben', () => {
    let state = createQueue({ black: 0, hand: [], reviews: [reviewLap(802), reviewLap(803)], fresh: [] });
    state = nextLap(state);
    expect(state.current!.kind).toBe('ask-more');

    const afterChoice = answerAskMore(state, { kind: 'review-only' });
    expect(afterChoice.black).toBe(0);

    const next = nextLap(afterChoice);
    expect(next.current!.kind).toBe('review');
    expect(next.askedMore).toBe(true);

    const afterAnswer = answer(next, true).state;
    const next2 = nextLap(afterAnswer);
    expect(next2.current!.kind).toBe('review'); // nem 'ask-more', mert askedMore mar true
  });

  it('(e) "done": a reviews kiurul, current null (Done-ut)', () => {
    let state = createQueue({ black: 0, hand: [], reviews: [reviewLap(804)], fresh: [] });
    state = nextLap(state);
    const after = answerAskMore(state, { kind: 'done' });
    expect(after.reviews).toEqual([]);
    expect(after.current).toBeNull();
  });

  it('(f) black 0, kez ures, review 0: nincs kerdes-lap, current null (a Done-kerdes utja)', () => {
    let state = createQueue({ black: 0, hand: [], reviews: [], fresh: [] });
    state = nextLap(state);
    expect(state.current).toBeNull();
  });
});
