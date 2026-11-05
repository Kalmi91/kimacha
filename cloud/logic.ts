// The decisions of the web cloud API that need no Workers runtime: input parsing, the lock rule, the token header.
// worker.ts calls these; lib/cloud/__tests__/workerLogic.test.ts tests them under jest. Keep this file free of Workers
// globals and types, because the root typecheck pulls it in through that test.
import { isValidName, isValidPin } from '../lib/cloud/validate';

export const MAX_FAILS = 5;
export const LOCK_SEC = 15 * 60;
// Wrong PINs for one name from all addresses together, inside one window of LOCK_SEC, before the whole name is locked.
// MAX_FAILS is the limit of one address (name + IP), so a stranger who knows only the name locks his own address, not the owner's.
export const MAX_NAME_FAILS = 50;
export const MAX_PAYLOAD_CHARS = 1_000_000;

function asRecord(body: unknown): Record<string, unknown> | null {
  return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

/** The POST /api/login body, or null when it breaks the name / PIN rule (-> 400 bad_input). */
export function parseLogin(body: unknown): { name: string; pin: string } | null {
  const rec = asRecord(body);
  if (!rec || typeof rec.name !== 'string' || typeof rec.pin !== 'string') return null;
  if (!isValidName(rec.name) || !isValidPin(rec.pin)) return null;
  return { name: rec.name, pin: rec.pin };
}

export type PayloadResult = { ok: true; payload: string } | { ok: false; status: 400 | 413; error: 'bad_input' | 'too_large' };

/** The PUT /api/progress body: a string payload of at most MAX_PAYLOAD_CHARS characters. */
export function parsePayload(body: unknown): PayloadResult {
  const rec = asRecord(body);
  if (!rec || typeof rec.payload !== 'string') return { ok: false, status: 400, error: 'bad_input' };
  if (rec.payload.length > MAX_PAYLOAD_CHARS) return { ok: false, status: 413, error: 'too_large' };
  return { ok: true, payload: rec.payload };
}

/**
 * The server revision a PUT /api/progress body says its payload is based on: `rev` null when the body has none (an old client:
 * the write is unconditional, as before), not ok when `rev` is there but is not a non-negative integer (-> 400 bad_input).
 */
export function parseBaseRev(body: unknown): { ok: true; rev: number | null } | { ok: false } {
  const rev = asRecord(body)?.rev;
  if (rev === undefined) return { ok: true, rev: null };
  return typeof rev === 'number' && Number.isSafeInteger(rev) && rev >= 0 ? { ok: true, rev } : { ok: false };
}

/** The address of the request as Cloudflare names it, '' when the header is missing (all such requests share one address). */
export function clientIp(header: string | null): string {
  return (header ?? '').trim().slice(0, 64);
}

/** The name as typed, for display: NFC, trimmed, inner whitespace collapsed (the case is kept, unlike nameKey). */
export function displayName(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** Whole seconds left of a lock, 0 when there is none (or it has run out). `lockedUntil` and `now` are epoch ms. */
export function lockRemainingSec(lockedUntil: number | null, now: number): number {
  if (lockedUntil === null || lockedUntil <= now) return 0;
  return Math.ceil((lockedUntil - now) / 1000);
}

/** The counter state after one more wrong PIN: the `maxFails`-th in a row locks for LOCK_SEC and restarts the count. */
export function afterBadPin(failCount: number, now: number, maxFails = MAX_FAILS): { failCount: number; lockedUntil: number | null } {
  const next = failCount + 1;
  if (next >= maxFails) return { failCount: 0, lockedUntil: now + LOCK_SEC * 1000 };
  return { failCount: next, lockedUntil: null };
}

/**
 * The name-wide counter after one more wrong PIN at `now`. The count lives inside one window of LOCK_SEC that starts with its
 * first wrong PIN (`failSince`, epoch ms); a window that is that old (or none) is dropped and this PIN starts a new one. So
 * only MAX_NAME_FAILS wrong PINs inside one window lock the name, however many windows a slow guesser spreads them over.
 */
export function afterBadPinForName(failCount: number, failSince: number | null, now: number): { failCount: number; lockedUntil: number | null; failSince: number } {
  const stale = failSince === null || now - failSince >= LOCK_SEC * 1000; // the same edge as lockRemainingSec: at the end of a window it is over
  return { ...afterBadPin(stale ? 0 : failCount, now, MAX_NAME_FAILS), failSince: stale ? now : failSince };
}

/** The token out of an `Authorization: Bearer <token>` header, or null. */
export function bearerToken(header: string | null): string | null {
  const m = /^Bearer (\S+)$/.exec(header ?? '');
  return m ? m[1] : null;
}

/** String compare whose running time does not depend on where the first difference is (for the PIN hash). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Whether the request may read /api/admin/stats: the bearer token equals ADMIN_KEY. A missing or short (< 32 chars) key opens nothing. */
export function adminAuthorized(authHeader: string | null, adminKey: string | undefined): boolean {
  if (adminKey === undefined || adminKey.length < 32) return false;
  const token = bearerToken(authHeader);
  return token !== null && safeEqual(token, adminKey);
}

/** What the saved progress says about the use of the app; null / 0 where the payload has nothing (or nothing readable). */
export type UsageSummary = {
  pair: string | null;
  level: string | null;
  minutesTotal: number;
  minutes7d: number;
  activeDays: number;
  lastActiveDay: string | null;
  xpTotal: number;
  streak: number;
  longestStreak: number;
};

/** `day` (YYYY-MM-DD) moved by `delta` days, in UTC; '' when `day` is not a date. */
function shiftDay(day: string, delta: number): string {
  const ms = Date.parse(day + 'T00:00:00Z') + delta * 86_400_000;
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10);
}

/** A JSON string as an object, or null (not JSON, or not an object). Never throws. */
function parseObject(text: unknown): Record<string, unknown> | null {
  if (typeof text !== 'string') return null;
  try {
    return asRecord(JSON.parse(text));
  } catch {
    return null;
  }
}

/** A serialized Map (`[key, value][]`) as entries with a string key; anything else in it is skipped. */
function mapEntries(value: unknown): [string, unknown][] {
  if (!Array.isArray(value)) return [];
  const out: [string, unknown][] = [];
  for (const e of value) if (Array.isArray(e) && typeof e[0] === 'string') out.push([e[0], e[1]]);
  return out;
}

/** The (date, number) entries of a serialized Map<string, number> (usageMinutes, dailyXp). */
function numberEntries(value: unknown): [string, number][] {
  return mapEntries(value).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]));
}

/**
 * The usage figures out of a stored progress payload (`{ v, store, resume }`, lib/cloud/sync.ts; `store` is
 * MemoryStore.serializeState). `today` is YYYY-MM-DD (UTC). Never throws: whatever cannot be read stays null / 0.
 */
export function usageSummary(payload: string | null, today: string): UsageSummary {
  const sum: UsageSummary = { pair: null, level: null, minutesTotal: 0, minutes7d: 0, activeDays: 0, lastActiveDay: null, xpTotal: 0, streak: 0, longestStreak: 0 };
  const state = parseObject(parseObject(payload)?.store);
  if (!state) return sum;

  const ob = asRecord(state.onboarding);
  const levels = mapEntries(state.userLevels);
  if (ob && typeof ob.source === 'string' && typeof ob.target === 'string') {
    sum.pair = ob.source + '→' + ob.target;
    const own = levels.find(([pair]) => pair === ob.source + '-' + ob.target);
    const lv = asRecord(own?.[1])?.level;
    if (typeof lv === 'string') sum.level = lv;
  }
  if (sum.level === null && levels.length > 0) {
    const lv = asRecord(levels[0][1])?.level;
    if (typeof lv === 'string') sum.level = lv;
  }

  const from = shiftDay(today, -6);
  for (const [date, minutes] of numberEntries(state.usageMinutes)) {
    sum.minutesTotal += minutes;
    if (date >= from) sum.minutes7d += minutes; // no upper bound: a learner east of UTC can already be on tomorrow
    if (minutes > 0) {
      sum.activeDays += 1;
      if (sum.lastActiveDay === null || date > sum.lastActiveDay) sum.lastActiveDay = date;
    }
  }
  sum.xpTotal = Math.round(numberEntries(state.dailyXp).reduce((acc, [, tenths]) => acc + tenths, 0) / 10);

  const streak = asRecord(state.streak);
  if (streak) {
    const current = typeof streak.current_count === 'number' ? streak.current_count : 0;
    const broken = typeof streak.last_date === 'string' && streak.last_date < shiftDay(today, -1);
    sum.streak = broken ? 0 : current;
    if (typeof streak.longest_count === 'number') sum.longestStreak = streak.longest_count;
  }
  return sum;
}

/** One row of the admin SQL; `first_login` / `last_login` are epoch ms (tokens.created_at). */
export type AdminUserRow = {
  display_name: string;
  updated_at: string | null;
  payload: string | null;
  payload_chars: number | null;
  logins: number;
  first_login: number | null;
  last_login: number | null;
};

/** One account as the admin page gets it: no PIN hash, no salt, no payload, only counts, ISO dates and the usage figures. */
export type AdminUserStat = UsageSummary & {
  name: string;
  logins: number;
  firstLogin: string | null;
  lastLogin: string | null;
  lastSave: string | null;
  progressKb: number;
};

/** The admin rows as stats, the most recent activity (last login or save) first, accounts with no activity last. */
export function toAdminStats(rows: AdminUserRow[], today: string): AdminUserStat[] {
  const activity = (r: AdminUserRow): number => {
    const save = r.updated_at === null ? NaN : Date.parse(r.updated_at);
    return Math.max(r.last_login ?? -Infinity, Number.isNaN(save) ? -Infinity : save);
  };
  const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString());
  return rows
    .map((r) => {
      const chars = r.payload_chars ?? 0;
      const stat: AdminUserStat = {
        name: r.display_name,
        logins: r.logins,
        firstLogin: iso(r.first_login),
        lastLogin: iso(r.last_login),
        lastSave: r.updated_at,
        progressKb: chars > 0 ? Math.max(1, Math.round(chars / 1024)) : 0,
        ...usageSummary(r.payload, today),
      };
      return { stat, at: activity(r) };
    })
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .map((x) => x.stat);
}

// The weekly XP leaderboard (PLAN-rangsor.md, "API-szerződés"): the table `board` holds one row per player, `daily_xp` is a JSON
// array of [date, tenths] pairs (tenths of XP, the unit of dailyXp in the app's MemoryStore).
export const BOARD_MAX_TENTHS = 20_000; // one pushed day is clamped to this (2000 XP)
export const BOARD_WINDOW_DAYS = 14; // pushed days reach back this many days from today (today included), and one day ahead
export const BOARD_MAX_DAYS = 20; // entries of a PUT /api/board/xp body that are read, the rest is ignored
export const BOARD_MAX_ROWS = 50; // rows of the GET /api/board list
export const BOARD_MAX_MINUTES = 1440; // one pushed day of learning minutes is clamped to this (24 h)
export const BOARD_JOINS_PER_DAY = 10; // POST /api/board/join per address and UTC day
export const BOARD_RETENTION_DAYS = 28; // a board row nobody pushed to for this long is deleted (orphan devices, squatted names)

/** Whether `s` is a real calendar date written YYYY-MM-DD (2026-02-30 is not). */
function isIsoDay(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const ms = Date.parse(s + 'T00:00:00Z');
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === s;
}

/** The POST /api/board/join body's name, or null when it breaks the login name rule (-> 400 bad_input). */
export function parseBoardName(body: unknown): string | null {
  const name = asRecord(body)?.name;
  return typeof name === 'string' && isValidName(name) ? name : null;
}

/**
 * The PUT /api/board/xp body as the days to store: `days` is a list of [date, tenths]; an entry whose date is not YYYY-MM-DD,
 * is outside [utcToday - (BOARD_WINDOW_DAYS - 1), utcToday + 1] or whose tenths is not an integer is dropped, tenths is clamped
 * to 0..BOARD_MAX_TENTHS, of a repeated date the last one counts, only the first BOARD_MAX_DAYS entries are read. Sorted by date.
 * Null when `days` is not an array (-> 400 bad_input). Never throws.
 */
export function parseBoardDays(body: unknown, utcToday: string): [string, number][] | null {
  const days = asRecord(body)?.days;
  if (!Array.isArray(days)) return null;
  const from = shiftDay(utcToday, 1 - BOARD_WINDOW_DAYS);
  const to = shiftDay(utcToday, 1);
  const byDay = new Map<string, number>();
  for (const e of days.slice(0, BOARD_MAX_DAYS)) {
    if (!Array.isArray(e) || !isIsoDay(e[0]) || e[0] < from || e[0] > to || !Number.isInteger(e[1])) continue;
    byDay.set(e[0], Math.min(Math.max(e[1], 0), BOARD_MAX_TENTHS));
  }
  return [...byDay].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * The PUT /api/board/xp body's learning minutes as the days to store: `minutes` is a list of [date, whole minutes], filtered, clamped
 * to 0..BOARD_MAX_MINUTES and sorted exactly like parseBoardDays. Null when `minutes` is missing or not an array: an old client sends
 * none, and the stored minutes then stay as they are (no error). Never throws.
 */
export function parseBoardMinutes(body: unknown, utcToday: string): [string, number][] | null {
  const minutes = asRecord(body)?.minutes;
  if (!Array.isArray(minutes)) return null;
  const from = shiftDay(utcToday, 1 - BOARD_WINDOW_DAYS);
  const to = shiftDay(utcToday, 1);
  const byDay = new Map<string, number>();
  for (const e of minutes.slice(0, BOARD_MAX_DAYS)) {
    if (!Array.isArray(e) || !isIsoDay(e[0]) || e[0] < from || e[0] > to || !Number.isInteger(e[1])) continue;
    byDay.set(e[0], Math.min(Math.max(e[1], 0), BOARD_MAX_MINUTES));
  }
  return [...byDay].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * The stored learning minutes with a push merged in: per day the larger of the stored and the pushed figure, so minutes never go
 * down (a fresh install or a second device that has counted less cannot lower the week). Days older than the push window are dropped.
 * `stored` is the `daily_minutes` JSON text; whatever cannot be read counts as nothing. Sorted by date. Never throws.
 */
export function mergeBoardMinutes(stored: string, pushed: [string, number][], utcToday: string): [string, number][] {
  const from = shiftDay(utcToday, 1 - BOARD_WINDOW_DAYS);
  const byDay = new Map<string, number>();
  let old: unknown;
  try {
    old = JSON.parse(stored);
  } catch {
    old = [];
  }
  const add = (date: string, minutes: number) => {
    if (date >= from) byDay.set(date, Math.max(byDay.get(date) ?? 0, minutes));
  };
  if (Array.isArray(old)) for (const e of old) if (Array.isArray(e) && isIsoDay(e[0]) && Number.isInteger(e[1])) add(e[0], Math.min(Math.max(e[1], 0), BOARD_MAX_MINUTES));
  for (const [date, minutes] of pushed) add(date, minutes);
  return [...byDay].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
}

export type BoardMetric = 'xp' | 'time';

/** The GET /api/board `?metric=`: 'time' ranks by learning minutes, anything else (or nothing: an old client) by XP. */
export function parseBoardMetric(param: string | null): BoardMetric {
  return param === 'time' ? 'time' : 'xp';
}

/** The day a GET /api/board counts as today: the client's `?today=` when it is a real date at most 1 day from `utcToday` (its time zone), else `utcToday`. */
export function boardToday(param: string | null, utcToday: string): string {
  return isIsoDay(param) && param >= shiftDay(utcToday, -1) && param <= shiftDay(utcToday, 1) ? param : utcToday;
}

/** The Monday (YYYY-MM-DD) of the week `today` is in; weeks run Monday to Sunday. '' when `today` is not a date. */
export function weekStartOf(today: string): string {
  if (!isIsoDay(today)) return '';
  const sinceMonday = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7;
  return shiftDay(today, -sinceMonday);
}

/** Whole seconds from `now` (epoch ms) to the next 00:00 UTC, 1..86400 (the end of the join limit's day). */
export function secondsToNextUtcDay(now: number): number {
  return Math.ceil((86_400_000 - (now % 86_400_000)) / 1000);
}

/** One player as the board table has it; `dailyXp` / `dailyMinutes` are the stored JSON texts (`dailyMinutes` missing = no minutes). */
export type BoardEntry = { owner: string; name: string; dailyXp: string; dailyMinutes?: string };
export type BoardRow = { rank: number; name: string; xp: number; minutes: number; me: boolean };
export type BoardRanking = { rows: BoardRow[]; me: { rank: number; xp: number; minutes: number; name: string } | null };

/** The sum of the numbers a stored `[date, number][]` text holds inside the week that starts on `weekStart`. 0 for whatever cannot be read. */
function weekTotal(text: string, weekStart: string): number {
  const end = shiftDay(weekStart, 6);
  let days: unknown;
  try {
    days = JSON.parse(text);
  } catch {
    return 0;
  }
  if (!Array.isArray(days)) return 0;
  let total = 0;
  for (const e of days) if (Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'number' && Number.isFinite(e[1]) && e[0] >= weekStart && e[0] <= end) total += e[1];
  return total;
}

/** The XP of a stored `daily_xp` text inside the week that starts on `weekStart`: the tenths of its 7 days summed, / 10, rounded. 0 for whatever cannot be read. */
function weekXp(dailyXp: string, weekStart: string): number {
  return Math.round(weekTotal(dailyXp, weekStart) / 10);
}

/** The learning minutes of a stored `daily_minutes` text inside the week that starts on `weekStart`, rounded. 0 for whatever cannot be read. */
function weekMinutes(dailyMinutes: string | undefined, weekStart: string): number {
  return dailyMinutes === undefined ? 0 : Math.round(weekTotal(dailyMinutes, weekStart));
}

/**
 * The board of the week starting on `weekStart`: the asked metric descending (XP by default, or learning minutes), then name (case and
 * accents ignored); players with 0 of that metric are left out except the caller (`callerOwner`), who then stands last. Rank = 1-based
 * position. `rows` are the first BOARD_MAX_ROWS, `me` is the caller wherever they stand (null when no entry has that owner). Every row
 * carries both figures. Never throws.
 */
export function rankBoard(entries: BoardEntry[], weekStart: string, callerOwner: string, metric: BoardMetric = 'xp'): BoardRanking {
  const value = (e: { xp: number; minutes: number }) => (metric === 'time' ? e.minutes : e.xp);
  const ranked = entries
    .map((e) => ({ owner: e.owner, name: e.name, xp: weekXp(e.dailyXp, weekStart), minutes: weekMinutes(e.dailyMinutes, weekStart) }))
    .filter((e) => value(e) > 0 || e.owner === callerOwner)
    .sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || (a.owner < b.owner ? -1 : a.owner > b.owner ? 1 : 0));
  const rows = ranked.slice(0, BOARD_MAX_ROWS).map((e, i) => ({ rank: i + 1, name: e.name, xp: e.xp, minutes: e.minutes, me: e.owner === callerOwner }));
  const at = ranked.findIndex((e) => e.owner === callerOwner);
  return { rows, me: at < 0 ? null : { rank: at + 1, xp: ranked[at].xp, minutes: ranked[at].minutes, name: ranked[at].name } };
}
