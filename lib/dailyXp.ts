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
  const xp = await getDb().addDailyXp(date, delta);
  if (delta > 0 && xp >= DAILY_XP_GOAL && xp - delta < DAILY_XP_GOAL && announcedFor !== date) {
    announcedFor = date;
    for (const listener of goalListeners) listener();
  }
  return { date, xp };
}

// Test-only: forgets the announced day and the listeners. Not used by app code.
export function __resetForTests(): void {
  announcedFor = null;
  goalListeners.clear();
}
