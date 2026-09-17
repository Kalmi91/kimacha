// UTEMEZO: FB293/294, Kálmán 2026-09-16: "ha bármelyik lapnál mondom, hogy I know
// this, akkor a szót tegye bele [a tudottak közé], ne a lapot", "a 3 szám közül a
// kék beragad". Ezek a `buryWord` (lib/sessionQueue.ts) motor-átmenet tesztjei,
// a `defer`/`insertNext` tesztek mintájára (lasd utemezoResume.test.ts).

import { createQueue, nextLap, header, buryWord, type LapNo, type ReviewLap } from '../sessionQueue';

describe('buryWord (FB293/294): "I know this" a szora vonatkozik, nem a lapra', () => {
  it('kezben levo szo 1/3-nal: kikerul a hand-bol es a szo minden review-lapjabol, a fekete nem valtozik', () => {
    const hand: { wordId: number; lap: LapNo }[] = [{ wordId: 9001, lap: 1 }, { wordId: 9003, lap: 2 }];
    const reviews: ReviewLap[] = [
      // ugyanennek a szonak egy mondat-lapja is varakozik: annak is el kell tunnie
      { wordId: 9001, type: 'sentence', isTyping: true, repair: false },
      { wordId: 9002, type: 'word', isTyping: true, typingDirection: 'native-to-learned', repair: false },
    ];
    const state = createQueue({ black: 3, hand, reviews, fresh: [] });
    const shownLap = state.hand[0].lap;
    const blueBefore = header(state).blue;

    const buried = buryWord(state, 9001);
    expect(buried.hand.map((h) => h.wordId)).toEqual([9003]);
    expect(buried.reviews.map((r) => r.wordId)).toEqual([9002]);
    expect(buried.black).toBe(state.black);
    expect(buried.stats.buried).toBe(1);
    expect(buried.current).toBeNull();
    // a fejlec kek szama a hand lapjaibol szamolodik, tehat magatol csokken
    expect(header(buried).blue).toBe(blueBefore - (4 - shownLap));
  });

  it('kezben levo szo bury utan a sor a kovetkezo elemre lep, mint egy helyes valasz utan', () => {
    const hand: { wordId: number; lap: LapNo }[] = [{ wordId: 9101, lap: 1 }];
    let state = createQueue({ black: 2, hand, reviews: [], fresh: [9102] });
    state = nextLap(state);
    expect(state.current!.wordId).toBe(9101);
    const blackBefore = header(state).black;

    const buried = buryWord(state, 9101);
    expect(buried.current).toBeNull();
    expect(buried.black).toBe(blackBefore);

    // a hand ures, a kovetkezo lap a sor kovetkezo eleme: uj szo indul a fresh-bol
    const next = nextLap(buried);
    expect(next.current!.wordId).toBe(9102);
  });

  it('review-lap szavan bury: a hatralevo review-lapjai (szo es mondat is) eltunnek a sorbol', () => {
    const reviews: ReviewLap[] = [
      { wordId: 9201, type: 'word', isTyping: true, typingDirection: 'native-to-learned', repair: false },
      { wordId: 9201, type: 'sentence', isTyping: true, repair: false },
      { wordId: 9202, type: 'word', isTyping: true, typingDirection: 'native-to-learned', repair: false },
    ];
    let state = createQueue({ black: 0, hand: [], reviews, fresh: [] });
    state = nextLap(state);
    expect(state.current!.wordId).toBe(9201);

    const buried = buryWord(state, 9201);
    expect(buried.reviews.map((r) => r.wordId)).toEqual([9202]);

    const next = nextLap(buried);
    expect(next.current!.wordId).toBe(9202);
  });

  it('a fresh-bol is kikerul, ha (a valoszinutlen esetben) ott lenne, determinisztikusan', () => {
    const state = createQueue({ black: 1, hand: [], reviews: [], fresh: [9301, 9302] });
    const buried = buryWord(state, 9301);
    expect(buried.fresh).toEqual([9302]);
  });

  it('nem szamit helyes valasznak: reviewsAnswered es wordsLearned nem no', () => {
    const hand: { wordId: number; lap: LapNo }[] = [{ wordId: 9401, lap: 3 }];
    const state = createQueue({ black: 0, hand, reviews: [], fresh: [] });
    const buried = buryWord(state, 9401);
    expect(buried.stats.reviewsAnswered).toBe(0);
    expect(buried.stats.wordsLearned).toBe(0);
    expect(buried.stats.wrongLaps).toBe(0);
    expect(buried.stats.buried).toBe(1);
  });
});
