import type { BoardData, BoardRow } from '../board';
import { BOARD_LIST_MAX, daysLeft, formatMinutes, gaps, shiftDate, timeView, weekDayIndex, weekDayOffset, weekSummary } from '../boardStats';

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

describe('formatMinutes', () => {
  it('writes `3 h 25 min` from an hour on, and plain minutes under it', () => {
    expect(formatMinutes(205)).toBe('3 h 25 min');
    expect(formatMinutes(60)).toBe('1 h 0 min');
    expect(formatMinutes(59)).toBe('59 min');
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(1440 * 7)).toBe('168 h 0 min');
  });

  it('rounds fractions and never shows a negative or broken figure as one', () => {
    expect(formatMinutes(59.6)).toBe('1 h 0 min');
    expect(formatMinutes(12.4)).toBe('12 min');
    expect(formatMinutes(-5)).toBe('0 min');
  });
});

describe('timeView', () => {
  const data: BoardData = {
    weekStart: '2026-11-02',
    metric: 'time',
    rows: [
      { rank: 1, name: 'Ana', xp: 10, minutes: 75, me: false },
      { rank: 2, name: 'Old', xp: 5, me: true },
    ],
    me: { rank: 2, xp: 5, name: 'Old' },
  };

  it('puts the minutes into `xp` of every row and of me (0 where there are none), and leaves the rest', () => {
    const v = timeView(data);
    expect(v.rows.map((r) => [r.rank, r.name, r.xp, r.minutes])).toEqual([[1, 'Ana', 75, 75], [2, 'Old', 0, undefined]]);
    expect(v.me).toEqual({ rank: 2, xp: 0, name: 'Old' });
    expect(v.metric).toBe('time');
    expect(timeView({ ...data, me: null }).me).toBeNull();
    expect(data.rows[0].xp).toBe(10); // the input is not changed
  });
});
