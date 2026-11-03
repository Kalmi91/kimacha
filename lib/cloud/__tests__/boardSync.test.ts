// The automatic leaderboard push (lib/cloud/boardSync.ts): nothing goes up without an identity, the payload is the last 14
// local days in tenths, an XP change is debounced by 20 s, and a token the server forgot clears the native identity.
// The network call is mocked; the database is the in-memory one.

jest.mock('../board', () => ({ ...jest.requireActual('../board'), putBoardXp: jest.fn() }));

import { AppState, Platform } from 'react-native';

import { __resetForTests, addXp } from '@/lib/dailyXp';
import { getDb } from '@/lib/database';
import { putBoardXp } from '../board';
import { BOARD_DAYS, PUSH_DEBOUNCE_MS, PUSH_MAX_WAIT_MS, boardPayload, pushBoardNow, startBoardSync } from '../boardSync';

const mockPut = putBoardXp as jest.Mock;
const IDENTITY = { token: 'dev-tok', name: 'Kálmán' };

// Lets the pending promise chains (token read, 14 XP reads, the call) finish.
const settle = () => jest.advanceTimersByTimeAsync(0);

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 10, 3, 10, 0, 0) }); // 2026-11-03, local time
  mockPut.mockReset();
  mockPut.mockResolvedValue({ ok: true, data: {} });
  __resetForTests();
  await getDb().setBoardIdentity(null);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('boardPayload', () => {
  it('is the last 14 local days, oldest first, with the day XP in tenths and 0 for an empty day', async () => {
    const db = getDb();
    await db.addDailyXpTenths('2026-11-03', 32);
    await db.addDailyXpTenths('2026-10-21', 5);
    await db.addDailyXpTenths('2026-10-20', 99); // day 15: too old
    await db.addDailyXpTenths('2026-11-04', 77); // tomorrow: not yet
    const days = await boardPayload();
    expect(days).toHaveLength(BOARD_DAYS);
    expect(days[0]).toEqual(['2026-10-21', 5]);
    expect(days[13]).toEqual(['2026-11-03', 32]);
    expect(days[1]).toEqual(['2026-10-22', 0]);
    expect(days.map(([d]) => d)).not.toContain('2026-10-20');
    expect(days.map(([d]) => d)).not.toContain('2026-11-04');
  });
});

describe('pushBoardNow', () => {
  it('sends nothing while this device has no identity', async () => {
    await pushBoardNow();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('with an identity it sends the device token and the 14-day payload', async () => {
    await getDb().setBoardIdentity(IDENTITY);
    await pushBoardNow();
    expect(mockPut).toHaveBeenCalledTimes(1);
    const [token, days] = mockPut.mock.calls[0];
    expect(token).toBe('dev-tok');
    expect(days).toEqual(await boardPayload());
    expect(days).toHaveLength(14);
  });

  it('runs one push at a time: triggers that arrive meanwhile add exactly one more push, with the newer payload, after it', async () => {
    await getDb().setBoardIdentity(IDENTITY);
    let release: () => void = () => {};
    mockPut.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ ok: true, data: {} }); }));
    const first = pushBoardNow();
    await settle();
    expect(mockPut).toHaveBeenCalledTimes(1);

    await getDb().addDailyXpTenths('2026-11-03', 7); // earned while the first push is on its way
    const second = pushBoardNow();
    const third = pushBoardNow();
    await settle();
    expect(mockPut).toHaveBeenCalledTimes(1);

    release();
    await Promise.all([first, second, third]); // every caller waits for the whole chain
    expect(mockPut).toHaveBeenCalledTimes(2);
    const lastDay = (call: number) => mockPut.mock.calls[call][1].at(-1)[1];
    expect(lastDay(1)).toBe(lastDay(0) + 7);

    await pushBoardNow(); // the chain is over: a new trigger starts a new push
    expect(mockPut).toHaveBeenCalledTimes(3);
  });

  it('a bad_token answer on native clears the stored identity; any other failure keeps it', async () => {
    await getDb().setBoardIdentity(IDENTITY);
    mockPut.mockResolvedValue({ ok: false, error: 'network' });
    await pushBoardNow();
    mockPut.mockRejectedValue(new Error('boom'));
    await expect(pushBoardNow()).resolves.toBeUndefined();
    expect(await getDb().getBoardIdentity()).toEqual(IDENTITY);

    mockPut.mockResolvedValue({ ok: false, error: 'bad_token' });
    await pushBoardNow();
    expect(await getDb().getBoardIdentity()).toBeNull();
  });

  it('on web it pushes with the cloud session token and leaves the session alone on bad_token', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const store = new Map([['kimacha.cloud.session', JSON.stringify({ name: 'Kálmán', token: 'web-tok' })]]);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (k: string) => store.get(k) ?? null, setItem: () => {}, removeItem: () => {} },
    });
    await getDb().setBoardIdentity(IDENTITY);
    mockPut.mockResolvedValue({ ok: false, error: 'bad_token' });
    await pushBoardNow();
    expect(mockPut.mock.calls[0][0]).toBe('web-tok');
    expect(await getDb().getBoardIdentity()).toEqual(IDENTITY);
  });
});

describe('startBoardSync', () => {
  it('pushes once at start, and not at all without an identity', async () => {
    const stop = startBoardSync();
    await settle();
    expect(mockPut).not.toHaveBeenCalled();
    stop();

    await getDb().setBoardIdentity(IDENTITY);
    const stop2 = startBoardSync();
    await settle();
    expect(mockPut).toHaveBeenCalledTimes(1);
    stop2();
  });

  it('pushes when the app comes back to the foreground, not when it goes away', async () => {
    await getDb().setBoardIdentity(IDENTITY);
    let onChange: (s: string) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_e: string, cb: (s: string) => void) => {
      onChange = cb;
      return { remove };
    }) as never);
    const stop = startBoardSync();
    await settle();
    mockPut.mockClear();
    onChange('background');
    await settle();
    expect(mockPut).not.toHaveBeenCalled();
    onChange('active');
    await settle();
    expect(mockPut).toHaveBeenCalledTimes(1);
    stop();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('an XP change pushes 20 s later, and every further change restarts the wait', async () => {
    await getDb().setBoardIdentity(IDENTITY);
    const before = await getDb().getDailyXpTenths('2026-11-03'); // the in-memory database lives on between the tests
    const stop = startBoardSync();
    await settle();
    mockPut.mockClear();

    await addXp(2);
    await jest.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS - 1000);
    await addXp(1); // restarts the 20 s
    await jest.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS - 1000);
    expect(mockPut).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1000);
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockPut.mock.calls[0][1].at(-1)).toEqual(['2026-11-03', before + 30]);

    await jest.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS * 2);
    expect(mockPut).toHaveBeenCalledTimes(1);
    stop();
  });

  it('continuous XP cannot hold the push back for ever: it goes up 60 s after the first waiting change', async () => {
    await getDb().setBoardIdentity(IDENTITY);
    const stop = startBoardSync();
    await settle();
    mockPut.mockClear();

    await addXp(1); // t = 0
    for (let i = 0; i < 3; i++) {
      await jest.advanceTimersByTimeAsync(15000); // never the 20 s of quiet that the debounce needs
      await addXp(1); // t = 15, 30, 45
    }
    await jest.advanceTimersByTimeAsync(PUSH_MAX_WAIT_MS - 45000 - 1000);
    expect(mockPut).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1000); // t = 60
    expect(mockPut).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(PUSH_MAX_WAIT_MS * 2); // both timers were cleared: nothing else is waiting
    expect(mockPut).toHaveBeenCalledTimes(1);
    stop();
  });

  it('after stop() an XP change pushes nothing and a waiting push is cancelled', async () => {
    await getDb().setBoardIdentity(IDENTITY);
    const stop = startBoardSync();
    await settle();
    mockPut.mockClear();
    await addXp(2);
    stop();
    await addXp(2);
    await jest.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS * 2);
    expect(mockPut).not.toHaveBeenCalled();
  });
});
