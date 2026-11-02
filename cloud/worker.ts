// The Kimacha web cloud: the Worker serves the static web build (`../dist`, the ASSETS binding) and the /api/* routes.
// All /api/* goes to one Durable Object (`KimachaUsers`), which keeps the accounts (name + PIN) and each account's progress
// payload in its SQLite storage. The API contract is in PLAN-web-felho.md. The Worker is built by wrangler (wrangler.toml
// `main`); the app does not import it. The owner's /admin page and /api/admin/stats (user list, no PIN or progress content)
// are guarded by the ADMIN_KEY secret.
import { DurableObject } from 'cloudflare:workers';
import { nameKey } from '../lib/cloud/validate';
import { ADMIN_PAGE } from './admin';
import { adminAuthorized, afterBadPin, afterBadPinForName, bearerToken, clientIp, displayName, lockRemainingSec, parseBaseRev, parseLogin, parsePayload, safeEqual, toAdminStats, toHex } from './logic';
import type { AdminUserRow } from './logic';

interface Env {
  ASSETS: Fetcher;
  USERS: DurableObjectNamespace<KimachaUsers>;
  ADMIN_KEY?: string;
}

type UserRow = {
  display_name: string;
  salt: string;
  pin_hash: string;
  payload: string | null;
  updated_at: string | null;
  fail_count: number;
  locked_until: number | null;
  rev: number;
  fail_since: number | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

function randomHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return toHex(b);
}

async function sha256Hex(text: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null; // a body that is not JSON is handled like a wrong one: bad_input
  }
}

export class KimachaUsers extends DurableObject<Env> {
  // Logins run one after the other: the lock counter is read, the PIN hashed (an await), the counter written. Run in
  // parallel, a burst of guesses would all read the same count and never trip the lock.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec(
      `CREATE TABLE IF NOT EXISTS users (
        name_key TEXT PRIMARY KEY, display_name TEXT NOT NULL, salt TEXT NOT NULL, pin_hash TEXT NOT NULL,
        payload TEXT, updated_at TEXT, fail_count INTEGER NOT NULL DEFAULT 0, locked_until INTEGER)`,
    );
    sql.exec('CREATE TABLE IF NOT EXISTS tokens (token TEXT PRIMARY KEY, name_key TEXT NOT NULL, created_at INTEGER NOT NULL)');
    // The lock of one name from one address: users.fail_count / locked_until count the name over all addresses (MAX_NAME_FAILS).
    sql.exec(
      `CREATE TABLE IF NOT EXISTS login_fails (
        name_key TEXT NOT NULL, ip TEXT NOT NULL, fail_count INTEGER NOT NULL DEFAULT 0, locked_until INTEGER, PRIMARY KEY (name_key, ip))`,
    );
    // Migration: an older users table gets the columns below here, once each; its rows and payloads are untouched.
    // `rev` counts the saves of an account (PUT /api/progress is conditional on it), rows start at 0.
    // `fail_since` (epoch ms) is when the current window of the name-wide wrong-PIN count began (afterBadPinForName), NULL = none.
    const columns = new Set(sql.exec<{ name: string }>('PRAGMA table_info(users)').toArray().map((c) => c.name));
    if (!columns.has('rev')) sql.exec('ALTER TABLE users ADD COLUMN rev INTEGER NOT NULL DEFAULT 0');
    if (!columns.has('fail_since')) sql.exec('ALTER TABLE users ADD COLUMN fail_since INTEGER');
  }

  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    try {
      if (pathname === '/api/login') return req.method === 'POST' ? await this.serial(async () => this.login(await readJson(req), req)) : this.wrongMethod();
      if (pathname === '/api/progress') {
        if (req.method === 'GET') return this.getProgress(req);
        if (req.method === 'PUT') return this.putProgress(req, await readJson(req));
        return this.wrongMethod();
      }
      if (pathname === '/api/logout') return req.method === 'POST' ? this.logout(req) : this.wrongMethod();
      if (pathname === '/api/admin/stats') return req.method === 'GET' ? this.adminStats(req) : this.wrongMethod();
      return json({ error: 'not_found' }, 404);
    } catch {
      return json({ error: 'server_error' }, 500);
    }
  }

  private wrongMethod(): Response {
    return json({ error: 'method_not_allowed' }, 405);
  }

  private serial<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private newToken(key: string, now: number): string {
    const token = randomHex(32);
    this.ctx.storage.sql.exec('INSERT INTO tokens (token, name_key, created_at) VALUES (?, ?, ?)', token, key, now);
    return token;
  }

  // The lock is per name AND address: the 5th wrong PIN from one address locks that address for the name, so a stranger who
  // knows only the name locks himself out, not the owner. All addresses together lock the whole name only at MAX_NAME_FAILS inside one window.
  // A device that already holds a token of this account (Authorization: Bearer) is not held back by either lock, and its
  // wrong PINs are not counted.
  private async login(body: unknown, req: Request): Promise<Response> {
    const input = parseLogin(body);
    if (!input) return json({ error: 'bad_input' }, 400);
    const sql = this.ctx.storage.sql;
    const key = nameKey(input.name);
    const now = Date.now();
    const user = sql.exec<UserRow>('SELECT * FROM users WHERE name_key = ?', key).toArray()[0];

    if (!user) {
      const salt = randomHex(16);
      const pinHash = await sha256Hex(salt + input.pin);
      const display = displayName(input.name);
      sql.exec('INSERT INTO users (name_key, display_name, salt, pin_hash) VALUES (?, ?, ?, ?)', key, display, salt, pinHash);
      return json({ token: this.newToken(key, now), displayName: display, created: true, payload: null, updatedAt: null, rev: 0 });
    }

    const ip = clientIp(req.headers.get('CF-Connecting-IP'));
    const holdsToken = this.authedKey(req) === key;
    const here = sql.exec<{ fail_count: number; locked_until: number | null }>('SELECT fail_count, locked_until FROM login_fails WHERE name_key = ? AND ip = ?', key, ip).toArray()[0];
    if (!holdsToken) {
      const wait = Math.max(lockRemainingSec(here?.locked_until ?? null, now), lockRemainingSec(user.locked_until, now));
      if (wait > 0) return json({ error: 'locked', retryAfterSec: wait }, 429);
    }

    if (!safeEqual(await sha256Hex(user.salt + input.pin), user.pin_hash)) {
      if (!holdsToken) {
        const mine = afterBadPin(here?.fail_count ?? 0, now);
        sql.exec('INSERT OR REPLACE INTO login_fails (name_key, ip, fail_count, locked_until) VALUES (?, ?, ?, ?)', key, ip, mine.failCount, mine.lockedUntil);
        const name = afterBadPinForName(user.fail_count, user.fail_since, now);
        sql.exec('UPDATE users SET fail_count = ?, locked_until = ?, fail_since = ? WHERE name_key = ?', name.failCount, name.lockedUntil, name.failSince, key);
      }
      return json({ error: 'bad_pin' }, 401);
    }

    sql.exec('UPDATE users SET fail_count = 0, locked_until = NULL WHERE name_key = ?', key);
    sql.exec('DELETE FROM login_fails WHERE name_key = ? AND ip = ?', key, ip);
    return json({ token: this.newToken(key, now), displayName: user.display_name, created: false, payload: user.payload, updatedAt: user.updated_at, rev: user.rev });
  }

  /** The account key behind the request's bearer token, or null. */
  private authedKey(req: Request): string | null {
    const token = bearerToken(req.headers.get('Authorization'));
    if (!token) return null;
    const row = this.ctx.storage.sql.exec<{ name_key: string }>('SELECT name_key FROM tokens WHERE token = ?', token).toArray()[0];
    return row ? row.name_key : null;
  }

  private getProgress(req: Request): Response {
    const key = this.authedKey(req);
    if (key === null) return json({ error: 'bad_token' }, 401);
    const row = this.ctx.storage.sql
      .exec<{ payload: string | null; updated_at: string | null; rev: number }>('SELECT payload, updated_at, rev FROM users WHERE name_key = ?', key)
      .toArray()[0];
    if (!row) return json({ error: 'bad_token' }, 401);
    return json({ payload: row.payload, updatedAt: row.updated_at, rev: row.rev });
  }

  private putProgress(req: Request, body: unknown): Response {
    const key = this.authedKey(req);
    if (key === null) return json({ error: 'bad_token' }, 401);
    const parsed = parsePayload(body);
    if (!parsed.ok) return json({ error: parsed.error }, parsed.status);
    const base = parseBaseRev(body);
    if (!base.ok) return json({ error: 'bad_input' }, 400);
    // Read and write in one synchronous run, so no other request lands between them. A body without `rev` (an old client)
    // writes unconditionally, as before; with `rev` the save only goes through when nothing was saved since that revision,
    // otherwise the current state comes back (409) for the client to merge.
    const sql = this.ctx.storage.sql;
    const cur = sql.exec<{ payload: string | null; updated_at: string | null; rev: number }>('SELECT payload, updated_at, rev FROM users WHERE name_key = ?', key).toArray()[0];
    if (!cur) return json({ error: 'bad_token' }, 401);
    if (base.rev !== null && base.rev !== cur.rev) return json({ error: 'conflict', payload: cur.payload, updatedAt: cur.updated_at, rev: cur.rev }, 409);
    const updatedAt = new Date().toISOString();
    const rev = cur.rev + 1;
    sql.exec('UPDATE users SET payload = ?, updated_at = ?, rev = ? WHERE name_key = ?', parsed.payload, updatedAt, rev, key);
    return json({ updatedAt, rev });
  }

  private logout(req: Request): Response {
    const token = bearerToken(req.headers.get('Authorization'));
    if (token === null || this.authedKey(req) === null) return json({ error: 'bad_token' }, 401);
    this.ctx.storage.sql.exec('DELETE FROM tokens WHERE token = ?', token);
    return json({});
  }

  private adminStats(req: Request): Response {
    if (!adminAuthorized(req.headers.get('Authorization'), this.env.ADMIN_KEY)) return json({ error: 'bad_token' }, 401);
    const rows = this.ctx.storage.sql
      .exec<AdminUserRow>(
        `SELECT u.display_name, u.updated_at, u.payload, length(u.payload) AS payload_chars, COUNT(t.token) AS logins,
          MIN(t.created_at) AS first_login, MAX(t.created_at) AS last_login
        FROM users u LEFT JOIN tokens t ON t.name_key = u.name_key GROUP BY u.name_key`,
      )
      .toArray();
    return json({ users: toAdminStats(rows, new Date().toISOString().slice(0, 10)) });
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === '/admin') {
      return new Response(ADMIN_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
    }
    if (pathname.startsWith('/api/')) return env.USERS.get(env.USERS.idFromName('users')).fetch(req);
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
