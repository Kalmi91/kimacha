import { AppState, type AppStateStatus } from 'react-native';
import { getDb } from './database';
import { isDailyMilestone } from './usageMilestones';
import { localDateString } from './usageStats';

// Active-usage timer backing the "+1 perc wauuuuuuuu" toast + the stats tab.
//
// A second only counts toward the running minute while the app is in the
// foreground (AppState === 'active') AND the user interacted within the last
// IDLE_TIMEOUT_MS (noteInteraction()). Going idle, or backgrounding the app, 
// pauses accrual, but never discards the partial progress already banked
// toward the current minute: it just sits in `activeSeconds` until interaction
// (and foreground) resume, then keeps counting from where it left off. Once
// 60 active seconds accrue, one full minute is persisted (db.addUsageMinute())
// and every onActiveMinute() subscriber fires (the root layout uses this to
// pop the toast).

export const IDLE_TIMEOUT_MS = 30_000;
const TICK_MS = 1000;
const MINUTE_SECONDS = 60;

// FB63: milestone celebrations on top of the per-minute toast.
// `session` counts the active minutes of THIS app run (a restart starts over),
// `daily` reads the persisted day total, so its crossing (previous total was
// one lower) can only happen once per calendar day even across restarts.
// FB149: past the first hour the daily milestone repeats every 15 minutes, see
// lib/usageMilestones.ts.
export type UsageMilestone = { scope: 'session' | 'daily'; minutes: number };
const SESSION_MILESTONES = [30];

// FB108, Kálmán 2026-08-08: "ha éjfélkor játszunk a játékkal, és pont átfordul
// akkor a napi statot írja ki és gratuláljon". The tick loop is already running
// while the learner plays, so it is also the thing that can notice the calendar
// day turning over under them; it then reports the FINISHED day's totals.
export type DayRollover = { date: string; minutes: number; words: number };

type Listener = () => void;
type MilestoneListener = (milestone: UsageMilestone) => void;
type DayRolloverListener = (rollover: DayRollover) => void;

let running = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let appState: AppStateStatus = 'active';
let lastInteractionAt = 0;
let activeSeconds = 0; // partial progress toward the next full minute (0-59)
let sessionMinutes = 0; // FB63: full active minutes accrued in this app run
let currentDay: string | null = null; // FB108: local calendar day the ticks belong to

const listeners = new Set<Listener>();
const milestoneListeners = new Set<MilestoneListener>();
const dayRolloverListeners = new Set<DayRolloverListener>();

function isCountingNow(): boolean {
  if (appState !== 'active') return false;
  if (lastInteractionAt === 0) return false;
  return Date.now() - lastInteractionAt <= IDLE_TIMEOUT_MS;
}

function startInterval() {
  if (intervalId) return;
  intervalId = setInterval(tick, TICK_MS);
}

function stopInterval() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
}

function tick() {
  if (!isCountingNow()) return;
  checkDayRollover();
  activeSeconds += 1;
  if (activeSeconds >= MINUTE_SECONDS) {
    activeSeconds -= MINUTE_SECONDS;
    sessionMinutes += 1;
    getDb()
      .addUsageMinute()
      .then(todayMinutes => {
        if (typeof todayMinutes === 'number' && isDailyMilestone(todayMinutes)) {
          emitMilestone({ scope: 'daily', minutes: todayMinutes });
        }
      })
      .catch(() => {});
    if (SESSION_MILESTONES.includes(sessionMinutes)) {
      emitMilestone({ scope: 'session', minutes: sessionMinutes });
    }
    for (const listener of listeners) {
      try {
        listener();
      } catch {}
    }
  }
}

function emitMilestone(milestone: UsageMilestone) {
  for (const listener of milestoneListeners) {
    try {
      listener(milestone);
    } catch {}
  }
}

// FB108: the first counted second of a new calendar day closes the previous one.
// The very first tick of an app run only adopts today's date (nothing rolled
// over, the learner just started), so a restart never fakes a celebration.
function checkDayRollover() {
  const today = localDateString();
  if (currentDay === null) {
    currentDay = today;
    return;
  }
  if (currentDay === today) return;
  const finished = currentDay;
  currentDay = today;
  sessionMinutes = 0; // the new day starts its own session milestones
  getDb()
    .getDayStats(finished)
    .then(({ minutes, words }) => {
      for (const listener of dayRolloverListeners) {
        try {
          listener({ date: finished, minutes, words });
        } catch {}
      }
    })
    .catch(() => {});
}

// Backgrounding stops the tick loop (no point polling while suspended); it
// does NOT touch `activeSeconds`, so whatever was banked before going to the
// background survives and resumes counting once the app + interaction are
// both active again, nothing to "flush", pausing already keeps it safe.
function handleAppStateChange(next: AppStateStatus) {
  appState = next;
  if (next !== 'active') {
    stopInterval();
  } else if (running) {
    startInterval();
  }
}

export function startUsageTimer(): void {
  if (running) return;
  running = true;
  appState = (AppState.currentState as AppStateStatus) || 'active';
  appStateSub = AppState.addEventListener('change', handleAppStateChange);
  if (appState === 'active') startInterval();
}

export function stopUsageTimer(): void {
  running = false;
  stopInterval();
  appStateSub?.remove();
  appStateSub = null;
}

export function noteInteraction(): void {
  lastInteractionAt = Date.now();
}

export function onActiveMinute(callback: Listener): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// FB63: fires when a session (30 min) or daily (30/60 min) milestone is reached.
export function onUsageMilestone(callback: MilestoneListener): () => void {
  milestoneListeners.add(callback);
  return () => milestoneListeners.delete(callback);
}

// FB108: fires once when the local calendar day turns over mid-play, carrying
// the finished day's totals.
export function onDayRollover(callback: DayRolloverListener): () => void {
  dayRolloverListeners.add(callback);
  return () => dayRolloverListeners.delete(callback);
}

// Test-only: resets all module-level state between test cases. Not used by app code.
export function __resetForTests(): void {
  stopUsageTimer();
  appState = 'active';
  lastInteractionAt = 0;
  activeSeconds = 0;
  sessionMinutes = 0;
  currentDay = null;
  listeners.clear();
  milestoneListeners.clear();
  dayRolloverListeners.clear();
}
