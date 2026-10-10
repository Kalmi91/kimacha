// Daily XP (first slice): points per grade, the per-day total (midnight reset),
// the undo, and the one-time daily goal event. Memory db.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { getDb } from '../database.web';
import { DAILY_XP_GOAL, __resetForTests, addXp, onDailyGoalReached, xpForGrade } from '../dailyXp';
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
    expect(await db.getDailyXp('2026-10-08')).toBe(5);
    expect(await db.getDailyXp('2026-10-09')).toBe(3);
    expect(await db.getDailyXp('2026-10-01')).toBe(0);
  });

  it('resets at local midnight: the same call writes to a new day after 00:00', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2031, 4, 1, 23, 59, 30));
    const before = await addXp(3);
    expect(before).toEqual({ date: '2031-05-01', xp: 3 });
    jest.setSystemTime(new Date(2031, 4, 2, 0, 0, 30));
    const after = await addXp(2);
    expect(after).toEqual({ date: '2031-05-02', xp: 2 });
    expect(await db.getDailyXp('2031-05-01')).toBe(3);
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
