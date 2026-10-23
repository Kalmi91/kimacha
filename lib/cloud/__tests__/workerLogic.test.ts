import { LOCK_SEC, MAX_FAILS, MAX_PAYLOAD_CHARS, afterBadPin, bearerToken, displayName, lockRemainingSec, parseLogin, parsePayload, safeEqual, toHex } from '../../../cloud/logic';

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
