import { getDb } from './database';
import type { Sm2Grade } from './sm2';
import { localDateString } from './usageStats';

// Daily XP + the fixed daily goal (first slice). XP comes from the Learn tab's
// card grades: a NEW word graded "Knew it" is worth 3, a review "Knew it" 2,
// "Didn't know" nothing (so tapping cannot manufacture XP). The gamer skin's
// time-based LVL (lib/xp.ts) is a separate number and stays as it is.
export const DAILY_XP_GOAL = 50;
const XP_NEW_KNEW = 3;
const XP_REVIEW_KNEW = 2;

export function xpForGrade(wasNew: boolean, g: Sm2Grade): number {
  if (g === 'again') return 0;
  return wasNew ? XP_NEW_KNEW : XP_REVIEW_KNEW;
}

// XP v2 (Kálmán, 2026-10-12): the first 2 repetitions of a due word are worth 2 and 1,
// from the 3rd on 0.2; a word that is not due is worth 0; a "half" (a correct answer in a
// practice task) is worth 1, 0.2 once the word has 3+ repetitions.
// `reviewCount` = Sm2Card.reps BEFORE this answer (the introduction grade counts as 1, so
// the n-th repetition of a word sees reps = n; "Didn't know" grades count as well).
const XP_REPETITION = [2, 1];
const XP_REPEAT_LATE = 0.2;
const XP_HALF = 1;
const XP_LATE_FROM = 3;

export type CardXpInput = { isNew: boolean; isDue: boolean; reviewCount: number; knew: boolean };

// XP for one main-card grade. `v2` false = the original values (3 new, 2 review, 0 for "Didn't know").
export function xpForCard(c: CardXpInput, opts: { v2: boolean }): number {
  if (!opts.v2) return xpForGrade(c.isNew, c.knew ? 'good' : 'again');
  if (!c.knew) return 0;
  if (c.isNew) return XP_NEW_KNEW;
  if (!c.isDue) return 0;
  if (c.reviewCount >= XP_LATE_FROM) return XP_REPEAT_LATE;
  return XP_REPETITION[Math.max(1, c.reviewCount) - 1];
}

// XP for one "half" (a correct answer in a practice task, steps 2-3). Without v2 the
// original rules know no halves, so they earn nothing.
export function xpForHalf(w: { reviewCount: number }, opts: { v2: boolean }): number {
  if (!opts.v2) return 0;
  return w.reviewCount >= XP_LATE_FROM ? XP_REPEAT_LATE : XP_HALF;
}

// XP is added up and stored in integer TENTHS (db.addDailyXpTenths), so 0.2 steps never
// drift: 5 x 0.2 is exactly 1.0. `DailyXp.xp` is the exact total (tenths / 10).
const TENTHS = 10;
const toTenths = (xp: number): number => Math.round(xp * TENTHS);

// The whole-number XP the chip shows (rounded down).
export function wholeXp(xp: number): number {
  return Math.floor(toTenths(xp) / TENTHS);
}

export type DailyXp = { date: string; xp: number };

type Listener = () => void;
const goalListeners = new Set<Listener>();
// The local day the goal pill was last announced for: the pill shows once a day,
// even if an undo drops the total below the goal and it is crossed again.
let announcedFor: string | null = null;

// The root layout's toast subscribes to this (components/UsageToast.tsx).
export function onDailyGoalReached(callback: Listener): () => void {
  goalListeners.add(callback);
  return () => goalListeners.delete(callback);
}

// Adds `delta` XP to `date` (negative = undo of a grade) and returns the day's new
// total. The first time a local day's total reaches the goal, the listeners fire.
export async function addXp(delta: number, date: string = localDateString()): Promise<DailyXp> {
  const step = toTenths(delta);
  const total = await getDb().addDailyXpTenths(date, step);
  const goal = DAILY_XP_GOAL * TENTHS;
  if (step > 0 && total >= goal && total - step < goal && announcedFor !== date) {
    announcedFor = date;
    for (const listener of goalListeners) listener();
  }
  return { date, xp: total / TENTHS };
}

// The day's exact XP total (0 for a day with no entry).
export async function getXp(date: string = localDateString()): Promise<DailyXp> {
  return { date, xp: (await getDb().getDailyXpTenths(date)) / TENTHS };
}

// Test-only: forgets the announced day and the listeners. Not used by app code.
export function __resetForTests(): void {
  announcedFor = null;
  goalListeners.clear();
}
