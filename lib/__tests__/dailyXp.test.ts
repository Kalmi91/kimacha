// Daily XP (first slice): points per grade, the per-day total (midnight reset),
// the undo, and the one-time daily goal event. Memory db.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { getDb } from '../database.web';
import {
  DAILY_XP_GOAL,
  __resetForTests,
  addXp,
  getXp,
  onDailyGoalReached,
  wholeXp,
  xpForCard,
  xpForGrade,
  xpForHalf,
} from '../dailyXp';
import { localDateString } from '../usageStats';

describe('xpForGrade', () => {
  it('a new word graded "Knew it" is worth 3', () => {
    expect(xpForGrade(true, 'good')).toBe(3);
  });

  it('a review graded "Knew it" is worth 2', () => {
    expect(xpForGrade(false, 'good')).toBe(2);
  });

  it('"Didn\'t know" is worth nothing, new or not', () => {
    expect(xpForGrade(true, 'again')).toBe(0);
    expect(xpForGrade(false, 'again')).toBe(0);
  });
});

describe('addXp / daily total', () => {
  const db = getDb();

  beforeEach(() => __resetForTests());
  afterEach(() => jest.useRealTimers());

  it('adds up within a day and keeps the days apart', async () => {
    expect(await addXp(3, '2026-10-08')).toEqual({ date: '2026-10-08', xp: 3 });
    expect((await addXp(2, '2026-10-08')).xp).toBe(5);
    expect((await addXp(3, '2026-10-09')).xp).toBe(3);
    expect(await db.getDailyXpTenths('2026-10-08')).toBe(50);
    expect(await db.getDailyXpTenths('2026-10-09')).toBe(30);
    expect(await db.getDailyXpTenths('2026-10-01')).toBe(0);
  });

  it('resets at local midnight: the same call writes to a new day after 00:00', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2031, 4, 1, 23, 59, 30));
    const before = await addXp(3);
    expect(before).toEqual({ date: '2031-05-01', xp: 3 });
    jest.setSystemTime(new Date(2031, 4, 2, 0, 0, 30));
    const after = await addXp(2);
    expect(after).toEqual({ date: '2031-05-02', xp: 2 });
    expect(await db.getDailyXpTenths('2031-05-01')).toBe(30);
    expect(after.date).toBe(localDateString());
  });

  it('a negative delta (undo) takes the points back and never goes below 0', async () => {
    await addXp(3, '2026-11-01');
    expect((await addXp(-3, '2026-11-01')).xp).toBe(0);
    expect((await addXp(-2, '2026-11-01')).xp).toBe(0);
    expect((await addXp(-2, '2026-11-02')).xp).toBe(0);
  });
});

describe('daily goal event', () => {
  beforeEach(() => __resetForTests());

  it('fires once when the day total first reaches the goal, not before and not again', async () => {
    const reached = jest.fn();
    onDailyGoalReached(reached);
    await addXp(DAILY_XP_GOAL - 3, '2026-12-01');
    expect(reached).not.toHaveBeenCalled();
    await addXp(3, '2026-12-01');
    expect(reached).toHaveBeenCalledTimes(1);
    await addXp(3, '2026-12-01');
    await addXp(2, '2026-12-01');
    expect(reached).toHaveBeenCalledTimes(1);
  });

  it('does not fire again when an undo drops the total under the goal and it is crossed again', async () => {
    const reached = jest.fn();
    onDailyGoalReached(reached);
    await addXp(DAILY_XP_GOAL, '2026-12-02');
    expect(reached).toHaveBeenCalledTimes(1);
    await addXp(-3, '2026-12-02');
    await addXp(3, '2026-12-02');
    expect(reached).toHaveBeenCalledTimes(1);
  });

  it('fires on the next day again', async () => {
    const reached = jest.fn();
    onDailyGoalReached(reached);
    await addXp(DAILY_XP_GOAL, '2026-12-03');
    await addXp(DAILY_XP_GOAL, '2026-12-04');
    expect(reached).toHaveBeenCalledTimes(2);
  });

  it('a stopped subscription is not called', async () => {
    const reached = jest.fn();
    const stop = onDailyGoalReached(reached);
    stop();
    await addXp(DAILY_XP_GOAL, '2026-12-05');
    expect(reached).not.toHaveBeenCalled();
  });
});

// XP v2 (Kálmán, 2026-10-12): the value set, v1 stays as it was.
describe('xpForCard', () => {
  const card = (o: Partial<Parameters<typeof xpForCard>[0]> = {}) => ({ isNew: false, isDue: true, reviewCount: 1, knew: true, ...o });
  const v1 = { v2: false };
  const v2 = { v2: true };

  it('v2: a new word "Knew it" is worth 3', () => {
    expect(xpForCard(card({ isNew: true, isDue: false, reviewCount: 0 }), v2)).toBe(3);
  });

  it("v2: a due word's 1st repetition is worth 2, the 2nd 1, the 3rd and later 0.2", () => {
    expect(xpForCard(card({ reviewCount: 1 }), v2)).toBe(2);
    expect(xpForCard(card({ reviewCount: 2 }), v2)).toBe(1);
    expect(xpForCard(card({ reviewCount: 3 }), v2)).toBe(0.2);
    expect(xpForCard(card({ reviewCount: 5 }), v2)).toBe(0.2);
    expect(xpForCard(card({ reviewCount: 40 }), v2)).toBe(0.2);
  });

  it('v2: a card with no reps yet (marked known by hand) counts as the 1st repetition', () => {
    expect(xpForCard(card({ reviewCount: 0 }), v2)).toBe(2);
  });

  it('v2: practising a word that is not due is worth 0', () => {
    expect(xpForCard(card({ isDue: false, reviewCount: 1 }), v2)).toBe(0);
    expect(xpForCard(card({ isDue: false, reviewCount: 5 }), v2)).toBe(0);
  });

  it("v2: \"Didn't know\" is worth 0, new or not, due or not", () => {
    expect(xpForCard(card({ isNew: true, knew: false }), v2)).toBe(0);
    expect(xpForCard(card({ knew: false, reviewCount: 1 }), v2)).toBe(0);
    expect(xpForCard(card({ knew: false, isDue: false }), v2)).toBe(0);
  });

  it('v1 (v2 off): exactly the old values, whatever the repetition count or due state', () => {
    expect(xpForCard(card({ isNew: true, isDue: false, reviewCount: 0 }), v1)).toBe(3);
    for (const reviewCount of [1, 2, 3, 5]) expect(xpForCard(card({ reviewCount }), v1)).toBe(2);
    expect(xpForCard(card({ isDue: false, reviewCount: 4 }), v1)).toBe(2);
    expect(xpForCard(card({ isNew: true, knew: false }), v1)).toBe(0);
    expect(xpForCard(card({ knew: false }), v1)).toBe(0);
  });
});

describe('xpForHalf', () => {
  it('v2: a half is worth 1, but 0.2 once the word has 3+ repetitions', () => {
    expect(xpForHalf({ reviewCount: 0 }, { v2: true })).toBe(1);
    expect(xpForHalf({ reviewCount: 2 }, { v2: true })).toBe(1);
    expect(xpForHalf({ reviewCount: 3 }, { v2: true })).toBe(0.2);
    expect(xpForHalf({ reviewCount: 9 }, { v2: true })).toBe(0.2);
  });

  it('v1 (v2 off): the old rules know no halves, so 0', () => {
    expect(xpForHalf({ reviewCount: 0 }, { v2: false })).toBe(0);
    expect(xpForHalf({ reviewCount: 5 }, { v2: false })).toBe(0);
  });
});

describe('fractional XP', () => {
  beforeEach(() => __resetForTests());

  it('five 0.2 steps add up to exactly 1.0 (no floating-point drift)', async () => {
    let total = 0;
    for (let i = 0; i < 5; i++) total = (await addXp(0.2, '2027-02-01')).xp;
    expect(total).toBe(1);
    expect(await getDb().getDailyXpTenths('2027-02-01')).toBe(10);
    expect((await getXp('2027-02-01')).xp).toBe(1);
  });

  it('keeps exact tenths over many steps and mixed values', async () => {
    await addXp(3, '2027-02-02');
    for (let i = 0; i < 7; i++) await addXp(0.2, '2027-02-02');
    await addXp(1, '2027-02-02');
    await addXp(2, '2027-02-02');
    expect(await getDb().getDailyXpTenths('2027-02-02')).toBe(74);
    expect((await getXp('2027-02-02')).xp).toBe(7.4);
  });

  it('the chip shows whole XP, rounded down', () => {
    expect(wholeXp(0)).toBe(0);
    expect(wholeXp(0.8)).toBe(0);
    expect(wholeXp(0.2 + 0.2 + 0.2 + 0.2 + 0.2)).toBe(1);
    expect(wholeXp(49.8)).toBe(49);
    expect(wholeXp(50)).toBe(50);
    expect(wholeXp(63.4)).toBe(63);
  });

  it('the daily goal is reached at the exact total: 49.8 + 0.2 fires, 49.8 does not', async () => {
    const reached = jest.fn();
    onDailyGoalReached(reached);
    await addXp(49, '2027-02-03');
    for (let i = 0; i < 4; i++) await addXp(0.2, '2027-02-03');
    expect(reached).not.toHaveBeenCalled();
    expect((await getXp('2027-02-03')).xp).toBe(49.8);
    await addXp(0.2, '2027-02-03');
    expect(reached).toHaveBeenCalledTimes(1);
    expect((await getXp('2027-02-03')).xp).toBe(50);
  });

  it('undo takes back exactly what the card gave, fractions included', async () => {
    await addXp(10, '2027-02-04');
    const give = xpForCard({ isNew: false, isDue: true, reviewCount: 4, knew: true }, { v2: true });
    expect(give).toBe(0.2);
    expect((await addXp(give, '2027-02-04')).xp).toBe(10.2);
    expect((await addXp(-give, '2027-02-04')).xp).toBe(10);
    const two = xpForCard({ isNew: false, isDue: true, reviewCount: 1, knew: true }, { v2: true });
    await addXp(two, '2027-02-04');
    expect((await addXp(-two, '2027-02-04')).xp).toBe(10);
    expect(await getDb().getDailyXpTenths('2027-02-04')).toBe(100);
  });
});
