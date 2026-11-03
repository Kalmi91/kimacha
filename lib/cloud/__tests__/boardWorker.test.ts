// The weekly XP board routes of cloud/worker.ts's Durable Object, run for real under jest: join, push, list, leave, and the name
// check of the login. Same stand-in for 'cloudflare:workers' as cloudWorker.test.ts (a bare base class); the storage is a real
// SQLite (sql.js, as lib/testing/sqljsDriver.ts) instead of that file's statement-by-statement fake, so the board SQL itself
// (UNIQUE name_key, the upsert, the counter) runs. Not covered: workerd, and the real SQLite of Durable Objects.
// 2026-11-03 is a Tuesday: its week runs 2026-11-02 .. 2026-11-08.
import { createHash } from 'crypto';
import { BOARD_JOINS_PER_DAY } from '../../../cloud/logic';

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

// The asm.js build: the wasm one fails to open a database inside jest's sandbox (see lib/testing/sqljsDriver.ts).
const initSqlJs = require('sql.js/dist/sql-asm.js');

type Row = Record<string, any>;
type Reply = { status: number; body: any; text: string };
// `ip`: the address Cloudflare would put in CF-Connecting-IP (none: the header is missing).
type CallOptions = { token?: string; header?: string; body?: unknown; raw?: string; ip?: string };

const MON = '2026-11-02';
const TUE = '2026-11-03';
const SUN_BEFORE = '2026-11-01';
const START = Date.UTC(2026, 10, 3, 12, 0, 0); // Tuesday noon UTC
let clock = START;

beforeEach(() => {
  clock = START;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

let sqlJs: Promise<any> | null = null;

async function startCloud() {
  const SQL = await (sqlJs ??= initSqlJs());
  const db = new SQL.Database();
  // The surface of DurableObjectStorage.sql that worker.ts uses: exec(query, ...bindings) -> { toArray() }, run at once.
  const sql = {
    exec: (query: string, ...bindings: unknown[]) => {
      const stmt = db.prepare(query);
      try {
        stmt.bind(bindings);
        const rows: Row[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        return { toArray: () => rows };
      } finally {
        stmt.free();
      }
    },
  };
  const { KimachaUsers } = jest.requireActual<{ KimachaUsers: new (ctx: unknown, env: unknown) => { fetch(req: Request): Promise<Response> } }>('../../../cloud/worker');
  let obj = new KimachaUsers({ storage: { sql } }, {});
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
    call,
    // A second start of the Durable Object on the same storage (the constructor runs the table setup again).
    restart: () => {
      obj = new KimachaUsers({ storage: { sql } }, {});
    },
    rows: (query: string, ...bindings: unknown[]): Row[] => sql.exec(query, ...bindings).toArray(),
    run: (query: string, ...bindings: unknown[]): void => void sql.exec(query, ...bindings),
    join: (name: unknown, o: CallOptions = {}) => call('POST', '/api/board/join', { ...o, body: { name } }),
    login: (name: string, pin: string, o: CallOptions = {}) => call('POST', '/api/login', { ...o, body: { name, pin } }),
    push: (token: string, days: unknown) => call('PUT', '/api/board/xp', { token, body: { days } }),
    board: (token: string | undefined, query = '') => call('GET', '/api/board' + query, token === undefined ? {} : { token }),
    leave: (token: string | undefined) => call('DELETE', '/api/board/me', token === undefined ? {} : { token }),
  };
}
type Cloud = Awaited<ReturnType<typeof startCloud>>;

const storedDays = (cloud: Cloud, nameKey: string): string | undefined => cloud.rows('SELECT daily_xp FROM board WHERE name_key = ?', nameKey)[0]?.daily_xp;
const boardCount = (cloud: Cloud): number => cloud.rows('SELECT owner FROM board').length;

// An account (web token) and two devices on one board: Ana 13 XP this week (125 tenths rounds up), Bela 30, Cili only last week.
async function seedBoard(cloud: Cloud) {
  const ana = (await cloud.login('Ana', '1234')).body.token as string;
  const bela = (await cloud.join('Bela')).body.token as string;
  const cili = (await cloud.join('Cili')).body.token as string;
  await cloud.push(ana, [[TUE, 125]]);
  await cloud.push(bela, [[MON, 300]]);
  await cloud.push(cili, [[SUN_BEFORE, 500]]);
  return { ana, bela, cili };
}

describe('POST /api/board/join', () => {
  it('gives a device a token and a board row, and stores only the hash of the token', async () => {
    const cloud = await startCloud();
    const res = await cloud.join('  Mari   Néni ', { ip: '10.0.0.1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ token: expect.stringMatching(/^[0-9a-f]{64}$/), displayName: 'Mari Néni' });
    const rows = cloud.rows('SELECT * FROM board');
    expect(rows).toEqual([{ owner: 'd:' + sha256(res.body.token), name_key: 'mari néni', display_name: 'Mari Néni', daily_xp: '[]', updated_at: '2026-11-03T12:00:00.000Z' }]);
    expect(JSON.stringify(cloud.rows('SELECT * FROM board_joins'))).not.toContain(res.body.token);
    expect(JSON.stringify(rows)).not.toContain(res.body.token);
    expect(cloud.rows('SELECT * FROM board_joins')).toEqual([{ ip: '10.0.0.1', day: '2026-11-03', count: 1 }]);
    expect(cloud.rows('SELECT * FROM tokens')).toEqual([]); // not a web session
  });

  it('answers 409 name_taken for a name an account has, in any case or spacing', async () => {
    const cloud = await startCloud();
    await cloud.login('Ana', '1234');
    const res = await cloud.join('  ANA ');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'name_taken' });
    expect(boardCount(cloud)).toBe(0);
  });

  it('answers 409 name_taken for a name another device has, and the first device keeps it', async () => {
    const cloud = await startCloud();
    const first = await cloud.join('Zed');
    for (const again of ['Zed', 'zed', '  ZED  ']) {
      const res = await cloud.join(again);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'name_taken' });
    }
    expect(boardCount(cloud)).toBe(1);
    expect((await cloud.push(first.body.token, [[TUE, 10]])).status).toBe(200);
  });

  it('answers 400 bad_input for a name that breaks the login rule, a body without one, or a body that is not JSON', async () => {
    const cloud = await startCloud();
    for (const name of ['', 'a', ' a ', 'x'.repeat(25), 5, null, undefined, ['Ana']]) {
      const res = await cloud.join(name);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'bad_input' });
    }
    for (const raw of ['nope', '[]', 'null', '{}']) expect((await cloud.call('POST', '/api/board/join', { raw })).status).toBe(400);
    expect(boardCount(cloud)).toBe(0);
    expect(cloud.rows('SELECT * FROM board_joins')).toEqual([]);
  });

  it('answers 429 locked from the 11th join of one address on a UTC day, until the day ends; other addresses and the next day are free', async () => {
    const cloud = await startCloud();
    for (let i = 0; i < BOARD_JOINS_PER_DAY; i++) expect((await cloud.join('Player ' + i, { ip: '1.1.1.1' })).status).toBe(200);
    const over = await cloud.join('One more', { ip: '1.1.1.1' });
    expect(over.status).toBe(429);
    expect(over.body).toEqual({ error: 'locked', retryAfterSec: 12 * 3600 });
    expect(boardCount(cloud)).toBe(BOARD_JOINS_PER_DAY);
    expect((await cloud.join('Other address', { ip: '2.2.2.2' })).status).toBe(200);

    clock = START + 12 * 3_600_000 - 1; // the last millisecond of the day
    const late = await cloud.join('Late one', { ip: '1.1.1.1' });
    expect(late.status).toBe(429);
    expect(late.body).toEqual({ error: 'locked', retryAfterSec: 1 });

    clock = START + 12 * 3_600_000; // 2026-11-04 00:00:00 UTC
    expect((await cloud.join('Next day', { ip: '1.1.1.1' })).status).toBe(200);
    expect(cloud.rows('SELECT * FROM board_joins WHERE ip = ?', '1.1.1.1')).toEqual([{ ip: '1.1.1.1', day: '2026-11-04', count: 1 }]); // yesterday's counter is gone
  });

  it('counts only the joins that go through, and a missing address header is one shared address', async () => {
    const cloud = await startCloud();
    for (let i = 0; i < BOARD_JOINS_PER_DAY - 1; i++) expect((await cloud.join('Player ' + i)).status).toBe(200);
    expect((await cloud.join('x')).status).toBe(400);
    expect((await cloud.join('Player 0')).status).toBe(409);
    expect((await cloud.join('player 1')).status).toBe(409);
    expect((await cloud.join('Last one')).status).toBe(200); // the 10th
    expect((await cloud.join('Too many')).status).toBe(429);
    expect(cloud.rows('SELECT * FROM board_joins')).toEqual([{ ip: '', day: '2026-11-03', count: BOARD_JOINS_PER_DAY }]);
  });

  it('is serialized with login: a join and a login for one new name cannot both succeed', async () => {
    const cloud = await startCloud();
    const replies = await Promise.all([cloud.join('Race'), cloud.login('Race', '1234')]);
    expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(replies.find((r) => r.status === 409)!.body).toEqual({ error: 'name_taken' });
    expect(boardCount(cloud) + cloud.rows('SELECT name_key FROM users').length).toBe(1);
  });
});

describe('PUT /api/board/xp', () => {
  it('stores the days of a device, and a second push replaces them instead of adding', async () => {
    const cloud = await startCloud();
    const { token } = (await cloud.join('Bela')).body;
    const first = await cloud.push(token, [[TUE, 50], [MON, 100]]);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({});
    expect(storedDays(cloud, 'bela')).toBe('[["2026-11-02",100],["2026-11-03",50]]');
    clock += 1000;
    await cloud.push(token, [[TUE, 70]]);
    expect(storedDays(cloud, 'bela')).toBe('[["2026-11-03",70]]');
    expect(cloud.rows('SELECT updated_at FROM board')).toEqual([{ updated_at: '2026-11-03T12:00:01.000Z' }]);
    expect(boardCount(cloud)).toBe(1);
    await cloud.push(token, []);
    expect(storedDays(cloud, 'bela')).toBe('[]');
  });

  it('creates the row of an account on its first push, with the name from the account, and replaces the days after that', async () => {
    const cloud = await startCloud();
    const { token } = (await cloud.login('  ana ', '1234')).body; // typed in lower case with spaces: the account keeps the typed form, trimmed
    expect(boardCount(cloud)).toBe(0); // logging in alone puts nobody on the board
    expect((await cloud.push(token, [[TUE, 125]])).status).toBe(200);
    expect(cloud.rows('SELECT * FROM board')).toEqual([{ owner: 'u:ana', name_key: 'ana', display_name: 'ana', daily_xp: '[["2026-11-03",125]]', updated_at: '2026-11-03T12:00:00.000Z' }]);
    await cloud.push(token, [[MON, 5]]);
    expect(boardCount(cloud)).toBe(1);
    expect(storedDays(cloud, 'ana')).toBe('[["2026-11-02",5]]');
  });

  it('filters the days on the way in: window, clamp, duplicates, junk', async () => {
    const cloud = await startCloud();
    const { token } = (await cloud.join('Bela')).body;
    await cloud.push(token, [['2026-10-20', 5], ['2026-10-21', 99_999], [TUE, 7.5], [TUE, 30], ['junk', 1], [MON, 'x']]);
    expect(storedDays(cloud, 'bela')).toBe('[["2026-10-21",20000],["2026-11-03",30]]');
  });

  it('answers 400 bad_input when days is not a list, and leaves the stored days alone', async () => {
    const cloud = await startCloud();
    const { token } = (await cloud.join('Bela')).body;
    await cloud.push(token, [[TUE, 10]]);
    for (const raw of ['nope', '{}', '{"days":"x"}', '{"days":{}}', '[]', 'null']) {
      const res = await cloud.call('PUT', '/api/board/xp', { token, raw });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'bad_input' });
    }
    expect(storedDays(cloud, 'bela')).toBe('[["2026-11-03",10]]');
  });

  it('answers 401 bad_token without a good token, before it looks at the body', async () => {
    const cloud = await startCloud();
    const { token } = (await cloud.join('Bela')).body;
    const hash = (cloud.rows('SELECT owner FROM board')[0].owner as string).slice(2);
    const attempts: CallOptions[] = [{}, { token: 'f'.repeat(64) }, { header: 'Token ' + token }, { header: token }, { token: hash }]; // the stored hash is no token
    for (const o of attempts) {
      const res = await cloud.call('PUT', '/api/board/xp', { ...o, body: { days: [[TUE, 10]] } });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'bad_token' });
    }
    expect((await cloud.call('PUT', '/api/board/xp', { token: 'f'.repeat(64), raw: 'nope' })).status).toBe(401);
    expect(storedDays(cloud, 'bela')).toBe('[]');
  });
});

describe('GET /api/board', () => {
  it('ranks this week by XP and marks the caller, for a web token and for a device token', async () => {
    const cloud = await startCloud();
    const { ana, bela, cili } = await seedBoard(cloud);
    const asAna = await cloud.board(ana);
    expect(asAna.status).toBe(200);
    expect(asAna.body).toEqual({
      weekStart: MON,
      rows: [
        { rank: 1, name: 'Bela', xp: 30, me: false },
        { rank: 2, name: 'Ana', xp: 13, me: true },
      ],
      me: { rank: 2, xp: 13, name: 'Ana' },
    });
    const asBela = await cloud.board(bela);
    expect(asBela.body.me).toEqual({ rank: 1, xp: 30, name: 'Bela' });
    expect(asBela.body.rows.map((r: Row) => r.me)).toEqual([true, false]);
    // Cili has no XP this week (only last week's): off the list for the others, last for herself
    const asCili = await cloud.board(cili);
    expect(asCili.body.rows.map((r: Row) => [r.rank, r.name, r.xp, r.me])).toEqual([[1, 'Bela', 30, false], [2, 'Ana', 13, false], [3, 'Cili', 0, true]]);
    expect(asCili.body.me).toEqual({ rank: 3, xp: 0, name: 'Cili' });
  });

  it('answers 401 bad_token without a good token', async () => {
    const cloud = await startCloud();
    await seedBoard(cloud);
    for (const token of [undefined, 'f'.repeat(64)]) {
      const res = await cloud.board(token);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'bad_token' });
    }
  });

  it('shows an account that has not pushed yet at the end with 0 XP, without creating its row', async () => {
    const cloud = await startCloud();
    await seedBoard(cloud);
    const zita = (await cloud.login('Zita', '1234')).body.token as string;
    const before = boardCount(cloud);
    const res = await cloud.board(zita);
    expect(res.body.rows.map((r: Row) => [r.rank, r.name, r.xp, r.me])).toEqual([[1, 'Bela', 30, false], [2, 'Ana', 13, false], [3, 'Zita', 0, true]]);
    expect(res.body.me).toEqual({ rank: 3, xp: 0, name: 'Zita' });
    expect(boardCount(cloud)).toBe(before);
  });

  it('hands out nothing that identifies a device: no owner, token, hash or name key', async () => {
    const cloud = await startCloud();
    const { ana, bela } = await seedBoard(cloud);
    const res = await cloud.board(ana);
    expect(res.text).not.toMatch(/owner|token|name_key|"d:|"u:/);
    expect(res.text).not.toContain(sha256(bela));
    expect(Object.keys(res.body).sort()).toEqual(['me', 'rows', 'weekStart']);
  });

  it('counts the week of the day the client names when it is within a day of UTC, else the UTC week', async () => {
    const cloud = await startCloud();
    clock = Date.UTC(2026, 10, 8, 23, 30); // Sunday 23:30 UTC
    const bela = (await cloud.join('Bela')).body.token as string;
    await cloud.push(bela, [['2026-11-08', 400]]);
    const ana = (await cloud.login('Ana', '1234')).body.token as string;

    const utc = await cloud.board(ana);
    expect(utc.body.weekStart).toBe(MON);
    expect(utc.body.rows.map((r: Row) => [r.name, r.xp])).toEqual([['Bela', 40], ['Ana', 0]]);

    const mondayThere = await cloud.board(ana, '?today=2026-11-09'); // a client east of UTC, already on Monday
    expect(mondayThere.body.weekStart).toBe('2026-11-09');
    expect(mondayThere.body.rows).toEqual([{ rank: 1, name: 'Ana', xp: 0, me: true }]);

    for (const q of ['?today=2026-11-12', '?today=garbage', '?today=', '?today=2026-02-30']) expect((await cloud.board(ana, q)).body.weekStart).toBe(MON);
  });
});

describe('DELETE /api/board/me', () => {
  it('removes a device from the board and kills its token, and frees the name', async () => {
    const cloud = await startCloud();
    const { ana, bela } = await seedBoard(cloud);
    const res = await cloud.leave(bela);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
    expect(storedDays(cloud, 'bela')).toBeUndefined();
    expect((await cloud.board(bela)).status).toBe(401);
    expect((await cloud.push(bela, [[TUE, 10]])).status).toBe(401);
    expect((await cloud.leave(bela)).status).toBe(401);
    expect(storedDays(cloud, 'bela')).toBeUndefined(); // the push did not bring the row back
    expect((await cloud.board(ana)).body.rows.map((r: Row) => r.name)).toEqual(['Ana']);
    expect((await cloud.join('Bela')).status).toBe(200);
  });

  it('removes an account from the board and records the opt-out, but leaves its web session alone', async () => {
    const cloud = await startCloud();
    const { ana } = await seedBoard(cloud);
    expect((await cloud.leave(ana)).status).toBe(200);
    expect(storedDays(cloud, 'ana')).toBeUndefined();
    expect(cloud.rows('SELECT * FROM board_optout')).toEqual([{ name_key: 'ana' }]);
    expect((await cloud.call('GET', '/api/progress', { token: ana })).status).toBe(200);
    expect((await cloud.leave(ana)).status).toBe(200); // leaving twice is fine, still one opt-out
    expect(cloud.rows('SELECT * FROM board_optout')).toEqual([{ name_key: 'ana' }]);
  });

  it('keeps a device out of the opt-out table: its token is what dies', async () => {
    const cloud = await startCloud();
    const { bela } = await seedBoard(cloud);
    await cloud.leave(bela);
    expect(cloud.rows('SELECT * FROM board_optout')).toEqual([]);
  });

  it('keeps a left account off the board: its next automatic push answers {} and writes nothing', async () => {
    const cloud = await startCloud();
    const { ana } = await seedBoard(cloud);
    await cloud.leave(ana);
    const push = await cloud.push(ana, [[TUE, 125]]);
    expect(push.status).toBe(200);
    expect(push.body).toEqual({});
    expect(storedDays(cloud, 'ana')).toBeUndefined();
    expect(boardCount(cloud)).toBe(2); // Bela and Cili
  });

  it('answers a left account\'s GET with the list, me null and left true, and does not add it to the list', async () => {
    const cloud = await startCloud();
    const { ana, bela } = await seedBoard(cloud);
    expect(Object.keys((await cloud.board(ana)).body)).not.toContain('left'); // not there before leaving
    await cloud.leave(ana);
    const after = await cloud.board(ana);
    expect(after.status).toBe(200);
    expect(after.body).toEqual({ weekStart: MON, rows: [{ rank: 1, name: 'Bela', xp: 30, me: false }], me: null, left: true });
    expect(boardCount(cloud)).toBe(2);
    expect(Object.keys((await cloud.board(bela)).body).sort()).toEqual(['me', 'rows', 'weekStart']); // others are not told anything
  });

  it('puts a left account back on POST /api/board/join with its web token: no name, no new token, no count against the address', async () => {
    const cloud = await startCloud();
    const { ana } = await seedBoard(cloud);
    await cloud.leave(ana);
    const joins = cloud.rows('SELECT * FROM board_joins');
    for (let i = 0; i <= BOARD_JOINS_PER_DAY; i++) {
      const back = await cloud.call('POST', '/api/board/join', { token: ana, ip: '7.7.7.7' }); // no body at all
      expect(back.status).toBe(200);
      expect(back.body).toEqual({ displayName: 'Ana' });
    }
    expect(cloud.rows('SELECT * FROM board_optout')).toEqual([]);
    expect(cloud.rows('SELECT * FROM board_joins')).toEqual(joins);
    expect(storedDays(cloud, 'ana')).toBeUndefined(); // back, but on the list only with the next push
    await cloud.push(ana, [[TUE, 125]]);
    expect(storedDays(cloud, 'ana')).toBe('[["2026-11-03",125]]');
    const res = await cloud.board(ana);
    expect(res.body).toEqual({
      weekStart: MON,
      rows: [
        { rank: 1, name: 'Bela', xp: 30, me: false },
        { rank: 2, name: 'Ana', xp: 13, me: true },
      ],
      me: { rank: 2, xp: 13, name: 'Ana' },
    });
  });

  it('ignores a name in the body of a web rejoin, and an account that never left is unharmed by it', async () => {
    const cloud = await startCloud();
    const { ana } = await seedBoard(cloud);
    const res = await cloud.join('Other name', { token: ana });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ displayName: 'Ana' });
    expect(cloud.rows('SELECT name_key FROM board ORDER BY name_key')).toEqual([{ name_key: 'ana' }, { name_key: 'bela' }, { name_key: 'cili' }]);
    expect(storedDays(cloud, 'ana')).toBe('[["2026-11-03",125]]');
  });

  it('treats a bearer token that is no account\'s as a device join, as before', async () => {
    const cloud = await startCloud();
    const res = await cloud.join('Dev', { token: 'f'.repeat(64) });
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect((await cloud.call('POST', '/api/board/join', { token: 'f'.repeat(64) })).status).toBe(400); // and without a name it is a bad join
  });

  it('answers 401 bad_token without a good token and touches nobody', async () => {
    const cloud = await startCloud();
    await seedBoard(cloud);
    const before = boardCount(cloud);
    for (const token of [undefined, 'f'.repeat(64)]) {
      const res = await cloud.leave(token);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'bad_token' });
    }
    expect(boardCount(cloud)).toBe(before);
  });
});

describe('login and the names of the devices', () => {
  it('refuses a NEW account the name a device holds: 409 name_taken, no account, no token, whatever the PIN', async () => {
    const cloud = await startCloud();
    await cloud.join('Kiki');
    for (const name of ['Kiki', '  KIKI', 'kiki ']) {
      const res = await cloud.login(name, '1234');
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'name_taken' });
    }
    expect(cloud.rows('SELECT * FROM users')).toEqual([]);
    expect(cloud.rows('SELECT * FROM tokens')).toEqual([]);
  });

  it('lets the name go to an account once the device has left', async () => {
    const cloud = await startCloud();
    const { token } = (await cloud.join('Kiki')).body;
    await cloud.leave(token);
    const res = await cloud.login('Kiki', '1234');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ created: true, displayName: 'Kiki' });
  });

  it('still logs an existing account in, also while devices play, and also when a device row with its name was planted', async () => {
    const cloud = await startCloud();
    await cloud.login('Ana', '1234');
    await cloud.join('Kiki');
    const again = await cloud.login('ana', '1234');
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ created: false, displayName: 'Ana' });
    // Not possible through the API (join checks the accounts); the check is for NEW accounts only, whatever is in the table.
    cloud.run("INSERT INTO board (owner, name_key, display_name, daily_xp, updated_at) VALUES ('d:planted', 'ana', 'Ana', '[]', 'x')");
    const planted = await cloud.login('Ana', '1234');
    expect(planted.status).toBe(200);
    expect(planted.body).toMatchObject({ created: false });
    expect((await cloud.login('Ana', '0000')).status).toBe(401); // the PIN rules are the same as before
  });

  it('does not stop an account from a name that only an account board row holds (an account pushed, then logs in again)', async () => {
    const cloud = await startCloud();
    const { token } = (await cloud.login('Ana', '1234')).body;
    await cloud.push(token, [[TUE, 10]]);
    expect((await cloud.login('Ana', '1234')).body).toMatchObject({ created: false });
    expect((await cloud.login('Bo', '1234')).body).toMatchObject({ created: true });
  });
});

describe('retention: old rows and old join counters go', () => {
  const DAY_MS = 86_400_000;
  const names = (cloud: Cloud): string[] => cloud.rows('SELECT name_key FROM board ORDER BY name_key').map((r) => r.name_key);

  it('deletes a device row nobody pushed to for 28 days at a GET, keeps a fresh one, and frees the name; the dead token gets 401', async () => {
    const cloud = await startCloud();
    const bela = (await cloud.join('Bela')).body.token as string;
    clock = START + 14 * DAY_MS;
    const cili = (await cloud.join('Cili')).body.token as string;
    await cloud.push(cili, [[TUE, 50]]);
    const ana = (await cloud.login('Ana', '1234')).body.token as string;
    await cloud.push(ana, [['2026-11-17', 50]]);

    clock = START + 28 * DAY_MS; // exactly 28 days: not older than the limit yet
    expect((await cloud.board(cili)).status).toBe(200);
    expect(names(cloud)).toEqual(['ana', 'bela', 'cili']);

    clock = START + 28 * DAY_MS + 1;
    expect((await cloud.board(cili)).status).toBe(200);
    expect(names(cloud)).toEqual(['ana', 'cili']); // Bela is gone, the fresh rows stay
    expect((await cloud.board(bela)).status).toBe(401);
    expect((await cloud.push(bela, [[TUE, 10]])).status).toBe(401);
    expect(names(cloud)).toEqual(['ana', 'cili']);
    const again = await cloud.join('bela');
    expect(again.status).toBe(200); // the name is free again
    expect(again.body.token).not.toBe(bela);
  });

  it.each([
    ['a push', (c: Cloud, ana: string) => c.push(ana, [[TUE, 10]]), ['ana']],
    ['a GET', (c: Cloud, ana: string) => c.board(ana), []],
    ['a join', (c: Cloud) => c.join('Newcomer'), ['newcomer']],
  ] as const)('deletes it at the start of %s too', async (_what, act, added) => {
    const cloud = await startCloud();
    const orphan = (await cloud.join('Orphan')).body.token as string;
    clock = START + 29 * DAY_MS;
    const ana = (await cloud.login('Ana', '1234')).body.token as string;
    expect(names(cloud)).toEqual(['orphan']); // nothing purged yet: login does not
    expect((await act(cloud, ana)).status).toBe(200);
    expect(names(cloud)).toEqual([...added]);
    expect((await cloud.board(orphan)).status).toBe(401);
  });

  it('puts an account whose row was purged back with its next push, and keeps its opt-out', async () => {
    const cloud = await startCloud();
    const ana = (await cloud.login('Ana', '1234')).body.token as string;
    const zita = (await cloud.login('Zita', '1234')).body.token as string;
    await cloud.push(ana, [[TUE, 125]]);
    await cloud.push(zita, [[TUE, 50]]);
    await cloud.leave(zita);
    clock = START + 29 * DAY_MS;
    const gone = await cloud.board(ana); // the web token has no expiry: it still works, the row does not
    expect(gone.status).toBe(200);
    expect(names(cloud)).toEqual([]);
    expect(gone.body.me).toEqual({ rank: 1, xp: 0, name: 'Ana' });
    expect(cloud.rows('SELECT * FROM board_optout')).toEqual([{ name_key: 'zita' }]);
    expect((await cloud.board(zita)).body).toMatchObject({ me: null, left: true });
    await cloud.push(ana, [['2026-12-02', 30]]);
    expect(storedDays(cloud, 'ana')).toBe('[["2026-12-02",30]]');
  });

  it.each([
    ['a push', (c: Cloud, bela: string) => c.push(bela, [[TUE, 10]])],
    ['a GET', (c: Cloud, bela: string) => c.board(bela)],
    ['a join', (c: Cloud) => c.join('Cili', { ip: '2.2.2.2' })],
  ] as const)('deletes the join counters of past days at the start of %s', async (_what, act) => {
    const cloud = await startCloud();
    const bela = (await cloud.join('Bela', { ip: '1.1.1.1' })).body.token as string;
    expect(cloud.rows('SELECT day FROM board_joins')).toEqual([{ day: '2026-11-03' }]);
    clock = START + DAY_MS; // the next UTC day, nobody joined
    expect((await act(cloud, bela)).status).toBe(200);
    expect(cloud.rows('SELECT day FROM board_joins').filter((r) => r.day === '2026-11-03')).toEqual([]);
  });
});

describe('the board tables', () => {
  it('refuse two owners for one name key', async () => {
    const cloud = await startCloud();
    await cloud.join('Zed');
    expect(() => cloud.run("INSERT INTO board (owner, name_key, display_name, daily_xp, updated_at) VALUES ('d:other', 'zed', 'ZED', '[]', 'x')")).toThrow();
  });

  it('survive a restart of the object with their rows', async () => {
    const cloud = await startCloud();
    const { token } = (await cloud.join('Bela')).body;
    await cloud.push(token, [[TUE, 50]]);
    cloud.restart();
    expect(storedDays(cloud, 'bela')).toBe('[["2026-11-03",50]]');
    expect((await cloud.board(token)).body.me).toEqual({ rank: 1, xp: 5, name: 'Bela' });
    expect((await cloud.join('Cili')).status).toBe(200);
  });

  it('answer 405 to a wrong method on every route', async () => {
    const cloud = await startCloud();
    for (const [method, path] of [['GET', '/api/board/join'], ['PUT', '/api/board/join'], ['GET', '/api/board/xp'], ['POST', '/api/board/xp'], ['POST', '/api/board'], ['PUT', '/api/board'], ['GET', '/api/board/me'], ['POST', '/api/board/me']]) {
      const res = await cloud.call(method, path);
      expect([method, path, res.status]).toEqual([method, path, 405]);
    }
  });
});
