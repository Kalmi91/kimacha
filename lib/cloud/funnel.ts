// Anonymous per-source funnel counters of the web version (server: cloud/worker.ts POST /api/event). Web only: on Android
// every function returns at once. The browser keeps the first-touch link label and a few markers in localStorage so each
// step is sent once per browser; every access is wrapped like in guest.ts, nothing here throws.
import { Platform } from 'react-native';
import { sendEvent } from './api';
import { subscribeCardsGraded } from './guest';

const SRC_KEY = 'kimacha.funnel.src';
const FIRST_DAY_KEY = 'kimacha.funnel.firstDay';
const CARDS_KEY = 'kimacha.funnel.cards';
const SENT_PREFIX = 'kimacha.funnel.sent.';
const SRC_PATTERN = /^[a-z0-9-]{1,24}$/;
const CARDS_GOAL = 5;

type FunnelEvent = 'open' | 'start' | 'cards5' | 'account' | 'return';

let started = false;
// True once the link label is stored. With blocked storage the once-per-browser markers cannot work, so nothing is counted.
let usable = false;
let unsubscribe: (() => void) | null = null;
const inFlight = new Set<string>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not stored: the step may be sent again on the next load
  }
}

function localDay(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function send(event: FunnelEvent): void {
  if (!usable || read(SENT_PREFIX + event) !== null || inFlight.has(event)) return;
  inFlight.add(event);
  void sendEvent(event, read(SRC_KEY) ?? 'direct').then(
    (ok) => {
      inFlight.delete(event);
      if (ok) write(SENT_PREFIX + event, '1');
    },
    () => {
      inFlight.delete(event);
    },
  );
}

export function initFunnel(search: string = typeof window === 'undefined' ? '' : window.location.search, now: Date = new Date()): void {
  if (Platform.OS !== 'web' || started) return;
  started = true;
  try {
    if (read(SRC_KEY) === null) {
      const raw = new URLSearchParams(search).get('src');
      write(SRC_KEY, raw !== null && SRC_PATTERN.test(raw) ? raw : 'direct');
    }
    usable = read(SRC_KEY) !== null;
    if (!usable) return;
    if (read(FIRST_DAY_KEY) === null) write(FIRST_DAY_KEY, localDay(now));
    send('open');
    const first = read(FIRST_DAY_KEY);
    if (first !== null && localDay(now) > first) send('return');
    unsubscribe = subscribeCardsGraded(() => {
      const n = Number(read(CARDS_KEY) ?? '0');
      const cards = Number.isFinite(n) ? n : 0;
      if (cards >= CARDS_GOAL) return;
      write(CARDS_KEY, String(cards + 1));
      if (cards + 1 >= CARDS_GOAL) send('cards5');
    });
  } catch {
    // counters never break the app
  }
}

export function noteFunnel(event: 'start' | 'account'): void {
  if (Platform.OS !== 'web') return;
  send(event);
}

/** Tests only: back to a fresh page life (localStorage is kept). */
export function resetFunnelForTests(): void {
  started = false;
  usable = false;
  unsubscribe?.();
  unsubscribe = null;
  inFlight.clear();
}
