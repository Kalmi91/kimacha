import { buildWeeklyTrend } from '../weeklyTrend';
import { buildDayRange, localDateString } from '../../usageStats';

const NOW = new Date(2026, 10, 18, 12, 0); // 2026-11-18, the current window is 11-12..11-18

describe('buildWeeklyTrend', () => {
  it('returns 6 zero weeks for empty data, oldest first, current last', () => {
    const t = buildWeeklyTrend([], [], NOW);
    expect(t.weeks).toHaveLength(6);
    expect(t.weeks.every(w => w.words === 0 && w.minutes === 0)).toBe(true);
    expect(t.weeks[5].end).toBe('2026-11-18');
    expect(t.weeks[5].start).toBe('2026-11-12');
    expect(t.weeks[0].start).toBe(buildDayRange(42, NOW)[0]);
    expect(t.deltaWords).toBe(0);
    expect(t.deltaMinutes).toBe(0);
  });

  it('uses the same rolling 7-day week as the "this week" tile (boundaries)', () => {
    const t = buildWeeklyTrend(
      [
        { date: '2026-11-18', minutes: 5 },
        { date: '2026-11-12', minutes: 7 }, // first day of the current window
        { date: '2026-11-11', minutes: 11 }, // last day of the previous window
        { date: '2026-11-05', minutes: 13 }, // first day of the previous window
        { date: '2026-11-04', minutes: 17 }, // belongs to the window before
      ],
      [],
      NOW,
    );
    expect(t.weeks[5].minutes).toBe(12);
    expect(t.weeks[4].minutes).toBe(24);
    expect(t.weeks[3].minutes).toBe(17);
    expect(t.deltaMinutes).toBe(12 - 24);
  });

  it('counts new words per week, ignoring null dates and dates outside the 6 weeks', () => {
    const t = buildWeeklyTrend(
      [],
      ['2026-11-18', '2026-11-18T08:00:00', '2026-11-11', null, '', '2026-01-01', '2026-11-19'],
      NOW,
    );
    expect(t.weeks[5].words).toBe(2);
    expect(t.weeks[4].words).toBe(1);
    expect(t.weeks.reduce((n, w) => n + w.words, 0)).toBe(3);
    expect(t.deltaWords).toBe(1);
  });

  it('handles a partial current week (only today has data)', () => {
    const t = buildWeeklyTrend([{ date: '2026-11-18', minutes: 3 }], ['2026-11-18'], NOW);
    expect(t.weeks[5]).toMatchObject({ words: 1, minutes: 3 });
    expect(t.deltaMinutes).toBe(3);
  });

  it('is stable around midnight: just after 00:00 and just before 24:00 give the same buckets', () => {
    const rows = [{ date: '2026-11-18', minutes: 4 }];
    const early = buildWeeklyTrend(rows, [], new Date(2026, 10, 18, 0, 5));
    const late = buildWeeklyTrend(rows, [], new Date(2026, 10, 18, 23, 55));
    expect(early).toEqual(late);
    expect(early.weeks[5].end).toBe(localDateString(new Date(2026, 10, 18)));
    const nextDay = buildWeeklyTrend(rows, [], new Date(2026, 10, 19, 0, 5));
    expect(nextDay.weeks[5].minutes).toBe(4);
    expect(nextDay.weeks[5].start).toBe('2026-11-13');
  });
});
