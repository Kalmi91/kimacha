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
