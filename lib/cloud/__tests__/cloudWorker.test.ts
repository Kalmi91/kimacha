// The web cloud API as a whole: cloud/worker.ts's Durable Object run for real under jest, with the lock, the tokens, the admin
// route and the progress route, and two devices syncing through lib/cloud/sync.ts against it.
// Two stand-ins, both below: 'cloudflare:workers' is a bare base class, and the SQLite storage is an in-memory emulation of
// exactly the statements worker.ts runs (any other statement throws, so a changed query shows up here instead of passing
// silently). Not covered: real SQLite or workerd behavior. The cases marked `it.failing` state the RIGHT behavior that the
// code does not have yet: they pass while the gap exists and go red the day it is fixed, so the `.failing` has to come off then.
import { createHash } from 'crypto';
import { SESSION_KEY } from '../session';
import { LOCK_SEC, MAX_FAILS, MAX_NAME_FAILS, MAX_PAYLOAD_CHARS, usageSummary } from '../../../cloud/logic';

jest.mock(
  'cloudflare:workers',
  () => ({
    DurableObject: class {
      ctx: unknown;
      env: unknown;
      constructor(ctx: unknown, env: unknown) {
        this.ctx = ctx;
        this.env = env;
      }
    },
  }),
  { virtual: true },
);

type Row = Record<string, any>;

// `legacy`: the storage of the version before the revisions: a users table without the rev column, and one account (name Old,
// PIN 1234) whose progress was saved then.
const OLD_COLUMNS = ['name_key', 'display_name', 'salt', 'pin_hash', 'payload', 'updated_at', 'fail_count', 'locked_until'];
const LEGACY_PAYLOAD = '{"v":1,"store":"old","resume":{}}';
const LEGACY_SALT = 'a'.repeat(32);

function makeSql(legacy = false) {
  const users = new Map<string, Row>();
  const tokens = new Map<string, Row>();
  const fails = new Map<string, Row>();
  let columns: Set<string> | null = null;
  if (legacy) {
    columns = new Set(OLD_COLUMNS);
    const pin_hash = createHash('sha256')
      .update(LEGACY_SALT + '1234')
      .digest('hex');
    users.set('old', { name_key: 'old', display_name: 'Old', salt: LEGACY_SALT, pin_hash, payload: LEGACY_PAYLOAD, updated_at: '2026-10-01T00:00:00.000Z', fail_count: 0, locked_until: null });
  }
  const cursor = (rows: Row[]) => ({ toArray: () => rows });
  const exec = (query: string, ...b: any[]) => {
    const q = query.replace(/\s+/g, ' ').trim().toLowerCase();
    if (q.startsWith('create table if not exists users')) {
      columns ??= new Set(OLD_COLUMNS);
      return cursor([]);
    }
    if (q.startsWith('create table')) return cursor([]);
    if (q === 'pragma table_info(users)') return cursor([...(columns ?? [])].map((name) => ({ name })));
    if (q === 'alter table users add column rev integer not null default 0') {
      if (!columns || columns.has('rev')) throw new Error('duplicate column name: rev');
      columns.add('rev');
      for (const u of users.values()) u.rev = 0;
      return cursor([]);
    }
    if (q === 'alter table users add column fail_since integer') {
      if (!columns || columns.has('fail_since')) throw new Error('duplicate column name: fail_since');
      columns.add('fail_since');
      for (const u of users.values()) u.fail_since = null;
      return cursor([]);
    }
    if (q === 'select * from users where name_key = ?') return cursor(users.has(b[0]) ? [{ ...users.get(b[0]) }] : []);
    if (q === 'insert into users (name_key, display_name, salt, pin_hash) values (?, ?, ?, ?)') {
      if (users.has(b[0])) throw new Error('UNIQUE constraint failed: users.name_key');
      users.set(b[0], { name_key: b[0], display_name: b[1], salt: b[2], pin_hash: b[3], payload: null, updated_at: null, fail_count: 0, locked_until: null, rev: 0, fail_since: null });
      return cursor([]);
    }
    if (q === 'insert into tokens (token, name_key, created_at) values (?, ?, ?)') {
      if (tokens.has(b[0])) throw new Error('UNIQUE constraint failed: tokens.token');
      tokens.set(b[0], { token: b[0], name_key: b[1], created_at: b[2] });
      return cursor([]);
    }
    if (q === 'update users set fail_count = ?, locked_until = ?, fail_since = ? where name_key = ?') {
      Object.assign(users.get(b[3]) ?? {}, { fail_count: b[0], locked_until: b[1], fail_since: b[2] });
      return cursor([]);
    }
    if (q === 'update users set fail_count = 0, locked_until = null where name_key = ?') {
      Object.assign(users.get(b[0]) ?? {}, { fail_count: 0, locked_until: null });
      return cursor([]);
    }
    if (q === 'select name_key from tokens where token = ?') return cursor(tokens.has(b[0]) ? [{ name_key: tokens.get(b[0])!.name_key }] : []);
    if (q === 'select fail_count, locked_until from login_fails where name_key = ? and ip = ?') {
      const f = fails.get(b[0] + '|' + b[1]);
      return cursor(f ? [{ fail_count: f.fail_count, locked_until: f.locked_until }] : []);
    }
    if (q === 'insert or replace into login_fails (name_key, ip, fail_count, locked_until) values (?, ?, ?, ?)') {
      fails.set(b[0] + '|' + b[1], { fail_count: b[2], locked_until: b[3] });
      return cursor([]);
    }
    if (q === 'delete from login_fails where name_key = ? and ip = ?') {
      fails.delete(b[0] + '|' + b[1]);
      return cursor([]);
    }
    if (q === 'select payload, updated_at, rev from users where name_key = ?') {
      const u = users.get(b[0]);
      return cursor(u ? [{ payload: u.payload, updated_at: u.updated_at, rev: u.rev }] : []);
    }
    if (q === 'update users set payload = ?, updated_at = ?, rev = ? where name_key = ?') {
      Object.assign(users.get(b[3]) ?? {}, { payload: b[0], updated_at: b[1], rev: b[2] });
      return cursor([]);
    }
    if (q === 'delete from tokens where token = ?') {
      tokens.delete(b[0]);
      return cursor([]);
    }
    if (q.startsWith('select u.display_name') && q.includes('group by u.name_key')) {
      return cursor(
        [...users.values()].map((u) => {
          const own = [...tokens.values()].filter((t) => t.name_key === u.name_key).map((t) => t.created_at as number);
          return {
            display_name: u.display_name,
            updated_at: u.updated_at,
            payload: u.payload,
            payload_chars: u.payload === null ? null : (u.payload as string).length,
            logins: own.length,
            first_login: own.length ? Math.min(...own) : null,
            last_login: own.length ? Math.max(...own) : null,
          };
        }),
      );
    }
    throw new Error('fake sql: unsupported statement: ' + q.slice(0, 80));
  };
  return { exec, users, tokens, fails, columns: () => columns };
}

type Reply = { status: number; body: any; text: string };
// `ip`: the address Cloudflare would put in CF-Connecting-IP (none: the header is missing).
type CallOptions = { token?: string; header?: string; body?: unknown; raw?: string; ip?: string };

function startCloud(env: { ADMIN_KEY?: string } = {}, legacy = false) {
  const sql = makeSql(legacy);
  const { KimachaUsers } = jest.requireActual<{ KimachaUsers: new (ctx: unknown, env: unknown) => { fetch(req: Request): Promise<Response> } }>('../../../cloud/worker');
  const obj = new KimachaUsers({ storage: { sql } }, env);
  const call = async (method: string, path: string, o: CallOptions = {}): Promise<Reply> => {
    const headers: Record<string, string> = {};
    if (o.token !== undefined) headers.Authorization = 'Bearer ' + o.token;
    if (o.header !== undefined) headers.Authorization = o.header;
    if (o.ip !== undefined) headers['CF-Connecting-IP'] = o.ip;
    const raw = o.raw ?? (o.body === undefined ? undefined : JSON.stringify(o.body));
    const res = await obj.fetch(new Request('https://cloud.test' + path, { method, headers, body: raw }));
    const text = await res.text();
    let body: any = null;
    try {
      body = JSON.parse(text);
    } catch {
      // a reply that is not JSON stays null; the status and the text are still checked
    }
    return { status: res.status, body, text };
  };
  return {
    sql,
    call,
    // A second start of the Durable Object on the same storage (the constructor runs the table setup and the migration again).
    restart: () => new KimachaUsers({ storage: { sql } }, env),
    login: (name: string, pin: string, o: CallOptions = {}) => call('POST', '/api/login', { ...o, body: { name, pin } }),
    get: (token: string) => call('GET', '/api/progress', { token }),
    put: (token: string, payload: string, rev?: number) => call('PUT', '/api/progress', { token, body: rev === undefined ? { payload } : { payload, rev } }),
  };
}
type Cloud = ReturnType<typeof startCloud>;

const START = 1_700_000_000_000;
let clock = START;

beforeEach(() => {
  clock = START;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// `batches` addresses (`prefix.0` ...) each guess MAX_FAILS wrong PINs for Ana, the clock moving on by `gapMs` after each address.
async function guessFromAddresses(cloud: Cloud, prefix: string, batches: number, gapMs = 0) {
  for (let a = 0; a < batches; a++) {
    for (let i = 0; i < MAX_FAILS; i++) expect((await cloud.login('Ana', '0000', { ip: `${prefix}.${a}` })).status).toBe(401);
    clock += gapMs;
  }
}

describe('login and the lock', () => {
  it('creates the account on the first login, and the same name in any case or spacing gets back into it', async () => {
    const cloud = startCloud();
    const first = await cloud.login('Ana', '1234');
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ created: true, displayName: 'Ana', payload: null });
    expect(first.body.token).toMatch(/^[0-9a-f]{64}$/);
    const again = await cloud.login('  ANA ', '1234');
    expect(again.body).toMatchObject({ created: false, displayName: 'Ana' });
    expect(again.body.token).not.toBe(first.body.token);
    expect(cloud.sql.users.size).toBe(1);
  });

  it('answers 401 bad_pin for a wrong PIN, and locks on the MAX_FAILS-th: 429 locked with the whole lock time', async () => {
    const cloud = startCloud();
    await cloud.login('Ana', '1234');
    for (let i = 0; i < MAX_FAILS; i++) {
      const bad = await cloud.login('Ana', '0000');
      expect(bad.status).toBe(401);
      expect(bad.body).toEqual({ error: 'bad_pin' });
    }
    const locked = await cloud.login('Ana', '0000');
    expect(locked.status).toBe(429);
    expect(locked.body).toEqual({ error: 'locked', retryAfterSec: LOCK_SEC });
  });

  it('refuses even the right PIN from the locked address and issues no token for it, but lets the owner in from another address', async () => {
    const cloud = startCloud();
    await cloud.login('Ana', '1234', { ip: '10.0.0.1' });
    for (let i = 0; i < MAX_FAILS; i++) await cloud.login('Ana', '0000', { ip: '6.6.6.6' }); // a stranger who knows only the name
    const tokensBefore = cloud.sql.tokens.size;
    const right = await cloud.login('Ana', '1234', { ip: '6.6.6.6' });
    expect(right.status).toBe(429);
    expect(right.body.token).toBeUndefined();
    expect(cloud.sql.tokens.size).toBe(tokensBefore);
    const owner = await cloud.login('Ana', '1234', { ip: '10.0.0.1' });
    expect(owner.status).toBe(200);
    expect(owner.body.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('counts the requests without an address as one address', async () => {
    const cloud = startCloud();
    await cloud.login('Ana', '1234');
    for (let i = 0; i < MAX_FAILS; i++) await cloud.login('Ana', '0000');
    const right = await cloud.login('Ana', '1234');
    expect(right.status).toBe(429);
    expect(right.body.token).toBeUndefined();
  });

  it('locks the whole name only at MAX_NAME_FAILS wrong PINs from many addresses, and a device with a token of the account still gets in', async () => {
    const cloud = startCloud();
    const ownerToken = (await cloud.login('Ana', '1234', { ip: '10.0.0.1' })).body.token as string;
    const wrongFrom = async (n: number, from: number) => {
      for (let a = 0; a < n / MAX_FAILS; a++) for (let i = 0; i < MAX_FAILS; i++) expect((await cloud.login('Ana', '0000', { ip: `7.7.${from + a}.1` })).status).toBe(401);
    };
    await wrongFrom(MAX_NAME_FAILS - MAX_FAILS, 0);
    expect((await cloud.login('Ana', '1234', { ip: '10.0.0.2' })).status).toBe(200); // one wrong PIN short of the name lock, a new address is fine
    await wrongFrom(MAX_NAME_FAILS, 100); // the count was zeroed by that login: MAX_NAME_FAILS more lock the name
    const fresh = await cloud.login('Ana', '1234', { ip: '10.0.0.3' });
    expect(fresh.status).toBe(429);
    expect(fresh.body.retryAfterSec).toBe(LOCK_SEC);
    const holder = await cloud.login('Ana', '1234', { ip: '10.0.0.3', token: ownerToken });
    expect(holder.status).toBe(200);
    expect((await cloud.login('Ana', '1234', { ip: '10.0.0.4' })).status).toBe(200); // the good login of the holder lifted the name lock
  });

  it('does not count the wrong PINs of a device that holds a token of the account', async () => {
    const cloud = startCloud();
    const token = (await cloud.login('Ana', '1234', { ip: '10.0.0.1' })).body.token as string;
    for (let i = 0; i < 2 * MAX_FAILS; i++) expect((await cloud.login('Ana', '0000', { ip: '10.0.0.1', token })).status).toBe(401);
    expect((await cloud.login('Ana', '1234', { ip: '10.0.0.1' })).status).toBe(200);
    expect(cloud.sql.users.get('ana')?.fail_count).toBe(0);
  });

  it('counts the name-wide wrong PINs inside one window only: 45 now and 45 a window later do not lock the name', async () => {
    const cloud = startCloud();
    await cloud.login('Ana', '1234', { ip: '10.0.0.1' });
    await guessFromAddresses(cloud, '7.1', 9);
    clock = START + LOCK_SEC * 1000;
    await guessFromAddresses(cloud, '7.2', 9);
    expect((await cloud.login('Ana', '1234', { ip: '10.0.0.2' })).status).toBe(200);
  });

  it('does not lock the name for a guesser who spreads 60 wrong PINs over an hour, whatever the gaps', async () => {
    const cloud = startCloud();
    await cloud.login('Ana', '1234', { ip: '10.0.0.1' });
    await guessFromAddresses(cloud, '7.3', 12, 5 * 60 * 1000);
    expect((await cloud.login('Ana', '1234', { ip: '10.0.0.2' })).status).toBe(200);
  });

  it('does not lock the name for one address that guesses again every time its own lock has run out', async () => {
    const cloud = startCloud();
    await cloud.login('Ana', '1234', { ip: '10.0.0.1' });
    for (let window = 0; window < 12; window++) {
      for (let i = 0; i < MAX_FAILS; i++) expect((await cloud.login('Ana', '0000', { ip: '7.4.0.1' })).status).toBe(401);
      expect((await cloud.login('Ana', '0000', { ip: '7.4.0.1' })).status).toBe(429);
      clock += LOCK_SEC * 1000;
    }
    expect((await cloud.login('Ana', '1234', { ip: '10.0.0.2' })).status).toBe(200);
  });

  it('lets a name-locked owner in through the client: login() sends the token of the stored session', async () => {
    const cloud = startCloud();
    const ownerToken = (await cloud.login('Ana', '1234', { ip: '10.0.0.1' })).body.token as string;
    const beaToken = (await cloud.login('Bea', '5678', { ip: '10.0.0.5' })).body.token as string;
    await guessFromAddresses(cloud, '7.5', MAX_NAME_FAILS / MAX_FAILS);
    expect((await cloud.login('Ana', '1234', { ip: '10.0.0.3' })).status).toBe(429); // the whole name is locked
    const { login: clientLogin } = jest.requireActual<typeof import('../api')>('../api');
    const realFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
      const r = await cloud.call(init.method, url, { header: init.headers.Authorization, raw: init.body, ip: '10.0.0.3' });
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
    };
    const stored = (token: string) =>
      Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => (k === SESSION_KEY ? JSON.stringify({ name: 'Ana', token }) : null) }, configurable: true, writable: true });
    try {
      expect(await clientLogin('Ana', '1234')).toMatchObject({ ok: false, error: 'locked' }); // no stored session
      stored(beaToken);
      expect(await clientLogin('Ana', '1234')).toMatchObject({ ok: false, error: 'locked' }); // the token of another account
      stored(ownerToken);
      const res = await clientLogin('Ana', '1234');
      expect(res).toMatchObject({ ok: true, data: { created: false, displayName: 'Ana' } });
      expect((res as any).data.token).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      (globalThis as any).fetch = realFetch;
      delete (globalThis as any).localStorage;
    }
  });

  it('does not let the token of another account past the lock', async () => {
    const cloud = startCloud();
    await cloud.login('Ana', '1234', { ip: '10.0.0.1' });
    const bea = (await cloud.login('Bea', '5678', { ip: '10.0.0.2' })).body.token as string;
    for (let i = 0; i < MAX_FAILS; i++) await cloud.login('Ana', '0000', { ip: '6.6.6.6' });
    expect((await cloud.login('Ana', '1234', { ip: '6.6.6.6', token: bea })).status).toBe(429);
  });

  it('lets the right PIN in at the very end of the lock, and not one second before', async () => {
    const cloud = startCloud();
    await cloud.login('Ana', '1234');
    for (let i = 0; i < MAX_FAILS; i++) await cloud.login('Ana', '0000');
    clock = START + LOCK_SEC * 1000 - 1000;
    expect((await cloud.login('Ana', '1234')).body).toEqual({ error: 'locked', retryAfterSec: 1 });
    clock = START + LOCK_SEC * 1000;
    const ok = await cloud.login('Ana', '1234');
    expect(ok.status).toBe(200);
    expect(ok.body.created).toBe(false);
  });

  it('starts the count again after the lock: it takes MAX_FAILS wrong PINs in the new round to lock again', async () => {
    const cloud = startCloud();
    await cloud.login('Ana', '1234');
    for (let i = 0; i < MAX_FAILS; i++) await cloud.login('Ana', '0000');
    clock = START + LOCK_SEC * 1000;
    for (let i = 0; i < MAX_FAILS; i++) expect((await cloud.login('Ana', '0000')).status).toBe(401);
    expect((await cloud.login('Ana', '0000')).status).toBe(429);
  });

  it('zeroes the count on a good login: the wrong PINs before it do not add up with the ones after it', async () => {
    const cloud = startCloud();
    await cloud.login('Ana', '1234');
    for (let i = 0; i < MAX_FAILS - 1; i++) await cloud.login('Ana', '0000');
    expect((await cloud.login('Ana', '1234')).status).toBe(200);
    for (let i = 0; i < MAX_FAILS - 1; i++) expect((await cloud.login('Ana', '0000')).status).toBe(401);
    expect((await cloud.login('Ana', '1234')).status).toBe(200);
  });

  it('trips the lock for a burst of parallel guesses: exactly MAX_FAILS are judged, the rest are refused', async () => {
    const cloud = startCloud();
    await cloud.login('Ana', '1234');
    const burst = await Promise.all(Array.from({ length: 12 }, () => cloud.login('Ana', '0000')));
    expect(burst.filter((r) => r.status === 401)).toHaveLength(MAX_FAILS);
    expect(burst.filter((r) => r.status === 429)).toHaveLength(12 - MAX_FAILS);
  });

  it('locks one name only: another account stays usable', async () => {
    const cloud = startCloud();
    await cloud.login('Ana', '1234');
    await cloud.login('Bea', '5678');
    for (let i = 0; i < MAX_FAILS; i++) await cloud.login('Ana', '0000');
    expect((await cloud.login('Bea', '5678')).status).toBe(200);
  });

  it('stores a salted hash, never the PIN: the same PIN gives two accounts two different hashes', async () => {
    const cloud = startCloud();
    await cloud.login('Ana', '4821');
    await cloud.login('Bea', '4821');
    const [a, b] = [...cloud.sql.users.values()];
    for (const u of [a, b]) {
      expect(u.pin_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(u.salt).toMatch(/^[0-9a-f]{32}$/);
      expect(u.pin_hash).not.toBe('4821');
    }
    expect(a.salt).not.toBe(b.salt);
    expect(a.pin_hash).not.toBe(b.pin_hash);
  });

  it.each([
    ['text that is not JSON', { raw: 'not json' }],
    ['an empty body', { raw: '' }],
    ['an empty object', { body: {} }],
    ['an array', { body: ['Ana', '1234'] }],
    ['a name that is too long', { body: { name: 'x'.repeat(40), pin: '1234' } }],
    ['a PIN of letters', { body: { name: 'Ana', pin: 'abcd' } }],
  ])('answers 400 bad_input for %s, never a server error, and creates no account', async (_label, o) => {
    const cloud = startCloud();
    const r = await cloud.call('POST', '/api/login', o);
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: 'bad_input' });
    expect(cloud.sql.users.size).toBe(0);
  });
});

describe('tokens', () => {
  it('revokes only the token that logs out', async () => {
    const cloud = startCloud();
    const t1 = (await cloud.login('Ana', '1234')).body.token;
    const t2 = (await cloud.login('Ana', '1234')).body.token;
    expect((await cloud.call('POST', '/api/logout', { token: t1 })).status).toBe(200);
    expect((await cloud.get(t1)).body).toEqual({ error: 'bad_token' });
    expect((await cloud.get(t2)).status).toBe(200);
    expect((await cloud.call('POST', '/api/logout', { token: t1 })).status).toBe(401);
  });

  it.each([
    ['no header', {}],
    ['an unknown token', { token: 'f'.repeat(64) }],
    ['a lowercase scheme', { header: 'bearer ' }],
    ['the token in the query string', { path: '/api/progress?token=' }],
    ['the token as a cookie-like header', { header: 'Cookie token=' }],
  ] as const)('answers 401 bad_token for %s', async (_label, o) => {
    const cloud = startCloud();
    const token = (await cloud.login('Ana', '1234')).body.token as string;
    const path = 'path' in o ? o.path + token : '/api/progress';
    const header = 'header' in o ? o.header + token : undefined;
    const r = await cloud.call('GET', path, { token: 'token' in o ? o.token : undefined, header });
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: 'bad_token' });
  });

  it('never lets one account read or write another account\'s progress', async () => {
    const cloud = startCloud();
    const a = (await cloud.login('Ana', '1234')).body.token as string;
    const b = (await cloud.login('Bea', '5678')).body.token as string;
    await cloud.put(a, '{"mine":"Ana"}');
    expect((await cloud.get(b)).body.payload).toBeNull();
    await cloud.put(b, '{"mine":"Bea"}');
    expect((await cloud.get(a)).body.payload).toBe('{"mine":"Ana"}');
  });
});

describe('the progress route', () => {
  it('keeps the old progress when an upload is refused (too large, wrong shape, no token)', async () => {
    const cloud = startCloud();
    const token = (await cloud.login('Ana', '1234')).body.token as string;
    expect((await cloud.put(token, '{"keep":1}')).status).toBe(200);
    const tooLarge = await cloud.put(token, 'x'.repeat(MAX_PAYLOAD_CHARS + 1));
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.body).toEqual({ error: 'too_large' });
    for (const o of [{ raw: 'not json' }, { raw: 'null' }, { body: ['x'] }, { body: { payload: 5 } }]) {
      const r = await cloud.call('PUT', '/api/progress', { token, ...o });
      expect(r.status).toBe(400);
      expect(r.body).toEqual({ error: 'bad_input' });
    }
    const noToken = await cloud.call('PUT', '/api/progress', { body: { payload: '{"hijack":1}' } });
    expect(noToken.status).toBe(401);
    expect((await cloud.get(token)).body.payload).toBe('{"keep":1}');
  });

  it('accepts a payload of exactly the limit and gives it back whole', async () => {
    const cloud = startCloud();
    const token = (await cloud.login('Ana', '1234')).body.token as string;
    const payload = 'é'.repeat(MAX_PAYLOAD_CHARS);
    expect((await cloud.put(token, payload)).status).toBe(200);
    expect((await cloud.get(token)).body.payload).toBe(payload);
  });

  it('counts the saves: rev 0 for a new account, plus one per save, told by the login and by GET', async () => {
    const cloud = startCloud();
    const first = await cloud.login('Ana', '1234');
    expect(first.body.rev).toBe(0);
    const token = first.body.token as string;
    expect((await cloud.get(token)).body).toMatchObject({ payload: null, rev: 0 });
    expect((await cloud.put(token, '{"a":1}', 0)).body).toMatchObject({ rev: 1 });
    expect((await cloud.put(token, '{"a":2}', 1)).body).toMatchObject({ rev: 2 });
    expect((await cloud.get(token)).body).toMatchObject({ payload: '{"a":2}', rev: 2 });
    expect((await cloud.login('Ana', '1234')).body).toMatchObject({ payload: '{"a":2}', rev: 2 });
  });

  it('refuses a save based on an older revision with 409 and the current state, and writes nothing', async () => {
    const cloud = startCloud();
    const a = (await cloud.login('Ana', '1234')).body.token as string;
    const b = (await cloud.login('Ana', '1234')).body.token as string;
    await cloud.put(a, '{"from":"A"}', 0);
    const stale = await cloud.put(b, '{"from":"B"}', 0);
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ error: 'conflict', payload: '{"from":"A"}', rev: 1 });
    expect(stale.body.updatedAt).toEqual(expect.any(String));
    expect((await cloud.get(a)).body).toMatchObject({ payload: '{"from":"A"}', rev: 1 });
    expect((await cloud.put(b, '{"from":"B"}', 1)).status).toBe(200);
  });

  it('refuses a save from the future as well: the revision has to be the current one', async () => {
    const cloud = startCloud();
    const token = (await cloud.login('Ana', '1234')).body.token as string;
    expect((await cloud.put(token, '{}', 5)).status).toBe(409);
    expect((await cloud.get(token)).body.payload).toBeNull();
  });

  it('still writes a save without a revision (an old client), and counts it', async () => {
    const cloud = startCloud();
    const token = (await cloud.login('Ana', '1234')).body.token as string;
    await cloud.put(token, '{"a":1}', 0);
    expect((await cloud.put(token, '{"old":true}')).body).toMatchObject({ rev: 2 });
    expect((await cloud.get(token)).body).toMatchObject({ payload: '{"old":true}', rev: 2 });
  });

  it.each([-1, 1.5, '1', null, true, [1]])('answers 400 bad_input for the revision %j and keeps the progress', async (rev) => {
    const cloud = startCloud();
    const token = (await cloud.login('Ana', '1234')).body.token as string;
    const r = await cloud.call('PUT', '/api/progress', { token, body: { payload: '{"x":1}', rev } });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: 'bad_input' });
    expect((await cloud.get(token)).body.payload).toBeNull();
  });

  it('adds the rev column to the storage of the older version once, and keeps the saved progress', async () => {
    const cloud = startCloud({}, true);
    expect(cloud.sql.columns()?.has('rev')).toBe(true);
    expect(cloud.sql.columns()?.has('fail_since')).toBe(true);
    expect(() => cloud.restart()).not.toThrow(); // the fake storage throws on a second ALTER, like SQLite
    const login = await cloud.login('Old', '1234');
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ created: false, payload: LEGACY_PAYLOAD, updatedAt: '2026-10-01T00:00:00.000Z', rev: 0 });
    const token = login.body.token as string;
    expect((await cloud.get(token)).body).toMatchObject({ payload: LEGACY_PAYLOAD, rev: 0 });
    expect((await cloud.put(token, '{"v":1,"store":"new","resume":{}}', 0)).body).toMatchObject({ rev: 1 });
  });

  it('answers 404 for an unknown route and 405 for a wrong method, never a server error', async () => {
    const cloud = startCloud();
    const token = (await cloud.login('Ana', '1234')).body.token as string;
    expect((await cloud.call('GET', '/api/nothing', { token })).status).toBe(404);
    expect((await cloud.call('DELETE', '/api/progress', { token })).status).toBe(405);
    expect((await cloud.call('GET', '/api/login')).status).toBe(405);
    expect((await cloud.call('GET', '/api/logout', { token })).status).toBe(405);
  });

  it.failing('does not parse the body of a request that has no valid token', async () => {
    const cloud = startCloud();
    const json = jest.spyOn(Request.prototype, 'json');
    await cloud.call('PUT', '/api/progress', { body: { payload: '{}' } });
    await cloud.call('PUT', '/api/progress', { token: 'f'.repeat(64), body: { payload: '{}' } });
    expect(json).not.toHaveBeenCalled();
  });
});

describe('the admin route', () => {
  const KEY = 'k'.repeat(32);
  const seed = async (cloud: Cloud) => {
    const token = (await cloud.login('Ana', '4821')).body.token as string;
    await cloud.put(token, JSON.stringify({ v: 1, store: JSON.stringify({ v: 1, note: 'PRIVATE-NOTE-77' }), resume: {} }));
    return token;
  };

  it('is closed without an ADMIN_KEY at all, whatever the request sends', async () => {
    const cloud = startCloud();
    await seed(cloud);
    for (const o of [{}, { token: '' }, { token: KEY }, { header: 'Bearer ' + 'x'.repeat(40) }]) {
      const r = await cloud.call('GET', '/api/admin/stats', o);
      expect(r.status).toBe(401);
      expect(r.body).toEqual({ error: 'bad_token' });
      expect(r.text).not.toContain('Ana');
    }
  });

  it('is closed for a missing, wrong or too short key, and for another account\'s token', async () => {
    const cloud = startCloud({ ADMIN_KEY: KEY });
    const userToken = await seed(cloud);
    for (const o of [{}, { token: 'x'.repeat(32) }, { token: KEY + 'x' }, { token: KEY.slice(1) }, { token: userToken }, { header: KEY }]) {
      const r = await cloud.call('GET', '/api/admin/stats', o);
      expect(r.status).toBe(401);
      expect(r.text).not.toContain('Ana');
    }
    const short = startCloud({ ADMIN_KEY: 'k'.repeat(31) });
    await seed(short);
    expect((await short.call('GET', '/api/admin/stats', { token: 'k'.repeat(31) })).status).toBe(401);
  });

  it('shows the right key the accounts, and no PIN hash, salt, token or progress content', async () => {
    const cloud = startCloud({ ADMIN_KEY: KEY });
    const userToken = await seed(cloud);
    const user = [...cloud.sql.users.values()][0];
    const r = await cloud.call('GET', '/api/admin/stats', { token: KEY });
    expect(r.status).toBe(200);
    expect(r.body.users).toHaveLength(1);
    expect(r.body.users[0]).toMatchObject({ name: 'Ana', logins: 1 });
    for (const secret of [user.pin_hash, user.salt, userToken, user.name_key, 'PRIVATE-NOTE-77', '"payload"', 'pin_hash']) expect(r.text).not.toContain(secret);
  });

  it('answers 405 to any method but GET, without data', async () => {
    const cloud = startCloud({ ADMIN_KEY: KEY });
    await seed(cloud);
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const r = await cloud.call(method, '/api/admin/stats', { token: KEY, body: {} });
      expect(r.status).toBe(405);
      expect(r.text).not.toContain('Ana');
    }
  });
});

describe('two devices on one account', () => {
  // Each device is its own copy of lib/cloud/sync.ts and of the web store (jest.isolateModules), both talking to the same
  // Durable Object. A sign-in is what CloudGate.enter does: restore the saved progress, take the baseline, start the sync.
  const DAY = (n: number) => new Date(`2026-10-${20 + n}T12:00:00`);
  type Device = { sync: typeof import('../sync'); db: { getDb(): { addUsageMinute(): Promise<number> } } };
  const pending: Promise<unknown>[] = [];

  function makeDevice(cloud: Cloud): Device {
    let dev!: Device;
    jest.isolateModules(() => {
      jest.doMock('../api', () => ({
        putProgress: (token: string, payload: string, _keepalive: boolean, rev?: number) => {
          const p = cloud
            .put(token, payload, rev)
            .then((r) => (r.status === 200 ? { ok: true, data: r.body } : { ok: false, error: r.body?.error ?? 'server', current: r.status === 409 ? r.body : undefined }));
          pending.push(p);
          return p;
        },
        getProgress: (token: string) => cloud.get(token).then((r) => (r.status === 200 ? { ok: true, data: r.body } : { ok: false, error: r.body?.error ?? 'server' })),
      }));
      dev = { sync: jest.requireActual('../sync'), db: jest.requireActual('@/lib/database.web') };
    });
    return dev;
  }

  async function signIn(dev: Device, cloud: Cloud, name: string) {
    const res = (await cloud.login(name, '1234')).body;
    await dev.sync.restoreFromCloud(res.payload);
    return dev.sync.startSync(res.token, await dev.sync.snapshotKey(), () => {}, res.rev);
  }

  // One sync round of every running device, then wait for the uploads to land.
  async function tick() {
    const turn = () => new Promise((r) => setImmediate(r));
    for (let i = 0; i < 3; i++) {
      jest.advanceTimersByTime(i === 0 ? 5000 : 0);
      for (let k = 0; k < 8; k++) await turn();
      await Promise.all(pending.splice(0));
    }
  }

  async function daysSeenBy(dev: Device) {
    return usageSummary(await dev.sync.exportCloudPayload(), '2026-10-30').activeDays;
  }

  beforeEach(() => {
    jest.useFakeTimers({
      now: DAY(0),
      doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout'],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    pending.length = 0;
  });

  it('gives a device that signs in later what an earlier device saved', async () => {
    const cloud = startCloud();
    const a = makeDevice(cloud);
    const stopA = await signIn(a, cloud, 'Ana');
    await a.db.getDb().addUsageMinute();
    await tick();
    const b = makeDevice(cloud);
    const stopB = await signIn(b, cloud, 'Ana');
    expect(await daysSeenBy(b)).toBe(1);
    stopA();
    stopB();
  });

  it('does not let a device that only sits idle overwrite what the other one saved', async () => {
    const cloud = startCloud();
    const a = makeDevice(cloud);
    const b = makeDevice(cloud);
    const stopA = await signIn(a, cloud, 'Ana');
    const stopB = await signIn(b, cloud, 'Ana');
    await a.db.getDb().addUsageMinute();
    await tick();
    await tick();
    await tick();
    const c = makeDevice(cloud);
    const stopC = await signIn(c, cloud, 'Ana');
    expect(await daysSeenBy(c)).toBe(1);
    [stopA, stopB, stopC].forEach((stop) => stop());
  });

  it('keeps what both devices saved when each of them learned something the other has not seen', async () => {
    const cloud = startCloud();
    const a = makeDevice(cloud);
    const stopA = await signIn(a, cloud, 'Ana');
    await a.db.getDb().addUsageMinute(); // day 1 on device A
    await tick();
    const b = makeDevice(cloud);
    const stopB = await signIn(b, cloud, 'Ana'); // B starts from day 1 and stays open
    jest.setSystemTime(DAY(1));
    await a.db.getDb().addUsageMinute(); // day 2 on A, uploaded
    await tick();
    jest.setSystemTime(DAY(2));
    await b.db.getDb().addUsageMinute(); // day 3 on B, which never saw day 2: its upload replaces the whole payload
    await tick();
    const c = makeDevice(cloud);
    const stopC = await signIn(c, cloud, 'Ana');
    expect(await daysSeenBy(c)).toBe(3);
    [stopA, stopB, stopC].forEach((stop) => stop());
  });
});
