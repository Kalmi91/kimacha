// Client of the web cloud API (the contract is in PLAN-web-felho.md, the server is cloud/worker.ts).
// Relative /api/... URLs: the Worker serves the web build and the API from one origin.
// Nothing here throws: every call answers { ok: true, data } or { ok: false, error }.
import { loadSession } from './session';

export type CloudErrorCode = 'network' | 'bad_input' | 'locked' | 'bad_pin' | 'bad_token' | 'too_large' | 'conflict' | 'name_taken' | 'server';

// `current`: with 'conflict', the state the server holds now (PUT /api/progress was based on an older revision).
export type CloudFailure = { ok: false; error: CloudErrorCode; retryAfterSec?: number; current?: ProgressData };

export type CloudResult<T> = { ok: true; data: T } | CloudFailure;

export interface LoginData {
  token: string;
  displayName: string;
  created: boolean;
  payload: string | null;
  updatedAt: string | null;
  rev: number;
}

// `rev`: how many saves the account has had; the next PUT says which one it is based on.
export interface ProgressData {
  payload: string | null;
  updatedAt: string | null;
  rev: number;
}

const SERVER_CODES: readonly CloudErrorCode[] = ['bad_input', 'locked', 'bad_pin', 'bad_token', 'too_large', 'conflict', 'name_taken'];

// fetch() is allowed to outlive the page only with a body under 64 KiB; 3 bytes per char at most.
const KEEPALIVE_MAX_CHARS = 20000;

async function call<T>(path: string, init: RequestInit): Promise<CloudResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    return { ok: false, error: 'network' };
  }
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // not JSON (e.g. a proxy error page): handled below as a server error
  }
  if (res.ok && body && typeof body === 'object') return { ok: true, data: body as T };
  const code = SERVER_CODES.find((c) => c === body?.error) ?? 'server';
  const retryAfterSec = typeof body?.retryAfterSec === 'number' ? body.retryAfterSec : undefined;
  if (code === 'conflict' && typeof body?.rev === 'number') return { ok: false, error: code, current: { payload: body.payload ?? null, updatedAt: body.updatedAt ?? null, rev: body.rev } };
  return retryAfterSec === undefined ? { ok: false, error: code } : { ok: false, error: code, retryAfterSec };
}

// A token left in the stored session goes along as the bearer: a device that is already signed in to this account is not
// held back by the lock (cloud/worker.ts). For any other name the server ignores it.
export function login(name: string, pin: string): Promise<CloudResult<LoginData>> {
  const token = loadSession()?.token;
  return call<LoginData>('/api/login', {
    method: 'POST',
    headers: token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, pin }),
  });
}

export function getProgress(token: string): Promise<CloudResult<ProgressData>> {
  return call<ProgressData>('/api/progress', { headers: { Authorization: `Bearer ${token}` } });
}

// `keepalive`: for the upload on page hide, so the browser may finish it after the page is gone (small bodies only).
// `baseRev`: the revision the payload is based on; with it the server refuses (409 conflict) a save over a newer one.
export function putProgress(token: string, payload: string, keepalive = false, baseRev?: number): Promise<CloudResult<{ updatedAt: string; rev: number }>> {
  const body = JSON.stringify(baseRev === undefined ? { payload } : { payload, rev: baseRev });
  return call<{ updatedAt: string; rev: number }>('/api/progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body,
    keepalive: keepalive && body.length <= KEEPALIVE_MAX_CHARS,
  });
}
