// The numbers behind the weekly leaderboard screen's own-week panel and bottom bar (components/board/). Pure: no React, no database.
import type { BoardData, BoardRow } from './board';

export interface WeekSummary {
  total: number;
  today: number;
  // XP still missing from today's goal, 0 once it is reached
  toGoal: number;
  best: { index: number; xp: number };
  // over the days from Monday to today, rounded
  average: number;
}

// The server cuts its list here (cloud/logic.ts BOARD_MAX_ROWS); lib/ does not import the Worker's code.
export const BOARD_LIST_MAX = 50;

// `days`: the XP of each of the 7 days (Monday first), null for the days still to come. XP may be fractional (tenths): the
// results are rounded, and `toGoal` is computed from the rounded `today`, so the two figures on screen always agree.
export function weekSummary(days: (number | null)[], todayIndex: number, goal: number): WeekSummary {
  const earned = days.slice(0, todayIndex + 1).map((d) => d ?? 0);
  const total = earned.reduce((sum, d) => sum + d, 0);
  const today = Math.round(earned[todayIndex] ?? 0);
  let bestIndex = 0;
  earned.forEach((d, i) => {
    if (d > earned[bestIndex]) bestIndex = i;
  });
  return {
    total: Math.round(total),
    today,
    toGoal: Math.max(0, goal - today),
    best: { index: bestIndex, xp: Math.round(earned[bestIndex] ?? 0) },
    average: Math.round(total / (todayIndex + 1)),
  };
}

export interface Gaps {
  // XP missing to pass the player directly ahead (+1: a tie does not pass them); null at the first place or when that player is not known
  toPass: number | null;
  // the lead over the player directly behind; null when nobody is behind or that player is not known
  lead: number | null;
  atTop: boolean;
  // first place and nobody else on the list
  alone: boolean;
  // the caller is in the list and nobody is behind, and the list is not cut: really the last
  last: boolean;
}

// The neighbours are only known while the caller is in `rows`; the server cuts the list at BOARD_LIST_MAX, so a caller beyond the cut
// has no known neighbours, and one at the very end of a full list may have players behind that are not shown.
export function gaps(rows: BoardRow[], me: { rank: number; xp: number }): Gaps {
  const inList = rows.some((r) => r.rank === me.rank);
  const ahead = inList ? rows.find((r) => r.rank === me.rank - 1) : undefined;
  const behind = inList ? rows.find((r) => r.rank === me.rank + 1) : undefined;
  const atTop = me.rank === 1;
  return {
    toPass: ahead ? ahead.xp - me.xp + 1 : null,
    lead: behind ? me.xp - behind.xp : null,
    atTop,
    alone: atTop && inList && rows.length === 1,
    last: inList && !behind && rows.length < BOARD_LIST_MAX,
  };
}

export const daysLeft = (dayIndex: number): number => 7 - dayIndex;

// A learning time as `3 h 25 min` (under an hour `25 min`), whole minutes.
export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

// The time ranking as the screen's pieces read a board: the `xp` of every row and of `me` carries the week's minutes (0 where a
// worker from before the time ranking sent none), so the podium heights, the gaps and the "+N" gains work on one number for both
// rankings. Only the text next to the number differs (XP or formatMinutes).
export function timeView(data: BoardData): BoardData {
  return {
    ...data,
    rows: data.rows.map((r) => ({ ...r, xp: r.minutes ?? 0 })),
    me: data.me && { ...data.me, xp: data.me.minutes ?? 0 },
  };
}

const DAY_MS = 86_400_000;

const dateParts = (date: string): [number, number, number] => {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m - 1, d];
};

// The local date `shift` days from `date` (YYYY-MM-DD), by calendar arithmetic (no daylight-saving drift).
export function shiftDate(date: string, shift: number): string {
  const [y, m, d] = dateParts(date);
  const s = new Date(Date.UTC(y, m, d + shift));
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, '0')}-${String(s.getUTCDate()).padStart(2, '0')}`;
}

// How many days `now`'s local date is after the Monday `weekStart` (negative before it, above 6 after the week); NaN for an unreadable date.
export function weekDayOffset(weekStart: string, now: Date): number {
  const [y, m, d] = dateParts(weekStart);
  return Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(y, m, d)) / DAY_MS);
}

// 0..6: the offset clamped into the week (an unreadable date counts as 0).
export function weekDayIndex(weekStart: string, now: Date): number {
  const diff = weekDayOffset(weekStart, now);
  return Number.isFinite(diff) ? Math.min(6, Math.max(0, diff)) : 0;
}
