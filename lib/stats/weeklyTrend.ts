// Pure bucketing for the Stats tab's "Weekly trend" card. The week is the same
// one the tab's "this week" tile uses (lib/usageStats.ts): a rolling 7-day
// window ending today, so the current bucket is days -6..0, the one before it
// days -13..-7, and so on. No second week definition.
import { buildDayRange, type UsageDayRow } from '@/lib/usageStats';

export const TREND_WEEKS = 6;

export interface TrendWeek {
  start: string; // first local date of the window, YYYY-MM-DD
  end: string; // last local date of the window
  words: number; // PCIC words first introduced in the window
  minutes: number; // app-wide study minutes in the window
}

export interface WeeklyTrend {
  weeks: TrendWeek[]; // oldest first, the current week last
  deltaWords: number; // current week minus the previous full week
  deltaMinutes: number;
}

// `introducedAt` = the active pair's cards' introduced_at values (null/empty = never introduced).
export function buildWeeklyTrend(
  rows: UsageDayRow[],
  introducedAt: (string | null | undefined)[],
  now: Date = new Date(),
  weekCount: number = TREND_WEEKS,
): WeeklyTrend {
  const days = buildDayRange(weekCount * 7, now);
  const minutesByDate = new Map<string, number>();
  for (const r of rows) minutesByDate.set(r.date, (minutesByDate.get(r.date) ?? 0) + r.minutes);
  const wordsByDate = new Map<string, number>();
  for (const raw of introducedAt) {
    if (!raw) continue;
    const date = raw.slice(0, 10);
    wordsByDate.set(date, (wordsByDate.get(date) ?? 0) + 1);
  }
  const weeks: TrendWeek[] = [];
  for (let w = 0; w < weekCount; w++) {
    const slice = days.slice(w * 7, w * 7 + 7);
    weeks.push({
      start: slice[0],
      end: slice[slice.length - 1],
      words: slice.reduce((n, d) => n + (wordsByDate.get(d) ?? 0), 0),
      minutes: slice.reduce((n, d) => n + (minutesByDate.get(d) ?? 0), 0),
    });
  }
  const cur = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  return {
    weeks,
    deltaWords: cur && prev ? cur.words - prev.words : 0,
    deltaMinutes: cur && prev ? cur.minutes - prev.minutes : 0,
  };
}
