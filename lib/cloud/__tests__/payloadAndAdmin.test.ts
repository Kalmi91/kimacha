// Hostile and damaged input of the web cloud (cloud/logic.ts): the progress payload, the stored rows behind the admin
// statistics, and the admin key check. The cases marked `it.failing` state the RIGHT behavior that the code does not
// have yet: they pass while the gap exists and go red the day it is fixed, so the `.failing` has to come off then.
import { MAX_PAYLOAD_CHARS, adminAuthorized, parseLogin, parsePayload, toAdminStats, usageSummary } from '../../../cloud/logic';
import type { AdminUserRow } from '../../../cloud/logic';

const TODAY = '2026-10-28';

describe('parsePayload with hostile bodies', () => {
  it('does not read the payload from a __proto__ key', () => {
    expect(parsePayload(JSON.parse('{"__proto__":{"payload":"x"}}'))).toEqual({ ok: false, status: 400, error: 'bad_input' });
  });

  it.each([
    [{ payload: ['x'] }],
    [{ payload: { a: 1 } }],
    [{ payload: true }],
    [{ payload: 1e999 }],
    [{ Payload: 'x' }],
    [[{ payload: 'x' }]],
    [42],
    [undefined],
  ])('answers 400 bad_input for %j', (body) => {
    expect(parsePayload(body)).toEqual({ ok: false, status: 400, error: 'bad_input' });
  });

  it('keeps only the payload field of an accepted body', () => {
    expect(parsePayload({ payload: '{"v":1}', token: 'x', admin: true })).toEqual({ ok: true, payload: '{"v":1}' });
  });

  it('measures the limit in characters of the string', () => {
    expect(parsePayload({ payload: 'é'.repeat(MAX_PAYLOAD_CHARS) }).ok).toBe(true);
    expect(parsePayload({ payload: 'é'.repeat(MAX_PAYLOAD_CHARS + 1) })).toEqual({ ok: false, status: 413, error: 'too_large' });
  });

  // The client restores the saved text with JSON.parse and a shape check; text that is not a JSON object never loads
  // there, and the app does not start (CloudGate shows the error screen, nothing writes a better copy over it).
  it.failing.each([
    ['text that is not JSON', 'not json'],
    ['the empty string', ''],
    ['a JSON array', '[1,2]'],
    ['a JSON string', '"text"'],
    ['a JSON number', '42'],
    ['JSON null', 'null'],
  ])('rejects %s as the progress payload', (_label, payload) => {
    expect(parsePayload({ payload })).toEqual({ ok: false, status: 400, error: 'bad_input' });
  });
});

describe('adminAuthorized edges', () => {
  const key = 'k'.repeat(32);

  it('opens for the exact key at the minimum length and above it', () => {
    expect(adminAuthorized('Bearer ' + key, key)).toBe(true);
    expect(adminAuthorized('Bearer ' + key + 'x', key + 'x')).toBe(true);
  });

  it.each([
    ['the key plus a space', 'Bearer ' + key + ' '],
    ['a longer token with the key as its start', 'Bearer ' + key + 'x'],
    ['a prefix of the key', 'Bearer ' + key.slice(0, 31)],
    ['the key in another case', 'Bearer ' + key.toUpperCase()],
    ['a lowercase scheme', 'bearer ' + key],
    ['the key without the scheme', key],
    ['the key twice', 'Bearer ' + key + key],
    ['an empty header', ''],
  ])('stays closed for %s', (_label, header) => {
    expect(adminAuthorized(header, key)).toBe(false);
  });

  it('stays closed when the stored key is empty, 1 character or 31 characters, even for a matching token', () => {
    for (const short of ['', 'k', 'k'.repeat(31)]) expect(adminAuthorized('Bearer ' + short, short)).toBe(false);
  });

  it('reads every position of the key whether the wrong token differs first or last', () => {
    const spy = jest.spyOn(String.prototype, 'charCodeAt');
    try {
      const reads = (token: string) => {
        spy.mockClear();
        adminAuthorized('Bearer ' + token, key);
        return spy.mock.calls.length;
      };
      expect(reads('x' + key.slice(1))).toBe(reads(key.slice(0, 31) + 'x'));
    } finally {
      spy.mockRestore();
    }
  });
});

describe('toAdminStats with damaged or hostile rows', () => {
  const row = (over: Record<string, unknown>): AdminUserRow =>
    ({ display_name: 'Ana', updated_at: null, payload: null, payload_chars: null, logins: 0, first_login: null, last_login: null, ...over }) as AdminUserRow;
  const payloadWith = (store: string) => JSON.stringify({ v: 1, store, resume: {} });

  it('answers an empty list for no rows', () => {
    expect(toAdminStats([], TODAY)).toEqual([]);
  });

  it('gives exactly the usage fields and leaks no column that is not on the list', () => {
    const secret = 'SECRET-VALUE-9f3a';
    const [stat] = toAdminStats(
      [row({ pin_hash: secret, salt: secret, token: secret, name_key: secret, payload: payloadWith(JSON.stringify({ v: 1, note: secret })), payload_chars: 80 })],
      TODAY,
    );
    expect(Object.keys(stat).sort()).toEqual(
      ['activeDays', 'firstLogin', 'lastActiveDay', 'lastLogin', 'lastSave', 'level', 'logins', 'longestStreak', 'minutes7d', 'minutesTotal', 'name', 'pair', 'progressKb', 'streak', 'xpTotal'].sort(),
    );
    expect(JSON.stringify(stat)).not.toContain(secret);
  });

  it('survives a save date that is not a date, a negative size and a login time of zero', () => {
    const stats = toAdminStats([row({ updated_at: 'not a date', payload_chars: -5, first_login: 0, last_login: 0 })], TODAY);
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ lastSave: 'not a date', progressKb: 0, firstLogin: '1970-01-01T00:00:00.000Z' });
  });

  it('survives payloads that are huge, deeply nested or full of odd types', () => {
    const deep = '['.repeat(200_000) + ']'.repeat(200_000);
    const hostile = [
      deep,
      payloadWith(deep),
      payloadWith('x'.repeat(3_000_000)),
      payloadWith(JSON.stringify({ usageMinutes: [['2026-10-27', 1e308], ['2026-10-26', 1e308], ['x', -1e308]], dailyXp: [['d', 1e308], ['e', 1e308]] })),
      payloadWith(JSON.stringify({ usageMinutes: 'x', dailyXp: [[1, 2], [null, 3], 'y'], streak: { current_count: 'x', last_date: 5, longest_count: null }, userLevels: [[1, 2], ['a']] })),
      payloadWith(JSON.stringify({ onboarding: { source: {}, target: [] }, userLevels: [['en-es', null]] })),
      payloadWith(JSON.stringify(JSON.parse('{"__proto__":{"polluted":1},"usageMinutes":[["2026-10-28",2]]}'))),
      '{"store":5}',
      '"just a string"',
      '',
    ];
    for (const payload of hostile) {
      expect(() => toAdminStats([row({ payload, payload_chars: payload.length })], TODAY)).not.toThrow();
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('keeps every number it reports a number (no NaN) whatever the stored figures are', () => {
    const [s] = toAdminStats(
      [row({ payload: payloadWith(JSON.stringify({ usageMinutes: [['2026-10-28', 1e308], ['2026-10-27', 1e308]], dailyXp: [['d', 1e308], ['e', 1e308]], streak: { current_count: 1e999, longest_count: -3 } })) })],
      TODAY,
    );
    for (const n of [s.minutesTotal, s.minutes7d, s.activeDays, s.xpTotal, s.streak, s.longestStreak]) expect(Number.isNaN(n)).toBe(false);
  });
});

// A small seeded sweep: random JSON-shaped input must never make the parsers or the summaries throw.
describe('seeded random input never throws', () => {
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function value(rand: () => number, depth: number): unknown {
    const r = Math.floor(rand() * (depth > 3 ? 6 : 9));
    switch (r) {
      case 0: return null;
      case 1: return rand() < 0.5;
      case 2: return Math.floor((rand() - 0.5) * 1e6);
      case 3: return rand() < 0.1 ? 1e308 : rand() * 100;
      case 4: return ['', 'a', '2026-10-28', 'en-es', '​', 'x'.repeat(50)][Math.floor(rand() * 6)];
      case 5: return ['__proto__', 'constructor', 'name', 'pin', 'payload', 'store'][Math.floor(rand() * 6)];
      case 6: return Array.from({ length: Math.floor(rand() * 4) }, () => value(rand, depth + 1));
      default: {
        const o: Record<string, unknown> = {};
        for (let i = Math.floor(rand() * 4); i > 0; i--) {
          const key = ['__proto__', 'constructor', 'name', 'pin', 'payload', 'store', 'usageMinutes', 'streak', 'a'][Math.floor(rand() * 9)];
          Object.defineProperty(o, key, { value: value(rand, depth + 1), enumerable: true, configurable: true, writable: true });
        }
        return o;
      }
    }
  }

  it('over 400 random bodies and 400 random stored payloads', () => {
    const rand = rng(20261101);
    for (let i = 0; i < 400; i++) {
      const body = value(rand, 0);
      expect(() => parseLogin(body)).not.toThrow();
      expect(() => parsePayload(body)).not.toThrow();
      const store = JSON.stringify(value(rand, 0));
      const payload = rand() < 0.5 ? JSON.stringify({ v: 1, store, resume: {} }) : store;
      expect(() => usageSummary(payload, TODAY)).not.toThrow();
      expect(() => toAdminStats([{ display_name: 'x', updated_at: null, payload, payload_chars: payload.length, logins: 1, first_login: 1, last_login: 2 }], TODAY)).not.toThrow();
    }
  });
});
