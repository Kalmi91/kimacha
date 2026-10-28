import { LOCK_SEC, MAX_FAILS, MAX_PAYLOAD_CHARS, adminAuthorized, afterBadPin, bearerToken, displayName, lockRemainingSec, parseLogin, parsePayload, safeEqual, toAdminStats, toHex, usageSummary } from '../../../cloud/logic';
import type { AdminUserRow, UsageSummary } from '../../../cloud/logic';
import { MemoryStore } from '@/lib/database.web';
import { PAYLOAD_VERSION } from '../sync';

describe('parseLogin', () => {
  it('takes a valid name and PIN as typed', () => {
    expect(parseLogin({ name: 'Kálmán ', pin: '0042' })).toEqual({ name: 'Kálmán ', pin: '0042' });
  });

  it.each([
    ['a name that is too short', { name: 'K', pin: '1234' }],
    ['a name that is too long', { name: 'x'.repeat(25), pin: '1234' }],
    ['a PIN of 3 digits', { name: 'Kálmán', pin: '123' }],
    ['a PIN with a letter', { name: 'Kálmán', pin: '12a4' }],
    ['a numeric PIN', { name: 'Kálmán', pin: 1234 }],
    ['a missing name', { pin: '1234' }],
    ['an array', ['Kálmán', '1234']],
    ['null', null],
    ['a string', 'Kálmán'],
  ])('rejects %s', (_label, body) => {
    expect(parseLogin(body)).toBeNull();
  });
});

describe('parsePayload', () => {
  it('accepts a string up to the limit', () => {
    expect(parsePayload({ payload: '{}' })).toEqual({ ok: true, payload: '{}' });
    expect(parsePayload({ payload: 'x'.repeat(MAX_PAYLOAD_CHARS) }).ok).toBe(true);
  });

  it('answers 413 too_large one character past the limit', () => {
    expect(parsePayload({ payload: 'x'.repeat(MAX_PAYLOAD_CHARS + 1) })).toEqual({ ok: false, status: 413, error: 'too_large' });
  });

  it.each([{ payload: 5 }, { payload: null }, {}, null, 'text', []])('answers 400 bad_input for %j', (body) => {
    expect(parsePayload(body)).toEqual({ ok: false, status: 400, error: 'bad_input' });
  });
});

describe('displayName', () => {
  it('trims, collapses inner whitespace and keeps the case', () => {
    expect(displayName('  Kálmán   Fekete ')).toBe('Kálmán Fekete');
  });

  it('composes the accent (NFC)', () => {
    expect(displayName('Kálmán')).toBe('Kálmán');
  });
});

describe('lockRemainingSec', () => {
  it('is 0 when there is no lock or it has run out', () => {
    expect(lockRemainingSec(null, 1000)).toBe(0);
    expect(lockRemainingSec(1000, 1000)).toBe(0);
    expect(lockRemainingSec(500, 1000)).toBe(0);
  });

  it('rounds the rest up to whole seconds', () => {
    expect(lockRemainingSec(2001, 1000)).toBe(2);
    expect(lockRemainingSec(1000 + LOCK_SEC * 1000, 1000)).toBe(LOCK_SEC);
  });
});

describe('afterBadPin', () => {
  it('counts the wrong PINs without a lock until the limit', () => {
    expect(afterBadPin(0, 5000)).toEqual({ failCount: 1, lockedUntil: null });
    expect(afterBadPin(MAX_FAILS - 2, 5000)).toEqual({ failCount: MAX_FAILS - 1, lockedUntil: null });
  });

  it('locks for 15 minutes on the MAX_FAILS-th wrong PIN and restarts the count', () => {
    expect(MAX_FAILS).toBe(5);
    expect(LOCK_SEC).toBe(900);
    expect(afterBadPin(MAX_FAILS - 1, 5000)).toEqual({ failCount: 0, lockedUntil: 5000 + 900_000 });
  });
});

describe('bearerToken', () => {
  it('reads the token of a Bearer header', () => {
    expect(bearerToken('Bearer abc123')).toBe('abc123');
  });

  it.each([null, '', 'Bearer', 'Bearer ', 'Basic abc123', 'bearer abc123', 'Bearer a b'])('gives null for %j', (header) => {
    expect(bearerToken(header)).toBeNull();
  });
});

describe('safeEqual', () => {
  it('is true only for identical strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});

describe('toHex', () => {
  it('writes each byte as two lowercase hex digits', () => {
    expect(toHex(new Uint8Array([0, 15, 16, 255]))).toBe('000f10ff');
    expect(toHex(new Uint8Array([]))).toBe('');
  });
});

describe('adminAuthorized', () => {
  const key = 'k'.repeat(32);

  it('is true for the right key', () => {
    expect(adminAuthorized('Bearer ' + key, key)).toBe(true);
  });

  it.each([
    ['a wrong key', 'Bearer ' + 'x'.repeat(32)],
    ['a missing header', null],
    ['a non-Bearer header', 'Basic ' + key],
  ])('is false for %s', (_label, header) => {
    expect(adminAuthorized(header, key)).toBe(false);
  });

  it.each([
    ['undefined', undefined],
    ['empty', ''],
    ['31 characters', 'k'.repeat(31)],
  ])('is false when the admin key is %s, even if the header matches', (_label, adminKey) => {
    expect(adminAuthorized('Bearer ' + (adminKey ?? ''), adminKey)).toBe(false);
  });
});

const EMPTY_USAGE: UsageSummary = { pair: null, level: null, minutesTotal: 0, minutes7d: 0, activeDays: 0, lastActiveDay: null, xpTotal: 0, streak: 0, longestStreak: 0 };
const TODAY = '2026-10-28';

describe('toAdminStats', () => {
  const row = (over: Partial<AdminUserRow>): AdminUserRow => ({
    display_name: 'Ana',
    updated_at: null,
    payload: null,
    payload_chars: null,
    logins: 0,
    first_login: null,
    last_login: null,
    ...over,
  });

  it('maps a row: ms to ISO dates, the save date as stored', () => {
    const [s] = toAdminStats([
      row({ display_name: 'Kálmán', logins: 3, first_login: 1_000, last_login: 2_000_000_000_000, updated_at: '2026-10-28T10:00:00.000Z', payload_chars: 2048 }),
    ], TODAY);
    expect(s).toEqual({
      name: 'Kálmán',
      logins: 3,
      firstLogin: '1970-01-01T00:00:01.000Z',
      lastLogin: '2033-05-18T03:33:20.000Z',
      lastSave: '2026-10-28T10:00:00.000Z',
      progressKb: 2,
      ...EMPTY_USAGE,
    });
  });

  it('gives null dates for an account that never logged in or saved', () => {
    expect(toAdminStats([row({})], TODAY)[0]).toEqual({ name: 'Ana', logins: 0, firstLogin: null, lastLogin: null, lastSave: null, progressKb: 0, ...EMPTY_USAGE });
  });

  it('rounds the progress to KB, at least 1 for any content', () => {
    const kb = (chars: number | null) => toAdminStats([row({ payload_chars: chars })], TODAY)[0].progressKb;
    expect(kb(null)).toBe(0);
    expect(kb(0)).toBe(0);
    expect(kb(100)).toBe(1);
    expect(kb(2048)).toBe(2);
  });

  it('puts the most recent activity first (login or save), accounts without activity last', () => {
    const t = (iso: string) => Date.parse(iso);
    const names = toAdminStats([
      row({ display_name: 'none' }),
      row({ display_name: 'old', last_login: t('2026-10-01T00:00:00Z') }),
      row({ display_name: 'saveOnly', updated_at: '2026-10-20T00:00:00.000Z' }),
      row({ display_name: 'new', last_login: t('2026-10-25T00:00:00Z'), updated_at: '2026-10-05T00:00:00.000Z' }),
      row({ display_name: 'savedLater', last_login: t('2026-10-02T00:00:00Z'), updated_at: '2026-10-27T00:00:00.000Z' }),
    ], TODAY).map((s) => s.name);
    expect(names).toEqual(['savedLater', 'new', 'saveOnly', 'old', 'none']);
  });
});

describe('usageSummary', () => {
  // A cloud payload (`{ v, store, resume }`) around a hand-written web state; `store` is a string inside the payload.
  const payloadOf = (state: Record<string, unknown>) => JSON.stringify({ v: 1, store: JSON.stringify({ v: 1, ...state }), resume: {} });

  it.each([
    ['null', null],
    ['not JSON', 'not json'],
    ['a payload without a store', JSON.stringify({ v: 1, resume: {} })],
    ['a store that is not JSON', JSON.stringify({ v: 1, store: 'S1', resume: {} })],
    ['a store of the wrong shape', JSON.stringify({ v: 1, store: '[1,2]', resume: {} })],
    ['an empty state', payloadOf({})],
    ['broken fields', payloadOf({ streak: 'x', onboarding: 5, userLevels: 'x', usageMinutes: [1, ['d']], dailyXp: {} })],
  ])('gives the empty summary for %s', (_label, payload) => {
    expect(usageSummary(payload, TODAY)).toEqual(EMPTY_USAGE);
  });

  it('reads what it can from a partial payload', () => {
    const sum = usageSummary(payloadOf({ usageMinutes: [[TODAY, 4]], onboarding: { source: 'en', target: 'es' } }), TODAY);
    expect(sum).toEqual({ ...EMPTY_USAGE, pair: 'en→es', minutesTotal: 4, minutes7d: 4, activeDays: 1, lastActiveDay: TODAY });
  });

  it('takes the level of the onboarding pair, else the first entry', () => {
    const levels = [
      ['es-en', { level: 'A2' }],
      ['en-es', { level: 'B1' }],
    ];
    expect(usageSummary(payloadOf({ onboarding: { source: 'en', target: 'es' }, userLevels: levels }), TODAY).level).toBe('B1');
    expect(usageSummary(payloadOf({ onboarding: { source: 'hu', target: 'es' }, userLevels: levels }), TODAY).level).toBe('A2');
    expect(usageSummary(payloadOf({ userLevels: levels }), TODAY)).toMatchObject({ pair: null, level: 'A2' });
  });

  it('counts minutes, active days and the last active day; the 7 day window has today-6 in and today-7 out', () => {
    const sum = usageSummary(
      payloadOf({
        usageMinutes: [
          ['2026-10-21', 5], // today-7: out of the window
          ['2026-10-22', 3], // today-6: in
          ['2026-10-25', 0], // no minutes: not an active day
          ['2026-10-27', 2],
        ],
      }),
      TODAY,
    );
    expect(sum).toMatchObject({ minutesTotal: 10, minutes7d: 5, activeDays: 3, lastActiveDay: '2026-10-27' });
  });

  it('turns the daily XP tenths into XP', () => {
    expect(usageSummary(payloadOf({ dailyXp: [['2026-10-27', 123], ['2026-10-28', 2]] }), TODAY).xpTotal).toBe(13);
    expect(usageSummary(payloadOf({ dailyXp: [['2026-10-28', 4]] }), TODAY).xpTotal).toBe(0);
  });

  it('keeps a streak that ran yesterday or today, and resets one that has broken', () => {
    const streak = (last_date: string | null) => usageSummary(payloadOf({ streak: { current_count: 3, last_date, longest_count: 7 } }), TODAY);
    expect(streak(TODAY)).toMatchObject({ streak: 3, longestStreak: 7 });
    expect(streak('2026-10-27')).toMatchObject({ streak: 3, longestStreak: 7 });
    expect(streak('2026-10-26')).toMatchObject({ streak: 0, longestStreak: 7 });
  });

  it('reads the real MemoryStore output (a format change breaks this test)', async () => {
    const store = new MemoryStore();
    await store.writeOnboarding('en', 'es');
    store.userLevels.set('en-es', { level: 'B1', correct_streak: 0, mistakes_in_window: 0, fail_streak: 0 });
    await store.writeStreak({ current_count: 3, last_date: '2026-10-27', longest_count: 7 });
    await store.addUsageMinute('2026-10-27');
    await store.addUsageMinute('2026-10-27');
    await store.addUsageMinute('2026-10-28');
    await store.addDailyXpTenths('2026-10-28', 25);
    const payload = JSON.stringify({ v: PAYLOAD_VERSION, store: store.serializeState(), resume: {} });
    expect(usageSummary(payload, TODAY)).toEqual({
      pair: 'en→es',
      level: 'B1',
      minutesTotal: 3,
      minutes7d: 3,
      activeDays: 2,
      lastActiveDay: '2026-10-28',
      xpTotal: 3,
      streak: 3,
      longestStreak: 7,
    });
  });
});
