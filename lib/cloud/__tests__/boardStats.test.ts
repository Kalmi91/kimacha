import type { BoardRow } from '../board';
import { BOARD_LIST_MAX, daysLeft, gaps, shiftDate, weekDayIndex, weekDayOffset, weekSummary } from '../boardStats';

const rows = (xps: number[]): BoardRow[] => xps.map((xp, i) => ({ rank: i + 1, name: `p${i + 1}`, xp, me: false }));

describe('weekSummary', () => {
  it('sums the days up to today and reports today, the best day and the average', () => {
    const s = weekSummary([58, 71, 43, null, null, null, null], 2, 50);
    expect(s).toEqual({ total: 172, today: 43, toGoal: 7, best: { index: 1, xp: 71 }, average: 57 });
  });

  it('toGoal comes from the rounded XP of today, the same number the screen shows', () => {
    expect(weekSummary([50, null, null, null, null, null, null], 0, 50).toGoal).toBe(0);
    expect(weekSummary([60, null, null, null, null, null, null], 0, 50).toGoal).toBe(0);
    const near = weekSummary([49.6, null, null, null, null, null, null], 0, 50);
    expect(near).toMatchObject({ today: 50, toGoal: 0 });
    expect(weekSummary([49.4, null, null, null, null, null, null], 0, 50)).toMatchObject({ today: 49, toGoal: 1 });
  });

  it('the first of equal best days wins, an empty week has its best on Monday with 0', () => {
    expect(weekSummary([10, 20, 20, null, null, null, null], 2, 50).best).toEqual({ index: 1, xp: 20 });
    expect(weekSummary([0, 0, null, null, null, null, null], 1, 50)).toMatchObject({ total: 0, today: 0, toGoal: 50, best: { index: 0, xp: 0 }, average: 0 });
  });

  it('rounds fractional XP and treats a null day inside the elapsed days as 0', () => {
    expect(weekSummary([10.4, null, 20.4, null, null, null, null], 2, 50)).toMatchObject({ total: 31, today: 20, average: 10 });
  });
});

describe('gaps', () => {
  it('the XP to pass the player directly ahead (+1) and the lead over the one directly behind', () => {
    expect(gaps(rows([412, 396, 305, 241, 198, 172, 164]), { rank: 6, xp: 172 })).toEqual({ toPass: 27, lead: 8, atTop: false, alone: false, last: false });
  });

  it('the first place has nothing to pass; the last of a short list has no lead and is really last', () => {
    expect(gaps(rows([100, 50]), { rank: 1, xp: 100 })).toEqual({ toPass: null, lead: 50, atTop: true, alone: false, last: false });
    expect(gaps(rows([100, 50]), { rank: 2, xp: 50 })).toEqual({ toPass: 51, lead: null, atTop: false, alone: false, last: true });
  });

  it('alone means first place with nobody else on the list', () => {
    expect(gaps(rows([100]), { rank: 1, xp: 100 })).toEqual({ toPass: null, lead: null, atTop: true, alone: true, last: true });
  });

  it('a caller beyond the cut has no known neighbours', () => {
    expect(gaps(rows([100, 90]), { rank: 60, xp: 5 })).toEqual({ toPass: null, lead: null, atTop: false, alone: false, last: false });
  });

  it('a caller at exactly rank 50 of a full list is not alone and not known to be last', () => {
    const full = rows(Array.from({ length: BOARD_LIST_MAX }, (_, i) => 1000 - i));
    expect(gaps(full, { rank: 50, xp: 951 })).toEqual({ toPass: 2, lead: null, atTop: false, alone: false, last: false });
    // the first of a full list still has a lead
    expect(gaps(full, { rank: 1, xp: 1000 })).toMatchObject({ toPass: null, lead: 1, atTop: true });
  });
});

describe('days', () => {
  it('daysLeft counts the days of the week still to come, today included', () => {
    expect(daysLeft(0)).toBe(7);
    expect(daysLeft(2)).toBe(5);
    expect(daysLeft(6)).toBe(1);
  });

  it('shiftDate moves by calendar days across month, year and leap day', () => {
    expect(shiftDate('2026-11-02', 6)).toBe('2026-11-08');
    expect(shiftDate('2026-11-30', 1)).toBe('2026-12-01');
    expect(shiftDate('2026-01-01', -7)).toBe('2025-12-25');
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('weekDayIndex is the local date minus the week start, clamped into 0..6', () => {
    expect(weekDayIndex('2026-11-02', new Date(2026, 10, 4, 23, 59))).toBe(2);
    expect(weekDayIndex('2026-11-02', new Date(2026, 10, 2, 0, 0))).toBe(0);
    expect(weekDayIndex('2026-11-02', new Date(2026, 10, 20))).toBe(6);
    expect(weekDayIndex('2026-11-02', new Date(2026, 9, 20))).toBe(0);
    expect(weekDayIndex('nonsense', new Date(2026, 10, 4))).toBe(0);
  });

  it('weekDayOffset is not clamped: negative before the week, above 6 after it', () => {
    expect(weekDayOffset('2026-11-02', new Date(2026, 10, 9, 0, 5))).toBe(7);
    expect(weekDayOffset('2026-11-02', new Date(2026, 10, 1))).toBe(-1);
    expect(weekDayOffset('nonsense', new Date(2026, 10, 1))).toBeNaN();
  });
});
