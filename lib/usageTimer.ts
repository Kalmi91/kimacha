import { AppState, type AppStateStatus } from 'react-native';
import { getDb } from './database';

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

type Listener = () => void;

let running = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let appState: AppStateStatus = 'active';
let lastInteractionAt = 0;
let activeSeconds = 0; // partial progress toward the next full minute (0-59)

const listeners = new Set<Listener>();

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
  activeSeconds += 1;
  if (activeSeconds >= MINUTE_SECONDS) {
    activeSeconds -= MINUTE_SECONDS;
    getDb().addUsageMinute().catch(() => {});
    for (const listener of listeners) {
      try {
        listener();
      } catch {}
    }
  }
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

// Test-only: resets all module-level state between test cases. Not used by app code.
export function __resetForTests(): void {
  stopUsageTimer();
  appState = 'active';
  lastInteractionAt = 0;
  activeSeconds = 0;
  listeners.clear();
}
