// SZ2 (SZAVAK.md): a session-sor léptetése értékelés után és visszavonáskor.

import {
  countDoneToday,
  countIntroducedTodayByKind,
  requeueAfterGrade,
  requeueAfterUndo,
  reorderForReturn,
  nextPcicNewBonus,
  pcicNewBudget,
  pcicSessionNewLimit,
  pickStrongerSm2Card,
  thinSentences,
  type QueuedSm2Card,
} from '../pcicSession';
import { sm2NewCard, sm2Review, pickSm2Session, addDays, type Sm2Card } from '../sm2';
import type { PcicKind } from '@/data/pcic';

const TODAY = '2026-09-18';
const TOMORROW = addDays(TODAY, 1);

function reviewCard(overrides: Partial<Sm2Card> = {}): Sm2Card {
  return {
    itemId: 'b1-0001',
    state: 'review',
    step: 0,
    ease: 2.5,
    interval: 10,
    reps: 3,
    lapses: 0,
    due: TODAY,
    lastReview: addDays(TODAY, -10),
    introducedAt: addDays(TODAY, -30),
    ...overrides,
  };
}

describe('requeueAfterGrade', () => {
  it('learning kártya (due === today) a sor végére kerül', () => {
    const before = sm2NewCard('b1-0002');
    const graded = sm2Review(before, 'hard', TODAY); // learning, due today (LEARNING_STEPS=1: "good" már graduálna)
    const other = reviewCard({ itemId: 'b1-0003' });
    const queue = [before, other];

    const next = requeueAfterGrade(queue, graded, TODAY);

    expect(next).toEqual([other, graded]);
  });

  it('review kártya (due holnap) kikerül a sorból', () => {
    const before = reviewCard({ itemId: 'b1-0004', due: TODAY });
    const graded = sm2Review(before, 'good', TODAY); // review -> due later than today
    expect(graded.due).not.toBe(TODAY);
    const other = reviewCard({ itemId: 'b1-0005' });
    const queue = [before, other];

    const next = requeueAfterGrade(queue, graded, TODAY);

    expect(next).toEqual([other]);
  });

  it('FB312: egyelemű sor, learning lap (due ma) a grade után ugyanazt az egy lapot tartalmazza', () => {
    const before = sm2NewCard('b1-0010');
    const graded = sm2Review(before, 'hard', TODAY); // learning, due today, egyedüli lap a sorban (LEARNING_STEPS=1: "good" már graduálna)
    const queue = [before];

    const next = requeueAfterGrade(queue, graded, TODAY);

    expect(next).toEqual([graded]);
  });

  it('a visszahozott kártya "Knew it" után graduál és kikerül a mai sorból (LEARNING_STEPS=1)', () => {
    const now = 1_000_000;
    const missed = sm2Review(sm2NewCard('b1-0020'), 'again', TODAY);
    const other1 = reviewCard({ itemId: 'b1-0021' });
    const other2 = reviewCard({ itemId: 'b1-0022' });
    // "Didn't know" 60 s-os időzítővel, aztán 61 s múlva egy másik kártya értékelése előhozza.
    let queue = requeueAfterGrade([missed, other1, other2], missed, TODAY, 'again', now, 60);
    queue = requeueAfterGrade(queue, sm2Review(other1, 'again', TODAY), TODAY, 'again', now + 61_000, 60);
    expect(queue[0].itemId).toBe('b1-0020');

    const knew = sm2Review(queue[0], 'good', TODAY);
    expect(knew.due).not.toBe(TODAY); // egy "good" graduál (LEARNING_STEPS=1), nem marad ma esedékes
    const after = requeueAfterGrade(queue, knew, TODAY, 'good', now + 62_000, 60);

    expect(after.some((c) => c.itemId === 'b1-0020')).toBe(false); // graduált, kikerült a mai sorból
  });
});

describe('requeueAfterUndo', () => {
  it('undo learning után: a sor eleje "before", a vége már nem tartalmazza "graded"-et, hossz = eredeti', () => {
    const before = sm2NewCard('b1-0006');
    const graded = sm2Review(before, 'good', TODAY); // learning, due today
    const other = reviewCard({ itemId: 'b1-0007' });
    const queueAfterGrade = requeueAfterGrade([before, other], graded, TODAY); // [other, graded]

    const undone = requeueAfterUndo(queueAfterGrade, before, graded, TODAY);

    expect(undone).toEqual([before, other]);
    expect(undone.length).toBe(2);
    expect(undone.some((c) => c.itemId === graded.itemId && c.state === graded.state)).toBe(false);
  });

  it('undo review után: a sor eleje "before", a többi változatlan', () => {
    const before = reviewCard({ itemId: 'b1-0008', due: TODAY });
    const graded = sm2Review(before, 'good', TODAY); // review -> due later, drops out of queue
    const other = reviewCard({ itemId: 'b1-0009' });
    const queueAfterGrade = requeueAfterGrade([before, other], graded, TODAY); // [other]

    const undone = requeueAfterUndo(queueAfterGrade, before, graded, TODAY);

    expect(undone).toEqual([before, other]);
  });
});

// FB364 (PLAN-fb0923 5. lépés, D2): a rontott ("again") kártya N másodperc
// múlva mindenképp visszajön, akármennyi új/esedékes szó áll a sorban.
describe('reorderForReturn / requeueAfterGrade (FB364, again-időzítő)', () => {
  it('(a) 20 új szó a sorban, rontás, 60 s múlva a rontott jön', () => {
    const A = sm2NewCard('a1');
    const gradedA = sm2Review(A, 'again', TODAY); // learning, due today
    const others = Array.from({ length: 20 }, (_, i) => sm2NewCard(`n${i}`));
    const afterGrade = requeueAfterGrade([A, ...others], gradedA, TODAY, 'again', 0, 60);

    // Rögtön a rontás után (t=0) még nem esedékes, hátra kerül.
    expect(afterGrade[0].itemId).not.toBe('a1');

    // 60 s múlva a kiválasztás a 20 szó ellenére a rontottat adja.
    const reordered = reorderForReturn(afterGrade, 60_000);
    expect(reordered[0].itemId).toBe('a1');
  });

  it.each([15, 300])('(b) N = %i s is a rontott kártya visszatérési ideje', (n) => {
    const A = sm2NewCard('a1');
    const gradedA = sm2Review(A, 'again', TODAY);
    const other = sm2NewCard('b1');
    const afterGrade = requeueAfterGrade([A, other], gradedA, TODAY, 'again', 0, n);

    const tooEarly = reorderForReturn(afterGrade, n * 1000 - 1);
    expect(tooEarly[0].itemId).not.toBe('a1');

    const onTime = reorderForReturn(afterGrade, n * 1000);
    expect(onTime[0].itemId).toBe('a1');
  });

  it('(c) üres sor: a rontott a lejárat előtt is jön, ha nincs más kártya', () => {
    const A = sm2NewCard('a1');
    const gradedA = sm2Review(A, 'again', TODAY);
    const afterGrade = requeueAfterGrade([A], gradedA, TODAY, 'again', 0, 60);

    // t=0, a 60 s-os returnAt még nincs lejárva, de nincs más kártya a sorban.
    expect(afterGrade[0].itemId).toBe('a1');
    expect(afterGrade[0].returnAt).toBe(60_000);
  });

  it('(d) két rontás: a régebbi jön előbb', () => {
    const older: QueuedSm2Card = { ...sm2NewCard('old'), returnAt: 1000 };
    const newer: QueuedSm2Card = { ...sm2NewCard('new'), returnAt: 2000 };
    // "newer" ül elöl a sorban, de "older" returnAt-ja korábbi.
    const reordered = reorderForReturn([newer, older], 5000);
    expect(reordered[0].itemId).toBe('old');
  });

  it('"Knew it" (good) egy lépésben graduál (LEARNING_STEPS=1): kikerül a sorból, nincs időzítő', () => {
    const A = sm2NewCard('a1');
    const gradedA = sm2Review(A, 'good', TODAY); // egy "good" graduál, review, due holnap
    expect(gradedA.state).toBe('review');
    expect(gradedA.due).not.toBe(TODAY);
    const other = sm2NewCard('b1');
    const afterGrade = requeueAfterGrade([A, other], gradedA, TODAY, 'good', 0, 60);

    expect(afterGrade).toEqual([other]);
  });
});

describe('requeueAfterUndo (FB364, nincs árva időzítő)', () => {
  it('(e) undo után nincs árva időzítő', () => {
    const A = sm2NewCard('a1');
    const other = sm2NewCard('b1');
    const gradedA = sm2Review(A, 'again', TODAY);
    const afterGrade = requeueAfterGrade([A, other], gradedA, TODAY, 'again', 0, 60);

    const undone = requeueAfterUndo(afterGrade, A, gradedA, TODAY);

    expect(undone).toEqual([A, other]);
    expect(undone.every((c) => (c as QueuedSm2Card).returnAt === undefined)).toBe(true);
  });
});

// FB352: a napi haladás perzisztált `lastReview`-ból számolt, tab-váltás vagy
// app-újraindítás után is a valós napi számot kell adnia.
describe('countDoneToday', () => {
  it('counts only cards reviewed today', () => {
    const cards = [
      reviewCard({ itemId: 'b1-0011', lastReview: TODAY }),
      reviewCard({ itemId: 'b1-0012', lastReview: TODAY }),
      reviewCard({ itemId: 'b1-0013', lastReview: addDays(TODAY, -1) }),
      sm2NewCard('b1-0014'), // lastReview: null, még nem értékelt
    ];

    expect(countDoneToday(cards, TODAY)).toBe(2);
  });

  it('stays correct after a remount (fresh array, same persisted data)', () => {
    const persisted = [reviewCard({ itemId: 'b1-0015', lastReview: TODAY })];
    // Egy "remount" csak újra beolvassa ugyanazt az adatot, új tömbként.
    const reloaded = persisted.map((c) => ({ ...c }));

    expect(countDoneToday(reloaded, TODAY)).toBe(1);
  });

  it('returns 0 when nothing was reviewed today', () => {
    const cards = [reviewCard({ lastReview: addDays(TODAY, -1) }), sm2NewCard('b1-0016')];

    expect(countDoneToday(cards, TODAY)).toBe(0);
  });
});

// FB385/386: "+10 new words" was flat-added to the standing limit and kept
// only in React state (extraNew), so a tap after the day's introduced count
// already ran past the limit (limit 10, introduced today 18) gave back only
// 2 new cards instead of 10, and the bonus vanished on the next reload.
describe('nextPcicNewBonus + pcicNewBudget (FB385/386)', () => {
  it('reproduces the bug case: limit 10, 18 already introduced today, "+10" gives 10 new cards, not 2', () => {
    const limit = 10;
    const introducedToday = 18;
    const bonus = nextPcicNewBonus({ limit, bonus: 0, introducedToday });
    expect(bonus).toBe(18); // max(0, 18-10) + 10

    const effectiveLimit = pcicNewBudget({ limit, bonus, introducedToday });

    // Build a session where 18 cards were already introduced today and 10
    // fresh ones are still waiting, exactly like the reported case.
    const today = TODAY;
    const already = Array.from({ length: introducedToday }, (_, i) =>
      sm2Review(sm2NewCard(`b1-int-${i}`), 'good', today)
    );
    const freshOrder = Array.from({ length: 10 }, (_, i) => `b1-fresh-${i}`);
    const session = pickSm2Session(already, freshOrder, today, effectiveLimit);

    expect(session.filter((c) => c.state === 'new').length).toBe(10);
  });

  it('a second "+10" tap keeps stacking on top of the persisted bonus', () => {
    const limit = 10;
    const introducedToday = 5;
    const first = nextPcicNewBonus({ limit, bonus: 0, introducedToday });
    expect(first).toBe(10); // max(0, 5-10)=0, +10

    const second = nextPcicNewBonus({ limit, bonus: first, introducedToday });
    expect(second).toBe(20); // max(10, 5-10)=10, +10
  });

  it('a reload (fresh load() call) keeps giving the same budget as long as the persisted bonus and introduced count are unchanged', () => {
    const input = { limit: 10, bonus: 18, introducedToday: 18 };
    // load() re-derives the budget purely from the persisted bonus + the
    // cards read back from the DB, so calling it twice with the same
    // (persisted) inputs must not shrink the budget the way the old
    // React-state extraNew did (it reset to 0 on every load()).
    expect(pcicNewBudget(input)).toBe(pcicNewBudget(input));
    expect(pcicNewBudget(input)).toBe(28); // limit + bonus, well above introducedToday
  });

  it("a day change means the stored bonus no longer applies (only today's introduced count counts)", () => {
    // getPcicNewBonus(today) returns 0 once new_bonus_date !== today, so the
    // caller (load()) passes bonus: 0 the next day regardless of yesterday's value.
    const limit = 10;
    const introducedToday = 3;
    const budgetWithYesterdaysBonusExpired = pcicNewBudget({ limit, bonus: 0, introducedToday });
    expect(budgetWithYesterdaysBonusExpired).toBe(10); // back to the standing limit, no leftover bonus
  });
});

// FB387/395 (PLAN-fb0924 1b. lépés): a fejléc "ma: N szó · M mondat / keret"
// felbontása - a KIND szerinti szétválasztás, amit a "miért csak 6 vagy 8 jött 10
// helyett" panasz (FB387/395) valójában hiányolt (a maradék a másik fajtára ment).
function kindMap(map: Record<string, PcicKind>): (itemId: string) => PcicKind | undefined {
  return (itemId) => map[itemId];
}

describe('countIntroducedTodayByKind (FB387/395)', () => {
  it('szétválasztja a ma bevezetett szó- és mondat-kártyákat', () => {
    const cards = [
      reviewCard({ itemId: 'w1', introducedAt: TODAY }),
      reviewCard({ itemId: 'w2', introducedAt: TODAY }),
      reviewCard({ itemId: 's1', introducedAt: TODAY }),
      reviewCard({ itemId: 's2', introducedAt: TODAY }),
      reviewCard({ itemId: 's3', introducedAt: TODAY }),
    ];
    const kindOf = kindMap({ w1: 'word', w2: 'word', s1: 'sentence', s2: 'sentence', s3: 'sentence' });
    expect(countIntroducedTodayByKind(cards, TODAY, kindOf)).toEqual({ words: 2, sentences: 3 });
  });

  it('a phrase és a pattern is a szó-vödörbe esik, a lánc-mondat a mondat-vödörbe', () => {
    const cards = [
      reviewCard({ itemId: 'p1', introducedAt: TODAY }),
      reviewCard({ itemId: 'pat1', introducedAt: TODAY }),
      reviewCard({ itemId: 'chain-2', introducedAt: TODAY }), // lánc-tag, de kind: sentence
    ];
    const kindOf = kindMap({ p1: 'phrase', pat1: 'pattern', 'chain-2': 'sentence' });
    expect(countIntroducedTodayByKind(cards, TODAY, kindOf)).toEqual({ words: 2, sentences: 1 });
  });

  it('csak a MA bevezetett kártyákat számolja, a tegnapiakat nem', () => {
    const cards = [
      reviewCard({ itemId: 'today1', introducedAt: TODAY }),
      reviewCard({ itemId: 'yesterday1', introducedAt: addDays(TODAY, -1) }),
      sm2NewCard('never-introduced'), // introducedAt: null
    ];
    const kindOf = kindMap({ today1: 'word', yesterday1: 'word', 'never-introduced': 'word' });
    expect(countIntroducedTodayByKind(cards, TODAY, kindOf)).toEqual({ words: 1, sentences: 0 });
  });

  it('üres kártyalistára {0, 0}-t ad', () => {
    expect(countIntroducedTodayByKind([], TODAY, () => undefined)).toEqual({ words: 0, sentences: 0 });
  });
});

describe('pickStrongerSm2Card (FB384, 7b)', () => {
  it('több sikeres ismétlés (reps - lapses) nyer', () => {
    const strong = reviewCard({ itemId: 'x', reps: 10, lapses: 1 }); // 9 sikeres
    const weak = reviewCard({ itemId: 'y', reps: 5, lapses: 0 }); // 5 sikeres
    expect(pickStrongerSm2Card(strong, weak)).toBe(strong);
    expect(pickStrongerSm2Card(weak, strong)).toBe(strong);
  });

  it('holtversenynél (azonos sikeres ismétlés) a nagyobb interval nyer', () => {
    const strong = reviewCard({ itemId: 'x', reps: 5, lapses: 0, interval: 30 });
    const weak = reviewCard({ itemId: 'y', reps: 5, lapses: 0, interval: 10 });
    expect(pickStrongerSm2Card(strong, weak)).toBe(strong);
  });

  it('végső holtversenynél a korábbi esedékesség (due) nyer', () => {
    const earlier = reviewCard({ itemId: 'x', reps: 5, lapses: 0, interval: 10, due: TODAY });
    const later = reviewCard({ itemId: 'y', reps: 5, lapses: 0, interval: 10, due: addDays(TODAY, 5) });
    expect(pickStrongerSm2Card(earlier, later)).toBe(earlier);
  });
});

describe('thinSentences (PLAN-fb0924 8. lépés, FB394/396)', () => {
  const kind = kindMap({ w1: 'word', w2: 'word', w3: 'word', s1: 'sentence', s2: 'sentence', s3: 'sentence' });
  const ownGroup = (id: string) => id;

  it('az első mondat várakozás nélkül mehet', () => {
    const order = ['w1', 's1', 'w2', 'w3'];
    expect(thinSentences(order, kind, ownGroup, 2)).toEqual(['w1', 's1', 'w2', 'w3']);
  });

  it('egy második mondat kimarad, ha a kettő közt kevesebb, mint minGap nem-mondat kártya van', () => {
    const order = ['s1', 'w1', 's2', 'w2', 'w3'];
    // s1 -> s2 közt csak 1 szó van, minGap 2 -> s2 kimarad ebből a hívásból.
    expect(thinSentences(order, kind, ownGroup, 2)).toEqual(['s1', 'w1', 'w2', 'w3']);
  });

  it('a második mondat bekerül, ha elég nem-mondat kártya választja el az elsőtől', () => {
    const order = ['s1', 'w1', 'w2', 's2', 'w3'];
    expect(thinSentences(order, kind, ownGroup, 2)).toEqual(['s1', 'w1', 'w2', 's2', 'w3']);
  });

  it('egy csoport (groupOf) tagjai egymás után, rés nélkül is bemehetnek - EGY egységnek számítanak', () => {
    const order = ['w1', 's1', 's2', 'w2'];
    const sameGroup = () => 'chain-1'; // s1 és s2 ugyanabba a láncba tartozik
    expect(thinSentences(order, kind, sameGroup, 9)).toEqual(['w1', 's1', 's2', 'w2']);
  });

  it('nincs mondat a bemeneten -> a sorrend változatlan', () => {
    const order = ['w1', 'w2', 'w3'];
    expect(thinSentences(order, kind, ownGroup)).toEqual(order);
  });
});

// PLAN-fb1001 9. lépés (FB430, D1): a haladás-sáv a MAI adag hátralévőjét mutatja.
import { countFinishedToday, dayProgressPercent } from '../pcicSession';

describe('dayProgressPercent (FB430)', () => {
  it('az első kártyánál üres', () => {
    expect(dayProgressPercent(0, 30)).toBe(0);
  });

  it('lineárisan tölt: a felénél 50%, nem indul újra 10 kártyánál', () => {
    expect(dayProgressPercent(10, 20)).toBeCloseTo((10 / 29) * 100);
    expect(dayProgressPercent(11, 19)).toBeGreaterThan(dayProgressPercent(10, 20));
    expect(dayProgressPercent(15, 16)).toBe(50);
  });

  it('a nap utolsó kártyájánál tele', () => {
    expect(dayProgressPercent(29, 1)).toBe(100);
  });

  it('"+10 új" bővítés: a sor nő, az új teljes adaghoz mér (a sáv visszább lép, nem nullázódik)', () => {
    const before = dayProgressPercent(29, 1);
    const after = dayProgressPercent(29, 11); // 10 új kártya került a sorba
    expect(before).toBe(100);
    expect(after).toBeCloseTo((29 / 39) * 100);
    expect(after).toBeGreaterThan(0);
  });

  it('egyetlen kártya a napra: üres; nincs több kártya: tele csak ha volt kész', () => {
    expect(dayProgressPercent(0, 1)).toBe(0);
    expect(dayProgressPercent(0, 0)).toBe(0);
    expect(dayProgressPercent(5, 0)).toBe(100);
  });
});

describe('countFinishedToday (FB430)', () => {
  const card = (itemId: string, lastReview: string | null) => ({ ...sm2NewCard(itemId), lastReview });

  it('csak a ma értékelt ÉS már nem sorban álló kártyák számítanak késznek', () => {
    const a = card('a', '2026-10-01'); // kész
    const b = card('b', '2026-10-01'); // "again": ma értékelt, de a sorban maradt
    const c = card('c', '2026-09-30'); // tegnapi
    const d = card('d', null); // új
    expect(countFinishedToday([a, b, c, d], [b, d], '2026-10-01')).toBe(1);
  });
});

// FB452 ("new 42?"): a napi keret NAPI; a más szinten vett "+10"-ek nem jöhetnek vissza új szóként a másik szinten.
describe('pcicSessionNewLimit (FB452)', () => {
  const introduced = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => sm2Review(sm2NewCard(`${prefix}-${i}`), 'good', TODAY));
  const fresh = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}-new-${i}`);
  const newCount = (cards: Sm2Card[], order: string[], newLimit: number) =>
    pickSm2Session(cards, order, TODAY, newLimit).filter((c) => c.state === 'new').length;

  it('reprodukálja az esetet: A1-en 40 szó bevezetve (limit 10, bónusz 32), az A2-n nem jön 42 új szó', () => {
    const a1 = introduced('a1', 40);
    const old = pcicNewBudget({ limit: 10, bonus: 32, introducedToday: 0 }); // a régi: a szint 0 szava mellett a teljes keret
    expect(newCount([], fresh('a2', 100), old)).toBe(42);

    const limit = pcicSessionNewLimit({ limit: 10, bonus: 32, introducedAllLevels: a1.length, introducedThisLevel: 0 });
    expect(newCount([], fresh('a2', 100), limit)).toBe(2); // 10 + 32 - 40: a napi keretből ennyi maradt
  });

  it('egy szintnél (all === this) pontosan a régi pcicNewBudget', () => {
    for (const [limit, bonus, n] of [[10, 0, 0], [10, 0, 10], [10, 18, 18], [10, 20, 5]] as const) {
      expect(pcicSessionNewLimit({ limit, bonus, introducedAllLevels: n, introducedThisLevel: n })).toBe(
        pcicNewBudget({ limit, bonus, introducedToday: n })
      );
    }
  });

  it('a nézet szintjén bevezetettet a pickSm2Session vonja le, a másik szint szavait a keret', () => {
    const thisLevel = introduced('a2', 3);
    // más szinten ma 4 szó volt bevezetve; limit 10, bónusz 0: összesen 7 bevezetve, 3 új maradt
    const limit = pcicSessionNewLimit({ limit: 10, bonus: 0, introducedAllLevels: 7, introducedThisLevel: 3 });
    expect(newCount(thisLevel, fresh('a2', 100), limit)).toBe(3);
  });

  it('a "+10" a másik szintről örökölt bónusszal: a megmaradt 2 + az új 10 szó', () => {
    // A1-en 40 bevezetve, bónusz 32; A2-n "+10": a bónusz 42 lesz, a keret 52 - 40 = 12 új szó (2 megmaradt + 10)
    const next = nextPcicNewBonus({ limit: 10, bonus: 32, introducedToday: 40 });
    expect(next).toBe(42);
    const limit = pcicSessionNewLimit({ limit: 10, bonus: next, introducedAllLevels: 40, introducedThisLevel: 0 });
    expect(newCount([], fresh('a2', 100), limit)).toBe(12);
  });
});
