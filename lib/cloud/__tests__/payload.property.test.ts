import * as fc from 'fast-check';
import { MAX_PAYLOAD_CHARS, parsePayload, toAdminStats, usageSummary } from '../../../cloud/logic';
import type { AdminUserRow } from '../../../cloud/logic';
import { MemoryStore } from '@/lib/database.web';

// Property tests of the cloud payload handling: the size rule of parsePayload, the usage figures the admin page reads
// out of a stored payload, and the web state (de)serialization the payload carries. The seed is fixed so CI is
// deterministic; FC_SEED=<n> searches elsewhere.
const RUN = { numRuns: 300, seed: Number(process.env.FC_SEED ?? 20261101) };

const ymdOf = (dayOffset: number) => new Date(Date.UTC(2020, 0, 1 + dayOffset)).toISOString().slice(0, 10);
const dayArb = fc.integer({ min: 0, max: 365 * 12 }).map(ymdOf);
const TODAY = '2026-10-28';

const text = (n: number, unit: string) => unit.repeat(Math.ceil(n / unit.length)).slice(0, n);

describe('parsePayload properties', () => {
  it('hands any string up to the limit back unchanged, also after the JSON wire trip', () => {
    const strings = fc.oneof(fc.string({ unit: 'binary', maxLength: 2000 }), fc.string({ unit: 'grapheme', maxLength: 500 }), fc.json());
    fc.assert(
      fc.property(strings, (payload) => {
        const wire = JSON.parse(JSON.stringify({ payload }));
        expect(parsePayload({ payload })).toEqual({ ok: true, payload });
        expect(parsePayload(wire)).toEqual({ ok: true, payload });
      }),
      RUN
    );
  });

  it('accepts exactly the strings of at most MAX_PAYLOAD_CHARS characters and answers 413 above that', () => {
    fc.assert(
      fc.property(fc.integer({ min: -3, max: 3 }), fc.constantFrom('x', 'é', '€', '😀'), (offset, unit) => {
        const payload = text(MAX_PAYLOAD_CHARS + offset, unit);
        expect(payload.length).toBe(MAX_PAYLOAD_CHARS + offset);
        expect(parsePayload({ payload })).toEqual(offset <= 0 ? { ok: true, payload } : { ok: false, status: 413, error: 'too_large' });
      }),
      { ...RUN, numRuns: 28 }
    );
  });

  it('never throws on any body: a string payload is taken, everything else is a clean 400 bad_input', () => {
    const bodies = fc.anything({ withNullPrototype: true, withBigInt: true, withDate: true, withMap: true, withSet: true, withBoxedValues: true, withTypedArray: true, withSparseArray: true });
    fc.assert(
      fc.property(bodies, (body) => {
        const result = parsePayload(body);
        const isRecord = typeof body === 'object' && body !== null && !Array.isArray(body);
        const payload = isRecord ? (body as Record<string, unknown>).payload : undefined;
        if (typeof payload === 'string') expect(result).toEqual(payload.length > MAX_PAYLOAD_CHARS ? { ok: false, status: 413, error: 'too_large' } : { ok: true, payload });
        else expect(result).toEqual({ ok: false, status: 400, error: 'bad_input' });
      }),
      RUN
    );
  });
});

// A stored payload `{ v, store, resume }` around a web state given as the object it holds.
const payloadOf = (state: unknown) => JSON.stringify({ v: 1, store: JSON.stringify(state), resume: {} });
const COUNTERS = ['minutesTotal', 'minutes7d', 'activeDays', 'xpTotal', 'streak', 'longestStreak'] as const;

describe('usageSummary properties', () => {
  const minutesArb = fc.uniqueArray(fc.tuple(dayArb, fc.integer({ min: 0, max: 1000 })), { selector: (e) => e[0], maxLength: 40 });
  const xpArb = fc.uniqueArray(fc.tuple(dayArb, fc.integer({ min: 0, max: 100_000 })), { selector: (e) => e[0], maxLength: 40 });

  it('adds up what a well-formed state holds', () => {
    fc.assert(
      fc.property(minutesArb, xpArb, (minutes, xp) => {
        const sum = usageSummary(payloadOf({ v: 1, usageMinutes: minutes, dailyXp: xp }), TODAY);
        const from = '2026-10-22'; // TODAY minus 6 days; no upper bound
        const active = minutes.filter(([, m]) => m > 0);
        expect(sum.minutesTotal).toBe(minutes.reduce((a, [, m]) => a + m, 0));
        expect(sum.minutes7d).toBe(minutes.filter(([d]) => d >= from).reduce((a, [, m]) => a + m, 0));
        expect(sum.activeDays).toBe(active.length);
        expect(sum.lastActiveDay).toBe(active.length ? active.map(([d]) => d).sort().pop() : null);
        expect(sum.xpTotal).toBe(Math.round(xp.reduce((a, [, t]) => a + t, 0) / 10));
      }),
      RUN
    );
  });

  it('is independent of the order of the entries', () => {
    fc.assert(
      fc.property(minutesArb, xpArb, fc.nat(), (minutes, xp, rot) => {
        const turn = <T>(a: T[]): T[] => (a.length ? [...a.slice(rot % a.length), ...a.slice(0, rot % a.length)] : a);
        expect(usageSummary(payloadOf({ v: 1, usageMinutes: turn(minutes), dailyXp: turn(xp) }), TODAY)).toEqual(usageSummary(payloadOf({ v: 1, usageMinutes: minutes, dailyXp: xp }), TODAY));
      }),
      RUN
    );
  });

  it('does not throw on any string, nor on a payload with any JSON in the fields it reads', () => {
    const junk = fc.jsonValue();
    const states = fc.record({ onboarding: junk, userLevels: junk, usageMinutes: junk, dailyXp: junk, streak: junk }, { requiredKeys: [] });
    const payloads = fc.oneof(fc.string({ unit: 'binary', maxLength: 300 }), fc.json(), states.map((s) => payloadOf({ v: 1, ...s })), states.map((s) => JSON.stringify({ v: 1, store: s, resume: {} })));
    fc.assert(
      fc.property(payloads, (payload) => {
        const sum = usageSummary(payload, TODAY);
        expect(Object.keys(sum).sort()).toEqual(['activeDays', 'lastActiveDay', 'level', 'longestStreak', 'minutes7d', 'minutesTotal', 'pair', 'streak', 'xpTotal']);
        for (const k of ['pair', 'level', 'lastActiveDay'] as const) expect(sum[k] === null || typeof sum[k] === 'string').toBe(true);
        for (const k of COUNTERS) expect(typeof sum[k]).toBe('number');
      }),
      RUN
    );
  });

  // FINDING D2-1 (skipped: red = the bug; see report-d2.md). The figures end up in the admin JSON: an Infinity there
  // turns into null / breaks the page. Remove the .skip when usageSummary no longer overflows.
  it.skip('keeps every counter a finite number, whatever huge values the fields hold', () => {
    const huge = fc.double({ noNaN: true, noDefaultInfinity: true, min: 1e300, max: Number.MAX_VALUE });
    fc.assert(
      fc.property(fc.array(fc.tuple(dayArb, huge), { minLength: 2, maxLength: 5 }), (entries) => {
        const keyed = entries.map(([d, v], i) => [`${d}-${i}`, v]);
        const sum = usageSummary(payloadOf({ v: 1, usageMinutes: keyed, dailyXp: keyed }), TODAY);
        for (const k of COUNTERS) expect(Number.isFinite(sum[k])).toBe(true);
      }),
      RUN
    );
  });

  // FINDING D2-2 (skipped: red = the bug; see report-d2.md). JSON.parse('1e999') is Infinity and typeof says number.
  it.skip.each(['1e999', '-1e999'])('keeps the streak finite when the stored count is the numeral %s', (numeral) => {
    const store = `{"v":1,"streak":{"current_count":${numeral},"last_date":"${TODAY}","longest_count":${numeral}}}`;
    const sum = usageSummary(JSON.stringify({ v: 1, store, resume: {} }), TODAY);
    expect(Number.isFinite(sum.streak)).toBe(true);
    expect(Number.isFinite(sum.longestStreak)).toBe(true);
  });
});

describe('toAdminStats properties', () => {
  const rowArb = fc.record({
    display_name: fc.string({ maxLength: 12 }),
    updated_at: fc.option(fc.oneof(fc.integer({ min: 0, max: 4_000_000_000_000 }).map((ms) => new Date(ms).toISOString()), fc.string({ maxLength: 10 })), { nil: null }),
    payload: fc.option(fc.string({ unit: 'binary', maxLength: 80 }), { nil: null }),
    payload_chars: fc.option(fc.nat({ max: 1_000_000 }), { nil: null }),
    logins: fc.nat({ max: 1000 }),
    first_login: fc.option(fc.integer({ min: 0, max: 4_000_000_000_000 }), { nil: null }),
    last_login: fc.option(fc.integer({ min: 0, max: 4_000_000_000_000 }), { nil: null }),
  });

  it('keeps every account, most recent activity first, and never throws', () => {
    fc.assert(
      fc.property(fc.array(rowArb, { maxLength: 15 }), (generated) => {
        const rows: AdminUserRow[] = generated.map((r, i) => ({ ...r, display_name: `${i}:${r.display_name}` }));
        const stats = toAdminStats(rows, TODAY);
        expect(stats).toHaveLength(rows.length);
        const activity = (name: string) => {
          const r = rows[Number(name.split(':')[0])];
          const save = r.updated_at === null ? NaN : Date.parse(r.updated_at);
          return Math.max(r.last_login ?? -Infinity, Number.isNaN(save) ? -Infinity : save);
        };
        const order = stats.map((s) => activity(s.name));
        for (let i = 1; i < order.length; i++) expect(order[i - 1] >= order[i]).toBe(true);
        expect(stats.map((s) => s.name.split(':')[0]).sort()).toEqual(rows.map((_, i) => String(i)).sort());
        for (const s of stats) {
          expect(Number.isInteger(s.progressKb) && s.progressKb >= 0).toBe(true);
          expect(s).not.toHaveProperty('payload');
        }
      }),
      RUN
    );
  });
});

// A state exactly as serializeState writes it (every field, Maps as [key, value][] with unique keys).
const entries = <T>(value: fc.Arbitrary<T>) => fc.uniqueArray(fc.tuple(fc.string({ maxLength: 10 }), value), { selector: (e) => e[0], maxLength: 5 });
const json = fc.jsonValue();
const stateArb = fc.record({
  v: fc.constant(1),
  streak: fc.record({ current_count: fc.nat(), last_date: fc.option(dayArb, { nil: null }), longest_count: fc.nat() }),
  onboarding: fc.option(fc.record({ source: fc.string({ maxLength: 4 }), target: fc.string({ maxLength: 4 }) }), { nil: null }),
  userLevels: entries(json),
  meta: fc.record({ last_open_date: json, status_bar_tint: json, grammar_palette: json, skin: json, skin_mix: json, theme_mode: json, beta_flags: json, practice_round: json }),
  userMeta: fc.record({ userId: fc.string({ maxLength: 12 }), firstUseDate: fc.string({ maxLength: 24 }), lastSyncDate: fc.option(fc.string({ maxLength: 24 }), { nil: null }) }),
  settings: entries(json),
  usageMinutes: entries(fc.nat()),
  dailyXp: entries(fc.nat()),
  gameProgress: entries(entries(fc.record({ state: fc.string({ maxLength: 6 }), data: json }))),
  pcicCards: entries(json),
  mistakeBatches: entries(json),
  mistakeCards: entries(json),
});

describe('MemoryStore state properties', () => {
  it('serializeState writes back exactly the state restoreState read', () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        const raw = JSON.stringify(state);
        const store = new MemoryStore();
        store.restoreState(raw);
        expect(JSON.parse(store.serializeState())).toEqual(JSON.parse(raw));
        // and a second trip changes nothing
        const again = new MemoryStore();
        again.restoreState(store.serializeState());
        expect(again.serializeState()).toBe(store.serializeState());
      }),
      RUN
    );
  });

  it('answers a state that is not one with an Error and leaves the store as it was', () => {
    const sample = fc.sample(stateArb, { numRuns: 1, seed: RUN.seed })[0];
    const mutated = fc
      .tuple(fc.constantFrom(...Object.keys(sample)), json)
      .map(([key, value]) => JSON.stringify({ ...sample, [key]: value }));
    const raws = fc.oneof(fc.string({ unit: 'binary', maxLength: 200 }), json.map((j) => JSON.stringify(j)), mutated);
    fc.assert(
      fc.property(raws, (raw) => {
        const store = new MemoryStore();
        store.restoreState(JSON.stringify(sample));
        const before = store.serializeState();
        try {
          store.restoreState(raw);
        } catch (e) {
          expect(e).toBeInstanceOf(Error);
          expect(store.serializeState()).toBe(before);
          return;
        }
        // accepted: it is a state like any other, it can be written out and read in again
        new MemoryStore().restoreState(store.serializeState());
      }),
      RUN
    );
  });
});
