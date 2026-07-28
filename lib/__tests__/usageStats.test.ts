import {
  localDateString,
  buildDayRange,
  summarizeUsage,
  weeklyGoalProgress,
  DEFAULT_WEEKLY_GOAL_MINUTES,
} from '../usageStats';

// FB65: the Stats tab's weekly goal, measured against the rolling 7-day total.
describe('weeklyGoalProgress', () => {
  it('flags being short of the goal and reports the minutes left', () => {
    const p = weeklyGoalProgress(300, DEFAULT_WEEKLY_GOAL_MINUTES); // 5h of 7h
    expect(p.behind).toBe(true);
    expect(p.remaining).toBe(120);
    expect(p.pct).toBeCloseTo(300 / 420);
  });

  it('clears the flag at the goal and clamps the bar when it is passed', () => {
    expect(weeklyGoalProgress(420, 420)).toEqual({ pct: 1, behind: false, remaining: 0 });
    expect(weeklyGoalProgress(900, 420)).toEqual({ pct: 1, behind: false, remaining: 0 });
  });

  it('treats a zero/absent goal as no goal at all', () => {
    expect(weeklyGoalProgress(100, 0)).toEqual({ pct: 0, behind: false, remaining: 0 });
  });
});

describe('localDateString', () => {
  it('formats as local YYYY-MM-DD, zero-padded', () => {
    expect(localDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDateString(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
});

describe('buildDayRange', () => {
  it('returns `days` local dates, oldest first, ending on the given day', () => {
    const range = buildDayRange(7, new Date(2026, 6, 20));
    expect(range).toEqual([
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
      '2026-07-19',
      '2026-07-20',
    ]);
  });
});

describe('summarizeUsage', () => {
  const now = new Date(2026, 6, 20); // 2026-07-20

  it('fills missing days with 0 and sums this-week/all-time correctly', () => {
    const rows = [
      { date: '2026-07-20', minutes: 5 },
      { date: '2026-07-19', minutes: 10 },
      { date: '2026-06-01', minutes: 3 }, // outside the 7/30-day windows but still all-time
    ];
    const stats = summarizeUsage(rows, now);
    expect(stats.today).toBe(5);
    expect(stats.thisWeek).toBe(15); // only the last 7 days count
    expect(stats.allTimeTotal).toBe(18);
    expect(stats.daysActive).toBe(3);
    expect(stats.last7Days).toHaveLength(7);
    expect(stats.last7Days[6]).toEqual({ date: '2026-07-20', minutes: 5 });
    expect(stats.last30Days).toHaveLength(30);
  });

  it('picks the highest-minutes row as bestDay', () => {
    const rows = [
      { date: '2026-07-18', minutes: 5 },
      { date: '2026-07-19', minutes: 42 },
      { date: '2026-07-20', minutes: 12 },
    ];
    const stats = summarizeUsage(rows, now);
    expect(stats.bestDay).toEqual({ date: '2026-07-19', minutes: 42 });
  });

  it('handles no usage at all', () => {
    const stats = summarizeUsage([], now);
    expect(stats.today).toBe(0);
    expect(stats.thisWeek).toBe(0);
    expect(stats.allTimeTotal).toBe(0);
    expect(stats.daysActive).toBe(0);
    expect(stats.bestDay).toBeNull();
    expect(stats.last7Days.every(d => d.minutes === 0)).toBe(true);
  });
});
