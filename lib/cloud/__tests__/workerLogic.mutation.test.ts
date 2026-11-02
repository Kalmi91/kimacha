// Cases of cloud/logic.ts that the mutation run (`npm run test:mutation`) showed nobody checks: which entries of a stored
// progress payload usageSummary reads (only what has the documented shape), and the order toAdminStats gives. Each test states
// the right behavior from the doc comments of the functions, not the current output of one input. Pure logic: no store, no Worker.

import { toAdminStats, usageSummary } from '../../../cloud/logic';
import type { AdminUserRow, UsageSummary } from '../../../cloud/logic';

const TODAY = '2026-10-28';
const EMPTY_USAGE: UsageSummary = { pair: null, level: null, minutesTotal: 0, minutes7d: 0, activeDays: 0, lastActiveDay: null, xpTotal: 0, streak: 0, longestStreak: 0 };

// A cloud payload (`{ v, store, resume }`) around a hand-written web state; `store` is a string inside the payload.
const payloadOf = (state: Record<string, unknown>) => JSON.stringify({ v: 1, store: JSON.stringify({ v: 1, ...state }), resume: {} });
// The same with the state text written by hand (JSON.stringify cannot write 1e999 or a number the way a hand-edited backup has it).
const payloadOfText = (storeText: string) => JSON.stringify({ v: 1, store: storeText, resume: {} });

describe('usageSummary reads a stored payload only where it has the documented shape', () => {
  it('does not read a store that is an array holding the JSON text instead of the text itself', () => {
    const state = JSON.stringify({ usageMinutes: [[TODAY, 5]], streak: { current_count: 3, last_date: TODAY, longest_count: 3 } });
    expect(usageSummary(JSON.stringify({ v: 1, store: [state], resume: {} }), TODAY)).toEqual(EMPTY_USAGE);
  });

  it('skips an entry that is not a [string, value] pair: an object with numeric keys, a pair whose key is not a string', () => {
    const sum = usageSummary(payloadOf({ usageMinutes: [{ 0: '2026-10-27', 1: 5 }, [5, 3]], dailyXp: [{ 0: '2026-10-27', 1: 50 }, [5, 30]] }), TODAY);
    expect(sum).toEqual(EMPTY_USAGE);
  });

  it('skips a number that is not finite (1e999 is Infinity once parsed), so the admin figures stay numbers', () => {
    const sum = usageSummary(payloadOfText('{"usageMinutes":[["2026-10-27",1e999],["2026-10-28",2]],"dailyXp":[["2026-10-28",1e999]]}'), TODAY);
    expect(sum).toMatchObject({ minutesTotal: 2, minutes7d: 2, activeDays: 1, lastActiveDay: '2026-10-28', xpTotal: 0 });
  });

  it('takes the onboarding pair only when the source and the target are both strings', () => {
    expect(usageSummary(payloadOf({ onboarding: { source: 5, target: 'es' } }), TODAY).pair).toBeNull();
    expect(usageSummary(payloadOf({ onboarding: { source: 'en', target: 5 } }), TODAY).pair).toBeNull();
    expect(usageSummary(payloadOf({ onboarding: { source: 'en', target: 'es' } }), TODAY).pair).toBe('en→es');
  });

  it('takes a level only when it is a string', () => {
    expect(usageSummary(payloadOf({ userLevels: [['es-en', { level: 7 }]] }), TODAY).level).toBeNull();
    expect(usageSummary(payloadOf({ userLevels: [['es-en', {}]] }), TODAY).level).toBeNull();
    expect(usageSummary(payloadOf({ onboarding: { source: 'es', target: 'en' }, userLevels: [['es-en', { level: 7 }]] }), TODAY).level).toBeNull();
  });

  it('takes the streak counts only when they are numbers', () => {
    const sum = usageSummary(payloadOf({ streak: { current_count: '3', last_date: TODAY, longest_count: '7' } }), TODAY);
    expect(sum.streak).toBe(0);
    expect(sum.longestStreak).toBe(0);
  });

  it('takes the latest active day whatever the order of the entries', () => {
    const sum = usageSummary(payloadOf({ usageMinutes: [['2026-10-27', 2], ['2026-10-20', 4], ['2026-10-25', 1]] }), TODAY);
    expect(sum.lastActiveDay).toBe('2026-10-27');
    expect(sum.activeDays).toBe(3);
  });
});

describe('toAdminStats order', () => {
  const row = (over: Partial<AdminUserRow>): AdminUserRow => ({ display_name: 'x', updated_at: null, payload: null, payload_chars: null, logins: 0, first_login: null, last_login: null, ...over });
  const loginAt = (day: number) => Date.parse(`2026-10-${String(day).padStart(2, '0')}T12:00:00Z`);
  const names = (rows: AdminUserRow[]) => toAdminStats(rows, TODAY).map((s) => s.name);

  it('puts the most recent activity first whichever way the rows come in', () => {
    const days = [3, 20, 11, 27, 8];
    const rows = days.map((d) => row({ display_name: `d${d}`, last_login: loginAt(d) }));
    const expected = ['d27', 'd20', 'd11', 'd8', 'd3'];
    expect(names(rows)).toEqual(expected);
    expect(names([...rows].sort((a, b) => a.last_login! - b.last_login!))).toEqual(expected);
    expect(names([...rows].sort((a, b) => b.last_login! - a.last_login!))).toEqual(expected);
  });

  it('keeps the input order of accounts with the same activity, and of those with none, also in a long list', () => {
    const rows: AdminUserRow[] = [];
    for (let i = 0; i < 40; i++) rows.push(row({ display_name: `u${String(i).padStart(2, '0')}`, last_login: i % 4 === 3 ? null : loginAt(10 + (i % 4)) }));
    const group = (pick: (r: AdminUserRow) => boolean) => rows.filter(pick).map((r) => r.display_name);
    const expected = [...group((r) => r.last_login === loginAt(12)), ...group((r) => r.last_login === loginAt(11)), ...group((r) => r.last_login === loginAt(10)), ...group((r) => r.last_login === null)];
    expect(names(rows)).toEqual(expected);
  });
});
