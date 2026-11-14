import { currentRun, detectFatigue, FATIGUE_DETECTOR as F, readFatigueOffer, shouldOfferFatigue } from '../fatigueDetector';
import type { AnswerLogEntry } from '../../answerLog';

const entry = (at: number, itemId = String(at), knew = true, thinkMs: number = F.MIN_RECENT_THINK_MS): AnswerLogEntry =>
  ({ at, pair: 'en-es', itemId, knew, thinkMs });
const repeated = (misses: number = F.REPEAT_MISSES) => Array.from({ length: misses + 1 }, (_, i) => entry(i, 'same', false));
const slow = () => [
  ...Array.from({ length: F.BASELINE_ANSWERS }, (_, i) => entry(i, `b${i}`, true, F.MIN_RECENT_THINK_MS)),
  ...Array.from({ length: F.RECENT_ANSWERS }, (_, i) => entry(F.BASELINE_ANSWERS + i, `r${i}`, i >= F.SLOW_MIN_MISSES, F.MIN_RECENT_THINK_MS * F.SLOWDOWN_RATIO)),
];
const ctx = { enabled: true, tired: false, hasReview: true };
const state = { day: 'today', declinedAt: null };

it('sorts entries and cuts at exact gap boundaries, including now', () => {
  const rows = [entry(F.RUN_GAP_MS + 1), entry(0), entry(1)];
  expect(currentRun(rows, F.RUN_GAP_MS + 1)).toEqual([rows[0]]);
  expect(currentRun([entry(0), entry(F.RUN_GAP_MS - 1)], F.RUN_GAP_MS)).toHaveLength(2);
  expect(currentRun([entry(0)], F.RUN_GAP_MS)).toEqual([]);
  expect(currentRun([], 0)).toEqual([]);
  expect(rows[0].at).toBe(F.RUN_GAP_MS + 1);
});
it('counts repeated misses, including the first miss before the recent window', () => {
  expect(detectFatigue(repeated(F.REPEAT_MISSES - 1))).toBeNull();
  expect(detectFatigue(repeated())).toEqual({ reason: 'repeat-misses' });
  const rows = [entry(0, 'same', false), ...Array.from({ length: F.RECENT_ANSWERS }, (_, i) => entry(i + 1, i < F.REPEAT_MISSES ? 'same' : `ok${i}`, i >= F.REPEAT_MISSES))];
  expect(detectFatigue(rows)).toEqual({ reason: 'repeat-misses' });
  expect(detectFatigue(Array.from({ length: F.RECENT_ANSWERS }, (_, i) => entry(i, String(i), false)))).toBeNull();
});
it('requires every slowdown boundary', () => {
  expect(detectFatigue(slow())).toEqual({ reason: 'slowdown' });
  expect(detectFatigue(slow().slice(1))).toBeNull();
  expect(detectFatigue(slow().map((e, i) => i < F.BASELINE_ANSWERS ? e : { ...e, thinkMs: e.thinkMs - 1 }))).toBeNull();
  expect(detectFatigue(slow().map((e, i) => ({ ...e, thinkMs: i < F.BASELINE_ANSWERS ? 1 : F.MIN_RECENT_THINK_MS - 1 })))).toBeNull();
  expect(detectFatigue(slow().map((e, i) => i === F.BASELINE_ANSWERS ? { ...e, knew: true } : e))).toBeNull();
  expect(detectFatigue([])).toBeNull();
});
it('prefers repeated misses when slowdown is also true', () => {
  const rows = slow();
  rows[0] = { ...rows[0], itemId: 'same', knew: false };
  rows.splice(F.BASELINE_ANSWERS, F.REPEAT_MISSES, ...rows.slice(F.BASELINE_ANSWERS, F.BASELINE_ANSWERS + F.REPEAT_MISSES).map(e => ({ ...e, itemId: 'same', knew: false })));
  expect(detectFatigue(rows)).toEqual({ reason: 'repeat-misses' });
});
it('gates offers and counts cooldown only in the current run', () => {
  const rows = repeated();
  expect(shouldOfferFatigue(rows, state, ctx)).toEqual({ reason: 'repeat-misses' });
  expect(shouldOfferFatigue(rows, state, { ...ctx, enabled: false })).toBeNull();
  expect(shouldOfferFatigue(rows, state, { ...ctx, tired: true })).toBeNull();
  expect(shouldOfferFatigue(rows, state, { ...ctx, hasReview: false })).toBeNull();
  const declined = { ...state, declinedAt: 0 };
  const cooldown = Array.from({ length: F.COOLDOWN_ANSWERS + 1 }, (_, i) => entry(i, 'same', false));
  expect(shouldOfferFatigue(cooldown.slice(0, -1), declined, ctx)).toBeNull();
  expect(shouldOfferFatigue(cooldown, declined, ctx)).toEqual({ reason: 'repeat-misses' });
  expect(shouldOfferFatigue(rows.map(e => ({ ...e, at: e.at + F.RUN_GAP_MS })), declined, ctx)).toEqual({ reason: 'repeat-misses' });
});
it.each([null, {}, { day: 'yesterday', declinedAt: 0 }, { day: 'today', declinedAt: 'bad' }, { day: 'today', declinedAt: NaN }])('rejects stale or malformed offer state %p', value => {
  expect(readFatigueOffer(value, 'today')).toEqual(state);
});
it('reads valid offer state', () => expect(readFatigueOffer({ ...state, declinedAt: 0 }, 'today')).toEqual({ ...state, declinedAt: 0 }));
