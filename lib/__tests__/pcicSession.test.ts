// stepping the session queue after grading and on undo.

import {
  countDoneToday,
  countIntroducedTodayByKind,
  requeueAfterGrade,
  requeueAfterUndo,
  reorderForReturn,
  nextPcicNewBonus,
  pcicNewBudget,
  pcicSessionNewLimit,
  practiceTopUpStep,
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
  it('a learning card (due === today) goes to the end of the queue', () => {
    const before = sm2NewCard('b1-0002');
    const graded = sm2Review(before, 'hard', TODAY); // learning, due today (LEARNING_STEPS=1: "good" would already graduate)
    const other = reviewCard({ itemId: 'b1-0003' });
    const queue = [before, other];

    const next = requeueAfterGrade(queue, graded, TODAY);

    expect(next).toEqual([other, graded]);
  });

  it('a review card (due tomorrow) drops out of the queue', () => {
    const before = reviewCard({ itemId: 'b1-0004', due: TODAY });
    const graded = sm2Review(before, 'good', TODAY); // review -> due later than today
    expect(graded.due).not.toBe(TODAY);
    const other = reviewCard({ itemId: 'b1-0005' });
    const queue = [before, other];

    const next = requeueAfterGrade(queue, graded, TODAY);

    expect(next).toEqual([other]);
  });

  it('a one-item queue, learning card (due today) contains the same single card after the grade', () => {
    const before = sm2NewCard('b1-0010');
    const graded = sm2Review(before, 'hard', TODAY); // learning, due today, the only card in the queue (LEARNING_STEPS=1: "good" would already graduate)
    const queue = [before];

    const next = requeueAfterGrade(queue, graded, TODAY);

    expect(next).toEqual([graded]);
  });

  it('the returned card graduates after "Knew it" and drops out of today\'s queue (LEARNING_STEPS=1)', () => {
    const now = 1_000_000;
    const missed = sm2Review(sm2NewCard('b1-0020'), 'again', TODAY);
    const other1 = reviewCard({ itemId: 'b1-0021' });
    const other2 = reviewCard({ itemId: 'b1-0022' });
    // "Didn't know" with a 60 s timer, then 61 s later grading another card brings it back.
    let queue = requeueAfterGrade([missed, other1, other2], missed, TODAY, 'again', now, 60);
    queue = requeueAfterGrade(queue, sm2Review(other1, 'again', TODAY), TODAY, 'again', now + 61_000, 60);
    expect(queue[0].itemId).toBe('b1-0020');

    const knew = sm2Review(queue[0], 'good', TODAY);
    expect(knew.due).not.toBe(TODAY); // a "good" graduates (LEARNING_STEPS=1), it does not stay due today
    const after = requeueAfterGrade(queue, knew, TODAY, 'good', now + 62_000, 60);

    expect(after.some((c) => c.itemId === 'b1-0020')).toBe(false); // graduated, dropped out of today's queue
  });
});

describe('requeueAfterUndo', () => {
  it('after undo of learning: the queue head is "before", the end no longer contains "graded", length = original', () => {
    const before = sm2NewCard('b1-0006');
    const graded = sm2Review(before, 'good', TODAY); // learning, due today
    const other = reviewCard({ itemId: 'b1-0007' });
    const queueAfterGrade = requeueAfterGrade([before, other], graded, TODAY); // [other, graded]

    const undone = requeueAfterUndo(queueAfterGrade, before, graded, TODAY);

    expect(undone).toEqual([before, other]);
    expect(undone.length).toBe(2);
    expect(undone.some((c) => c.itemId === graded.itemId && c.state === graded.state)).toBe(false);
  });

  it('after undo of review: the queue head is "before", the rest unchanged', () => {
    const before = reviewCard({ itemId: 'b1-0008', due: TODAY });
    const graded = sm2Review(before, 'good', TODAY); // review -> due later, drops out of queue
    const other = reviewCard({ itemId: 'b1-0009' });
    const queueAfterGrade = requeueAfterGrade([before, other], graded, TODAY); // [other]

    const undone = requeueAfterUndo(queueAfterGrade, before, graded, TODAY);

    expect(undone).toEqual([before, other]);
  });
});

// a failed ("again") card definitely comes back after N seconds,
// no matter how many new/due words are in the queue.
describe('reorderForReturn / requeueAfterGrade (again timer)', () => {
  it('(a) 20 new words in the queue, a miss, after 60 s the missed one comes', () => {
    const A = sm2NewCard('a1');
    const gradedA = sm2Review(A, 'again', TODAY); // learning, due today
    const others = Array.from({ length: 20 }, (_, i) => sm2NewCard(`n${i}`));
    const afterGrade = requeueAfterGrade([A, ...others], gradedA, TODAY, 'again', 0, 60);

    // Right after the failure (t=0) it is not due yet, it goes to the back.
    expect(afterGrade[0].itemId).not.toBe('a1');

    // After 60 s the selection returns the failed card despite the 20 words.
    const reordered = reorderForReturn(afterGrade, 60_000);
    expect(reordered[0].itemId).toBe('a1');
  });

  it.each([15, 300])('(b) N = %i s is also the return time of the missed card', (n) => {
    const A = sm2NewCard('a1');
    const gradedA = sm2Review(A, 'again', TODAY);
    const other = sm2NewCard('b1');
    const afterGrade = requeueAfterGrade([A, other], gradedA, TODAY, 'again', 0, n);

    const tooEarly = reorderForReturn(afterGrade, n * 1000 - 1);
    expect(tooEarly[0].itemId).not.toBe('a1');

    const onTime = reorderForReturn(afterGrade, n * 1000);
    expect(onTime[0].itemId).toBe('a1');
  });

  it('(c) empty queue: the missed one comes before the deadline if there is no other card', () => {
    const A = sm2NewCard('a1');
    const gradedA = sm2Review(A, 'again', TODAY);
    const afterGrade = requeueAfterGrade([A], gradedA, TODAY, 'again', 0, 60);

    // t=0, the 60 s returnAt has not expired yet, but there is no other card in the queue.
    expect(afterGrade[0].itemId).toBe('a1');
    expect(afterGrade[0].returnAt).toBe(60_000);
  });

  it('(d) two misses: the older one comes first', () => {
    const older: QueuedSm2Card = { ...sm2NewCard('old'), returnAt: 1000 };
    const newer: QueuedSm2Card = { ...sm2NewCard('new'), returnAt: 2000 };
    // "newer" sits at the front of the queue, but the returnAt of "older" is earlier.
    const reordered = reorderForReturn([newer, older], 5000);
    expect(reordered[0].itemId).toBe('old');
  });

  it('"Knew it" (good) graduates in one step (LEARNING_STEPS=1): drops out of the queue, no timer', () => {
    const A = sm2NewCard('a1');
    const gradedA = sm2Review(A, 'good', TODAY); // a "good" graduates, review, due tomorrow
    expect(gradedA.state).toBe('review');
    expect(gradedA.due).not.toBe(TODAY);
    const other = sm2NewCard('b1');
    const afterGrade = requeueAfterGrade([A, other], gradedA, TODAY, 'good', 0, 60);

    expect(afterGrade).toEqual([other]);
  });
});

describe('requeueAfterUndo (no orphan timer)', () => {
  it('(e) after undo there is no orphan timer', () => {
    const A = sm2NewCard('a1');
    const other = sm2NewCard('b1');
    const gradedA = sm2Review(A, 'again', TODAY);
    const afterGrade = requeueAfterGrade([A, other], gradedA, TODAY, 'again', 0, 60);

    const undone = requeueAfterUndo(afterGrade, A, gradedA, TODAY);

    expect(undone).toEqual([A, other]);
    expect(undone.every((c) => (c as QueuedSm2Card).returnAt === undefined)).toBe(true);
  });
});

// the daily progress is computed from the persisted `lastReview` and must give the real daily number
// even after a tab switch or an app restart.
describe('countDoneToday', () => {
  it('counts only cards reviewed today', () => {
    const cards = [
      reviewCard({ itemId: 'b1-0011', lastReview: TODAY }),
      reviewCard({ itemId: 'b1-0012', lastReview: TODAY }),
      reviewCard({ itemId: 'b1-0013', lastReview: addDays(TODAY, -1) }),
      sm2NewCard('b1-0014'), // lastReview: null, not graded yet
    ];

    expect(countDoneToday(cards, TODAY)).toBe(2);
  });

  it('stays correct after a remount (fresh array, same persisted data)', () => {
    const persisted = [reviewCard({ itemId: 'b1-0015', lastReview: TODAY })];
    // A "remount" just reads the same data again, as a new array.
    const reloaded = persisted.map((c) => ({ ...c }));

    expect(countDoneToday(reloaded, TODAY)).toBe(1);
  });

  it('returns 0 when nothing was reviewed today', () => {
    const cards = [reviewCard({ lastReview: addDays(TODAY, -1) }), sm2NewCard('b1-0016')];

    expect(countDoneToday(cards, TODAY)).toBe(0);
  });
});

// "+10 new words" was flat-added to the standing limit and kept
// only in React state (extraNew), so a tap after the day's introduced count
// already ran past the limit (limit 10, introduced today 18) gave back only
// 2 new cards instead of 10, and the bonus vanished on the next reload.
describe('nextPcicNewBonus + pcicNewBudget', () => {
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

// the breakdown of the header "today: N words · M sentences / limit"
// - the split by KIND, which the complaint "why did only 6 or 8 come instead of 10"
// actually lacked (the rest went to the other kind).
function kindMap(map: Record<string, PcicKind>): (itemId: string) => PcicKind | undefined {
  return (itemId) => map[itemId];
}

describe('countIntroducedTodayByKind', () => {
  it('separates the word and sentence cards introduced today', () => {
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

  it('phrase and pattern fall into the word bucket, the chain sentence into the sentence bucket', () => {
    const cards = [
      reviewCard({ itemId: 'p1', introducedAt: TODAY }),
      reviewCard({ itemId: 'pat1', introducedAt: TODAY }),
      reviewCard({ itemId: 'chain-2', introducedAt: TODAY }), // chain member, but kind: sentence
    ];
    const kindOf = kindMap({ p1: 'phrase', pat1: 'word', 'chain-2': 'sentence' });
    expect(countIntroducedTodayByKind(cards, TODAY, kindOf)).toEqual({ words: 2, sentences: 1 });
  });

  it("counts only cards introduced TODAY, not yesterday's", () => {
    const cards = [
      reviewCard({ itemId: 'today1', introducedAt: TODAY }),
      reviewCard({ itemId: 'yesterday1', introducedAt: addDays(TODAY, -1) }),
      sm2NewCard('never-introduced'), // introducedAt: null
    ];
    const kindOf = kindMap({ today1: 'word', yesterday1: 'word', 'never-introduced': 'word' });
    expect(countIntroducedTodayByKind(cards, TODAY, kindOf)).toEqual({ words: 1, sentences: 0 });
  });

  it('for an empty card list it gives {0, 0}', () => {
    expect(countIntroducedTodayByKind([], TODAY, () => undefined)).toEqual({ words: 0, sentences: 0 });
  });
});

describe('thinSentences', () => {
  const kind = kindMap({ w1: 'word', w2: 'word', w3: 'word', s1: 'sentence', s2: 'sentence', s3: 'sentence' });
  const ownGroup = (id: string) => id;

  it('the first sentence can go without waiting', () => {
    const order = ['w1', 's1', 'w2', 'w3'];
    expect(thinSentences(order, kind, ownGroup, 2)).toEqual(['w1', 's1', 'w2', 'w3']);
  });

  it('a second sentence is left out if fewer than minGap non-sentence cards lie between the two', () => {
    const order = ['s1', 'w1', 's2', 'w2', 'w3'];
    // between s1 -> s2 there is only 1 word, minGap 2 -> s2 is left out of this call.
    expect(thinSentences(order, kind, ownGroup, 2)).toEqual(['s1', 'w1', 'w2', 'w3']);
  });

  it('the second sentence gets in if enough non-sentence cards separate it from the first', () => {
    const order = ['s1', 'w1', 'w2', 's2', 'w3'];
    expect(thinSentences(order, kind, ownGroup, 2)).toEqual(['s1', 'w1', 'w2', 's2', 'w3']);
  });

  it('the members of a group (groupOf) may also go in one after the other, with no gap - they count as ONE unit', () => {
    const order = ['w1', 's1', 's2', 'w2'];
    const sameGroup = () => 'chain-1'; // s1 and s2 belong to the same chain
    expect(thinSentences(order, kind, sameGroup, 9)).toEqual(['w1', 's1', 's2', 'w2']);
  });

  it('no sentence in the input -> the order is unchanged', () => {
    const order = ['w1', 'w2', 'w3'];
    expect(thinSentences(order, kind, ownGroup)).toEqual(order);
  });
});

// the progress bar shows what is left of TODAY's batch.
import { countFinishedToday, dayProgressPercent, finishedInBatch } from '../pcicSession';

// after the "+N new words" extension the bar measures the new batch (relative to the number of cards done at the time of the extension).
describe('finishedInBatch', () => {
  it('after +15 it is 0% at the first new card, 100% at the last', () => {
    const base = 10; // at the time of the extension 10 cards were done today
    expect(dayProgressPercent(finishedInBatch(10, base), 15)).toBe(0);
    expect(dayProgressPercent(finishedInBatch(17, base), 8)).toBeGreaterThan(dayProgressPercent(finishedInBatch(16, base), 9));
    expect(dayProgressPercent(finishedInBatch(25, base), 0)).toBe(100);
  });

  it('it does not go below 0 even after undo', () => {
    expect(finishedInBatch(9, 10)).toBe(0);
  });
});

describe('dayProgressPercent', () => {
  it('empty at the first card', () => {
    expect(dayProgressPercent(0, 30)).toBe(0);
  });

  it('fills linearly: 50% at the half, does not restart at 10 cards', () => {
    expect(dayProgressPercent(10, 20)).toBeCloseTo((10 / 29) * 100);
    expect(dayProgressPercent(11, 19)).toBeGreaterThan(dayProgressPercent(10, 20));
    expect(dayProgressPercent(15, 16)).toBe(50);
  });

  it('full at the last card of the day', () => {
    expect(dayProgressPercent(29, 1)).toBe(100);
  });

  it('"+10 new" extension: the queue grows, it measures against the new full batch (the bar steps back, does not reset)', () => {
    const before = dayProgressPercent(29, 1);
    const after = dayProgressPercent(29, 11); // 10 new cards were added to the queue
    expect(before).toBe(100);
    expect(after).toBeCloseTo((29 / 39) * 100);
    expect(after).toBeGreaterThan(0);
  });

  it('a single card for the day: empty; no more cards: full only if some were done', () => {
    expect(dayProgressPercent(0, 1)).toBe(0);
    expect(dayProgressPercent(0, 0)).toBe(0);
    expect(dayProgressPercent(5, 0)).toBe(100);
  });
});

describe('countFinishedToday', () => {
  const card = (itemId: string, lastReview: string | null) => ({ ...sm2NewCard(itemId), lastReview });

  it('only cards rated today AND no longer in the queue count as done', () => {
    const a = card('a', '2026-10-01'); // done
    const b = card('b', '2026-10-01'); // "again": graded today, but stayed in the queue
    const c = card('c', '2026-09-30'); // yesterday's
    const d = card('d', null); // new
    expect(countFinishedToday([a, b, c, d], [b, d], '2026-10-01')).toBe(1);
  });
});

// User feedback ("new 42?"): the daily limit is DAILY; "+10"s taken at another level must not come back as new words at the other level.
describe('pcicSessionNewLimit', () => {
  const introduced = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => sm2Review(sm2NewCard(`${prefix}-${i}`), 'good', TODAY));
  const fresh = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}-new-${i}`);
  const newCount = (cards: Sm2Card[], order: string[], newLimit: number) =>
    pickSm2Session(cards, order, TODAY, newLimit).filter((c) => c.state === 'new').length;

  it('reproduces the case: 40 words introduced on A1 (limit 10, bonus 32), no 42 new words come on A2', () => {
    const a1 = introduced('a1', 40);
    const old = pcicNewBudget({ limit: 10, bonus: 32, introducedToday: 0 }); // the old behavior: with the level's 0 words, the full limit
    expect(newCount([], fresh('a2', 100), old)).toBe(42);

    const limit = pcicSessionNewLimit({ limit: 10, bonus: 32, introducedAllLevels: a1.length, introducedThisLevel: 0 });
    expect(newCount([], fresh('a2', 100), limit)).toBe(2); // 10 + 32 - 40: this much of the daily limit was left
  });

  it('with one level (all === this) exactly the old pcicNewBudget', () => {
    for (const [limit, bonus, n] of [[10, 0, 0], [10, 0, 10], [10, 18, 18], [10, 20, 5]] as const) {
      expect(pcicSessionNewLimit({ limit, bonus, introducedAllLevels: n, introducedThisLevel: n })).toBe(
        pcicNewBudget({ limit, bonus, introducedToday: n })
      );
    }
  });

  it('what was introduced on the view level is deducted by pickSm2Session, the words of the other level by the budget', () => {
    const thisLevel = introduced('a2', 3);
    // 4 words were introduced today at another level; limit 10, bonus 0: 7 introduced in total, 3 new left
    const limit = pcicSessionNewLimit({ limit: 10, bonus: 0, introducedAllLevels: 7, introducedThisLevel: 3 });
    expect(newCount(thisLevel, fresh('a2', 100), limit)).toBe(3);
  });

  it('the "+10" with a bonus inherited from the other level: the remaining 2 + the new 10 words', () => {
    // On A1 40 introduced, bonus 32; on A2 "+10": the bonus becomes 42, the limit is 52 - 40 = 12 new words (2 left over + 10)
    const next = nextPcicNewBonus({ limit: 10, bonus: 32, introducedToday: 40 });
    expect(next).toBe(42);
    const limit = pcicSessionNewLimit({ limit: 10, bonus: next, introducedAllLevels: 40, introducedThisLevel: 0 });
    expect(newCount([], fresh('a2', 100), limit)).toBe(12);
  });
});

// User feedback ("there are still 40 words, why doesn't it bring them up?"): the "Practice words" button gives from the missing words when the limit has run out.
describe('practiceTopUpStep', () => {
  it('exhausted budget: gives all missing words on one tap', () => {
    expect(practiceTopUpStep({ limit: 10, bonus: 0, introducedAllLevels: 10, missing: 40 })).toBe(40);
    expect(practiceTopUpStep({ limit: 10, bonus: 0, introducedAllLevels: 10, missing: 3 })).toBe(3);
    expect(practiceTopUpStep({ limit: 10, bonus: 15, introducedAllLevels: 25, missing: 304 })).toBe(304);
  });

  it('daily budget remains: does not extend', () => {
    expect(practiceTopUpStep({ limit: 10, bonus: 0, introducedAllLevels: 0, missing: 40 })).toBe(0);
    expect(practiceTopUpStep({ limit: 10, bonus: 15, introducedAllLevels: 24, missing: 40 })).toBe(0);
  });

  it('no missing word: does not extend', () => {
    expect(practiceTopUpStep({ limit: 10, bonus: 0, introducedAllLevels: 10, missing: 0 })).toBe(0);
  });

  it('the step adds the requested count to the budget: the budget is exhausted, then exactly that many new words come', () => {
    const step = practiceTopUpStep({ limit: 10, bonus: 0, introducedAllLevels: 10, missing: 40 });
    const next = nextPcicNewBonus({ limit: 10, bonus: 0, introducedToday: 10 }, step);
    const limit = pcicSessionNewLimit({ limit: 10, bonus: next, introducedAllLevels: 10, introducedThisLevel: 10 });
    const done = Array.from({ length: 10 }, (_, i) => sm2Review(sm2NewCard(`a1-${i}`), 'good', TODAY));
    const order = Array.from({ length: 60 }, (_, i) => `a1-new-${i}`);
    expect(pickSm2Session(done, order, TODAY, limit).filter((c) => c.state === 'new')).toHaveLength(40);
  });
});
