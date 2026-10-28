// The decisions of the web cloud API that need no Workers runtime: input parsing, the lock rule, the token header.
// worker.ts calls these; lib/cloud/__tests__/workerLogic.test.ts tests them under jest. Keep this file free of Workers
// globals and types, because the root typecheck pulls it in through that test.
import { isValidName, isValidPin } from '../lib/cloud/validate';

export const MAX_FAILS = 5;
export const LOCK_SEC = 15 * 60;
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

/** The name as typed, for display: NFC, trimmed, inner whitespace collapsed (the case is kept, unlike nameKey). */
export function displayName(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** Whole seconds left of a lock, 0 when there is none (or it has run out). `lockedUntil` and `now` are epoch ms. */
export function lockRemainingSec(lockedUntil: number | null, now: number): number {
  if (lockedUntil === null || lockedUntil <= now) return 0;
  return Math.ceil((lockedUntil - now) / 1000);
}

/** The counter state after one more wrong PIN: the MAX_FAILS-th in a row locks the name for LOCK_SEC and restarts the count. */
export function afterBadPin(failCount: number, now: number): { failCount: number; lockedUntil: number | null } {
  const next = failCount + 1;
  if (next >= MAX_FAILS) return { failCount: 0, lockedUntil: now + LOCK_SEC * 1000 };
  return { failCount: next, lockedUntil: null };
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
