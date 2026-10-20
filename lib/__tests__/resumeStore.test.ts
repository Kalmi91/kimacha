// Card-level resume store: save and read back on native (game_progress) and on web (localStorage); a failing
// store is logged and reported, never thrown.

import { Platform } from 'react-native';

import type { DB } from '@/lib/database';
import { RESUME_GAME_ID } from '../resumeRoute';
import { loadResumeValue, saveResumeValue } from '../resumeStore';

type Row = { itemId: string; state: string; data: unknown };

function fakeDb(rows: Row[] = [], opts: { failSet?: boolean; failGet?: boolean } = {}) {
  const setGameProgress = jest.fn(async (gameId: string, itemId: string, state: string, data?: unknown) => {
    if (opts.failSet) throw new Error('disk full');
    expect(gameId).toBe(RESUME_GAME_ID);
    const at = rows.findIndex((r) => r.itemId === itemId);
    const row = { itemId, state, data: data ?? null };
    if (at >= 0) rows[at] = row;
    else rows.push(row);
  });
  const getGameProgress = jest.fn(async (gameId: string) => {
    if (opts.failGet) throw new Error('db closed');
    expect(gameId).toBe(RESUME_GAME_ID);
    return rows;
  });
  return { db: { setGameProgress, getGameProgress } as unknown as DB, setGameProgress, rows };
}

let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

describe('resumeStore on native (game_progress)', () => {
  it('a saved value reads back, null clears it, and a missing key reads null', async () => {
    const { db, setGameProgress } = fakeDb();
    expect(await loadResumeValue(db, 'k')).toBeNull();
    expect(await saveResumeValue(db, 'k', { order: ['a', 'b'], n: 2 })).toBe(true);
    expect(await loadResumeValue(db, 'k')).toEqual({ order: ['a', 'b'], n: 2 });
    expect(await saveResumeValue(db, 'k', null)).toBe(true);
    expect(await loadResumeValue(db, 'k')).toBeNull();
    expect(setGameProgress).toHaveBeenLastCalledWith(RESUME_GAME_ID, 'k', 'cleared', null);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a throwing setGameProgress is logged and reported as false, not thrown', async () => {
    const { db } = fakeDb([], { failSet: true });
    await expect(saveResumeValue(db, 'k', { a: 1 })).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0].slice(0, 2)).toEqual(['resumeStore: could not save', 'k']);
  });

  it('a throwing getGameProgress is logged and reads as null', async () => {
    const { db } = fakeDb([], { failGet: true });
    await expect(loadResumeValue(db, 'k')).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0].slice(0, 2)).toEqual(['resumeStore: could not read', 'k']);
  });
});

describe('resumeStore on web (localStorage)', () => {
  const store = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  beforeEach(() => {
    store.clear();
    jest.replaceProperty(Platform, 'OS', 'web');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('a saved value reads back, null removes it, and the database is not touched', async () => {
    const { db, setGameProgress } = fakeDb();
    expect(await saveResumeValue(db, 'k', { order: ['a'] })).toBe(true);
    expect([...store.keys()]).toEqual(['kimacha-resume:k']);
    expect(await loadResumeValue(db, 'k')).toEqual({ order: ['a'] });
    expect(await saveResumeValue(db, 'k', null)).toBe(true);
    expect(store.size).toBe(0);
    expect(await loadResumeValue(db, 'k')).toBeNull();
    expect(setGameProgress).not.toHaveBeenCalled();
  });

  it('a full storage is logged and reported as false', async () => {
    const { db } = fakeDb();
    (globalThis.localStorage as { setItem: unknown }).setItem = () => {
      throw new Error('QuotaExceededError');
    };
    await expect(saveResumeValue(db, 'k', { a: 1 })).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('a corrupt stored value reads as null and is logged', async () => {
    const { db } = fakeDb();
    store.set('kimacha-resume:k', '{not json');
    await expect(loadResumeValue(db, 'k')).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
