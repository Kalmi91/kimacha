// Client of the web cloud API (the contract is in PLAN-web-felho.md, the server is cloud/worker.ts).
// Relative /api/... URLs: the Worker serves the web build and the API from one origin.
// Nothing here throws: every call answers { ok: true, data } or { ok: false, error }.

export type CloudErrorCode = 'network' | 'bad_input' | 'locked' | 'bad_pin' | 'bad_token' | 'too_large' | 'server';

export type CloudFailure = { ok: false; error: CloudErrorCode; retryAfterSec?: number };

export type CloudResult<T> = { ok: true; data: T } | CloudFailure;

export interface LoginData {
  token: string;
  displayName: string;
  created: boolean;
  payload: string | null;
  updatedAt: string | null;
}

export interface ProgressData {
  payload: string | null;
  updatedAt: string | null;
}

const SERVER_CODES: readonly CloudErrorCode[] = ['bad_input', 'locked', 'bad_pin', 'bad_token', 'too_large'];

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
  return retryAfterSec === undefined ? { ok: false, error: code } : { ok: false, error: code, retryAfterSec };
}

export function login(name: string, pin: string): Promise<CloudResult<LoginData>> {
  return call<LoginData>('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, pin }),
  });
}

export function getProgress(token: string): Promise<CloudResult<ProgressData>> {
  return call<ProgressData>('/api/progress', { headers: { Authorization: `Bearer ${token}` } });
}

// `keepalive`: for the upload on page hide, so the browser may finish it after the page is gone (small bodies only).
export function putProgress(token: string, payload: string, keepalive = false): Promise<CloudResult<{ updatedAt: string }>> {
  const body = JSON.stringify({ payload });
  return call<{ updatedAt: string }>('/api/progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body,
    keepalive: keepalive && body.length <= KEEPALIVE_MAX_CHARS,
  });
}
