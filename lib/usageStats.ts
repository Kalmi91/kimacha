// Pure helpers for the active-usage stats feature (usage_minutes table).
// Shared by lib/database.ts (SQLite) and lib/database.web.ts (in-memory) so
// "today"/"this week"/"best day" can't drift between the two platforms, 
// each DB implementation only gathers its raw { date, minutes } rows and
// hands them to summarizeUsage() here.

export interface UsageDayRow {
  date: string;
  minutes: number;
}

export interface UsageStats {
  today: number;
  thisWeek: number;
  allTimeTotal: number;
  last7Days: UsageDayRow[];
  last30Days: UsageDayRow[];
  bestDay: UsageDayRow | null;
  daysActive: number;
}

// Local (not UTC) YYYY-MM-DD, so the day boundary matches the user's own
// clock rather than jumping at midnight UTC.
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Oldest-to-newest local date strings for the `days` calendar days ending on
// `end` (inclusive), for filling in a bar chart / weekly rollup with zeros
// on days that have no usage_minutes row.
export function buildDayRange(days: number, end: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(localDateString(new Date(end.getTime() - i * 86400000)));
  }
  return out;
}

// "This week" = rolling 7-day window ending today (not calendar/ISO week),
// to keep the definition simple and consistent with the last7Days chart.
export function summarizeUsage(rows: UsageDayRow[], now: Date = new Date()): UsageStats {
  const byDate = new Map(rows.map(r => [r.date, r.minutes]));
  const today = localDateString(now);
  const last7Days = buildDayRange(7, now).map(date => ({ date, minutes: byDate.get(date) ?? 0 }));
  const last30Days = buildDayRange(30, now).map(date => ({ date, minutes: byDate.get(date) ?? 0 }));
  const allTimeTotal = rows.reduce((sum, r) => sum + r.minutes, 0);
  const daysActive = rows.filter(r => r.minutes > 0).length;

  let bestDay: UsageDayRow | null = null;
  for (const r of rows) {
    if (!bestDay || r.minutes > bestDay.minutes) bestDay = r;
  }

  return {
    today: byDate.get(today) ?? 0,
    thisWeek: last7Days.reduce((sum, r) => sum + r.minutes, 0),
    allTimeTotal,
    last7Days,
    last30Days,
    bestDay,
    daysActive,
  };
}
