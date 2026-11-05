// Automatic push of the learner's daily XP to the weekly leaderboard (lib/cloud/board.ts). It runs only when this device
// has an identity (native: the device token from joining, web: the cloud session) and never shows an error: a failed push
// is simply repeated at the next trigger (app start, back to the foreground, 20 s after an XP change).
import { AppState, Platform } from 'react-native';

import { getDb } from '@/lib/database';
import { onXpChanged } from '@/lib/dailyXp';
import { buildDayRange } from '@/lib/usageStats';
import { boardToken, putBoardXp, type BoardDay, type BoardMinuteDay } from './board';

export const PUSH_DEBOUNCE_MS = 20000;
// A learner who keeps earning XP keeps restarting the debounce; the push goes up at the latest this long after the first
// change that is still waiting.
export const PUSH_MAX_WAIT_MS = 60000;
// How many local days go up: the server accepts the last 14 (the ranking itself only needs the current week).
export const BOARD_DAYS = 14;

// The last BOARD_DAYS local days, oldest first, with the day's XP in tenths (0 for a day without any).
export async function boardPayload(now: Date = new Date()): Promise<BoardDay[]> {
  const db = getDb();
  return Promise.all(buildDayRange(BOARD_DAYS, now).map(async (date): Promise<BoardDay> => [date, await db.getDailyXpTenths(date)]));
}

// The same days with the day's active-use minutes (the counter of lib/usageTimer.ts: foreground, touch within the last 30 s).
export async function boardMinutesPayload(now: Date = new Date()): Promise<BoardMinuteDay[]> {
  const byDate = new Map((await getDb().getUsageStats()).last30Days.map((d): [string, number] => [d.date, d.minutes]));
  return buildDayRange(BOARD_DAYS, now).map((date): BoardMinuteDay => [date, Math.max(0, Math.floor(byDate.get(date) ?? 0))]);
}

async function pushOnce(): Promise<void> {
  try {
    const token = await boardToken();
    if (!token) return;
    const res = await putBoardXp(token, await boardPayload(), await boardMinutesPayload());
    if (!res.ok && res.error === 'bad_token' && Platform.OS !== 'web') await getDb().setBoardIdentity(null);
  } catch {
    // the next trigger tries again
  }
}

let running: Promise<void> | null = null;
let dirty = false;

// One push now. Silent on every failure; on native a bad_token answer means the server forgot this device, so the
// stored identity goes (the card then offers joining again). One push runs at a time, so an older payload can never land
// after a newer one: a trigger that arrives meanwhile only marks the state dirty and one more push follows. Every caller
// gets the promise of the whole chain, so the card reads the board after its own trigger's push.
export function pushBoardNow(): Promise<void> {
  if (running) {
    dirty = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        dirty = false;
        await pushOnce();
      } while (dirty);
    } finally {
      running = null;
    }
  })();
  return running;
}

// Starts the three triggers; returns the function that stops them.
export function startBoardSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;
  const fire = () => {
    if (timer) clearTimeout(timer);
    if (maxTimer) clearTimeout(maxTimer);
    timer = maxTimer = null;
    void pushBoardNow();
  };
  void pushBoardNow();
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void pushBoardNow();
  });
  const stopXp = onXpChanged(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fire, PUSH_DEBOUNCE_MS);
    maxTimer ??= setTimeout(fire, PUSH_MAX_WAIT_MS);
  });
  return () => {
    if (timer) clearTimeout(timer);
    if (maxTimer) clearTimeout(maxTimer);
    appState.remove();
    stopXp();
  };
}
