// Client of the weekly XP leaderboard (the contract is in PLAN-rangsor.md, the server is cloud/worker.ts).
// Web: relative /api/... URLs (the Worker serves the web build and the API from one origin) and the cloud session's
// token. Native: the Worker's own address and the device token that join() handed out, kept in the DB (getBoardIdentity).
// Nothing here throws: every call answers { ok: true, data } or { ok: false, error }.
import { Platform } from 'react-native';

import { getDb } from '@/lib/database';
import type { CloudErrorCode } from './api';
import { loadSession } from './session';

export type BoardErrorCode = CloudErrorCode | 'name_taken';

export type BoardFailure = { ok: false; error: BoardErrorCode; retryAfterSec?: number };

export type BoardResult<T> = { ok: true; data: T } | BoardFailure;

export interface JoinData {
  token: string;
  displayName: string;
}

export interface BoardRow {
  rank: number;
  name: string;
  xp: number;
  me: boolean;
}

// `me: null` + `left: true`: a web account that left the board (the list is still there, the account can join again).
export interface BoardData {
  weekStart: string;
  rows: BoardRow[];
  me: { rank: number; xp: number; name: string } | null;
  left?: boolean;
}

// [local date YYYY-MM-DD, XP in tenths]
export type BoardDay = [string, number];

const NATIVE_BASE_URL = 'https://kimacha.kichata.workers.dev';

const SERVER_CODES: readonly BoardErrorCode[] = ['bad_input', 'locked', 'bad_token', 'too_large', 'name_taken'];

async function call<T>(path: string, init: RequestInit): Promise<BoardResult<T>> {
  let res: Response;
  try {
    res = await fetch((Platform.OS === 'web' ? '' : NATIVE_BASE_URL) + path, init);
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

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// The caller's token: the cloud session on web, the stored device token on native; null = no identity, nothing may go up.
export async function boardToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return loadSession()?.token ?? null;
    return (await getDb().getBoardIdentity())?.token ?? null;
  } catch {
    return null;
  }
}

// Native only: a new device token for the display name (no token needed for this call).
export function joinBoard(name: string): Promise<BoardResult<JoinData>> {
  return call<JoinData>('/api/board/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

// Web only: an account that left joins again, with its session token and no name (the account name is the display name).
export function rejoinBoard(token: string): Promise<BoardResult<{ displayName: string }>> {
  return call<{ displayName: string }>('/api/board/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bearer(token) },
    body: '{}',
  });
}

// Replaces the server's copy of the caller's daily XP (the last days, tenths of an XP).
export function putBoardXp(token: string, days: BoardDay[]): Promise<BoardResult<Record<string, never>>> {
  return call<Record<string, never>>('/api/board/xp', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...bearer(token) },
    body: JSON.stringify({ days }),
  });
}

// `today`: the caller's local date, so the week turns over at the learner's midnight (the server allows a day of drift).
export function getBoard(token: string, today: string): Promise<BoardResult<BoardData>> {
  return call<BoardData>(`/api/board?today=${encodeURIComponent(today)}`, { headers: bearer(token) });
}

// Deletes the caller's row; on native the device token dies with it.
export function leaveBoard(token: string): Promise<BoardResult<Record<string, never>>> {
  return call<Record<string, never>>('/api/board/me', { method: 'DELETE', headers: bearer(token) });
}
