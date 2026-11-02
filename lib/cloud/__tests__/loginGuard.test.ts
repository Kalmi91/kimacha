// Account protection of the web cloud login (cloud/logic.ts, lib/cloud/validate.ts, lib/cloud/api.ts): the boundaries of the
// lock rule, the constant-time compare, what counts as one account name, and where the PIN and the token travel.
// The cases marked `it.failing` state the RIGHT behavior that the code does not have yet: they pass while the gap exists
// and go red the day it is fixed, so the `.failing` has to come off then (the gaps are in the test report).
import { LOCK_SEC, MAX_FAILS, afterBadPin, bearerToken, lockRemainingSec, parseLogin, safeEqual } from '../../../cloud/logic';
import { getProgress, login, putProgress } from '../api';
import { SESSION_KEY } from '../session';
import { isValidName, isValidPin, nameKey } from '../validate';

const T = 1_700_000_000_000;

describe('lock rule over a whole sequence', () => {
  const wrong = (n: number, from = { failCount: 0, lockedUntil: null as number | null }) => {
    let state = from;
    for (let i = 0; i < n; i++) state = afterBadPin(state.failCount, T);
    return state;
  };

  it('does not lock before the MAX_FAILS-th wrong PIN', () => {
    expect(wrong(MAX_FAILS - 1)).toEqual({ failCount: MAX_FAILS - 1, lockedUntil: null });
  });

  it('locks on the MAX_FAILS-th, restarts the count, and the same number of tries locks again', () => {
    const locked = wrong(MAX_FAILS);
    expect(locked).toEqual({ failCount: 0, lockedUntil: T + LOCK_SEC * 1000 });
    expect(wrong(MAX_FAILS - 1, locked).lockedUntil).toBeNull();
    expect(wrong(MAX_FAILS, locked).lockedUntil).toBe(T + LOCK_SEC * 1000);
  });

  it('still locks and restarts from a damaged count at or above the limit', () => {
    for (const bad of [MAX_FAILS, MAX_FAILS + 1, 99]) {
      expect(afterBadPin(bad, T)).toEqual({ failCount: 0, lockedUntil: T + LOCK_SEC * 1000 });
    }
  });
});

describe('lockRemainingSec at the edge of the lock', () => {
  const until = T + LOCK_SEC * 1000;

  it('keeps the lock until the last millisecond, and the first attempt after it is free', () => {
    expect(lockRemainingSec(until, T)).toBe(LOCK_SEC);
    expect(lockRemainingSec(until, until - 1)).toBe(1);
    expect(lockRemainingSec(until, until)).toBe(0);
    expect(lockRemainingSec(until, until + 1)).toBe(0);
  });

  it('never shows a negative or fractional wait', () => {
    for (const now of [T, T + 1, T + 999, T + 1000, until - 1, until, until + 5000]) {
      const wait = lockRemainingSec(until, now);
      expect(Number.isInteger(wait)).toBe(true);
      expect(wait).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('safeEqual does not stop at the first difference', () => {
  // The running time is not measured (it would be flaky on a loaded machine): the number of characters it reads is.
  it('reads every position whether the strings differ first, last or not at all', () => {
    const spy = jest.spyOn(String.prototype, 'charCodeAt');
    try {
      const reads = (a: string, b: string) => {
        spy.mockClear();
        safeEqual(a, b);
        return spy.mock.calls.length;
      };
      const base = 'a'.repeat(64);
      const first = reads(base, 'b' + 'a'.repeat(63));
      const last = reads(base, 'a'.repeat(63) + 'b');
      const same = reads(base, base);
      expect(first).toBe(128);
      expect(last).toBe(first);
      expect(same).toBe(first);
    } finally {
      spy.mockRestore();
    }
  });

  it('is false for a prefix, an extension, another case and the empty string, true only for the same text', () => {
    expect(safeEqual('abc', 'ab')).toBe(false);
    expect(safeEqual('ab', 'abc')).toBe(false);
    expect(safeEqual('abc', 'ABC')).toBe(false);
    expect(safeEqual('', 'a')).toBe(false);
    expect(safeEqual('a', '')).toBe(false);
    expect(safeEqual('x'.repeat(5000), 'x'.repeat(5000))).toBe(true);
  });

  it('compares astral characters code unit by code unit', () => {
    expect(safeEqual('😀', '😀')).toBe(true);
    expect(safeEqual('😀', '😁')).toBe(false);
  });
});

describe('parseLogin edges', () => {
  it('bounds the key of the name, not the typed form (padding does not count)', () => {
    expect(parseLogin({ name: '  ' + 'x'.repeat(24) + '   ', pin: '1234' })).not.toBeNull();
    expect(parseLogin({ name: 'x'.repeat(25), pin: '1234' })).toBeNull();
    expect(parseLogin({ name: 'a   b', pin: '1234' })).not.toBeNull();
  });

  it('keeps only name and pin, whatever else the body carries', () => {
    expect(parseLogin({ name: 'Ana', pin: '1234', admin: true, token: 't' })).toEqual({ name: 'Ana', pin: '1234' });
  });

  it('does not read fields from a __proto__ key of the JSON body', () => {
    expect(parseLogin(JSON.parse('{"__proto__":{"name":"Ana","pin":"1234"}}'))).toBeNull();
  });

  it.each([
    ['a name array', { name: ['Ana'], pin: '1234' }],
    ['a name object', { name: { toString: 'Ana' }, pin: '1234' }],
    ['a null PIN', { name: 'Ana', pin: null }],
    ['a PIN with a line break at the end', { name: 'Ana', pin: '1234\n' }],
    ['a PIN with a space', { name: 'Ana', pin: ' 1234' }],
    ['a full-width PIN', { name: 'Ana', pin: '１２３４' }],
    ['a whitespace-only name', { name: '    ', pin: '1234' }],
    ['a number', 42],
    ['undefined', undefined],
  ])('rejects %s', (_label, body) => {
    expect(parseLogin(body)).toBeNull();
  });

  it('accepts only four ASCII digits as a PIN', () => {
    expect(isValidPin('0000')).toBe(true);
    for (const bad of ['1234\n', '1234 ', '+123', '1e03', '１２３４', '12３4']) expect(isValidPin(bad)).toBe(false);
  });
});

describe('bearerToken edges', () => {
  it.each(['Bearer abc ', 'Bearer  abc', 'Bearer abc\n', ' Bearer abc', 'Bearer abc def', 'Bearer\tabc', 'Bearer', 'Token abc'])(
    'gives null for %j',
    (header) => {
      expect(bearerToken(header)).toBeNull();
    },
  );

  it('returns the token as it is, case and symbols kept', () => {
    expect(bearerToken('Bearer aB3-_.~+/=')).toBe('aB3-_.~+/=');
  });
});

describe('what makes one account name', () => {
  it('is the same account for case, composed or decomposed accents, and any kind of space around or between', () => {
    expect(nameKey('ÁRPÁD')).toBe(nameKey('árpád'));
    expect(nameKey('Kálmán')).toBe(nameKey('Kálmán'));
    expect(nameKey('Ana María')).toBe(nameKey('ana  maría'));
    expect(nameKey('Ana　María')).toBe(nameKey('ana maría'));
    expect(nameKey(' Ana\t')).toBe(nameKey('ana'));
  });

  it('is a different account when the accent differs (the accent is part of the name)', () => {
    expect(nameKey('Kalman')).not.toBe(nameKey('Kálmán'));
  });

  // Two names that look the same on the screen must not be two accounts: either they share the key, or the second is refused.
  const sameAccountOrRefused = (typed: string, existing: string) => nameKey(typed) === nameKey(existing) || !isValidName(typed);

  it.failing.each([
    ['a Cyrillic a (U+0430) for the Latin a', 'Ana', 'Anа'],
    ['a Cyrillic o (U+043E) for the Latin o', 'Pablo', 'Pablо'],
    ['a Greek omicron (U+03BF) for the Latin o', 'Pablo', 'Pablο'],
    ['a zero width space at the end', 'Ana', 'Ana​'],
    ['a zero width space inside', 'Ana', 'A​na'],
    ['a zero width joiner inside', 'Ana', 'A‍na'],
    ['a word joiner inside', 'Ana', 'An⁠a'],
    ['a soft hyphen inside', 'Ana', 'An­a'],
    ['a full-width Latin letter', 'Ana', 'Ａna'],
  ])('treats %s as the same account or refuses it', (_label, existing, lookAlike) => {
    expect(sameAccountOrRefused(lookAlike, existing)).toBe(true);
  });
});

describe('where the PIN and the token travel', () => {
  const mockFetch = jest.fn();
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ updatedAt: 'x' }) });
    (globalThis as any).fetch = mockFetch;
  });

  it('keeps the name, the PIN and the token out of every URL', async () => {
    await login('Ana Secret', '4821');
    await getProgress('TOKEN-abc123');
    await putProgress('TOKEN-abc123', '{"a":1}');
    for (const [url] of mockFetch.mock.calls) {
      expect(url).toMatch(/^\/api\/(login|progress)$/);
      expect(url).not.toMatch(/Secret|4821|TOKEN|\?|#/);
    }
  });

  it('sends the token only in the Authorization header, never in a body', async () => {
    await getProgress('TOKEN-abc123');
    await putProgress('TOKEN-abc123', '{"a":1}');
    for (const [, init] of mockFetch.mock.calls) {
      expect(init.headers.Authorization).toBe('Bearer TOKEN-abc123');
      expect(String(init.body ?? '')).not.toContain('TOKEN-abc123');
    }
  });

  it('sends the token of the stored session as the bearer of the login, and no Authorization without a session', async () => {
    await login('Ana', '4821');
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: (k: string) => (k === SESSION_KEY ? JSON.stringify({ name: 'Ana', token: 'TOKEN-abc123' }) : null) },
      configurable: true,
      writable: true,
    });
    try {
      await login('Ana', '4821');
    } finally {
      delete (globalThis as any).localStorage;
    }
    const [url, init] = mockFetch.mock.calls[1];
    expect(url).toBe('/api/login');
    expect(init.headers.Authorization).toBe('Bearer TOKEN-abc123');
    expect(JSON.parse(init.body)).toEqual({ name: 'Ana', pin: '4821' });
  });

  it('sends the PIN only in the login body, never in a header', async () => {
    await login('Ana', '4821');
    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.stringify(init.headers)).not.toContain('4821');
    expect(JSON.parse(init.body)).toEqual({ name: 'Ana', pin: '4821' });
  });
});
