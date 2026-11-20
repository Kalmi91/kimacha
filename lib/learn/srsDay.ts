import type { DB } from '@/lib/dbTypes';
import { addDays, pickSm2Session, type Sm2Card } from '@/lib/sm2';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';

export interface SrsDayState {
  srsDay: string;
  srsDayStepOn: string;
}

type SrsDayStore = Pick<DB, 'getSrsDay' | 'setSrsDay' | 'getNoPileUp' | 'getGameProgress' | 'setGameProgress' | 'getOnboarding'>;

// The noPileUp clock is kept per PCIC level (a resume value); the learn_settings columns are only the legacy seed.
const levelClockKey = (level: string) => `srs-day:${level}`;

function isDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;
}

export function readSrsDay(value: unknown, calendarDay: string): SrsDayState {
  const saved = value as Partial<SrsDayState> | null;
  if (!saved || !isDay(saved.srsDay) || !isDay(saved.srsDayStepOn)) {
    return { srsDay: calendarDay, srsDayStepOn: calendarDay };
  }
  return {
    srsDay: saved.srsDay > calendarDay ? calendarDay : saved.srsDay,
    srsDayStepOn: saved.srsDayStepOn > calendarDay ? calendarDay : saved.srsDayStepOn,
  };
}

export function stepSrsDay(value: unknown, calendarDay: string, hasReviews: boolean, enabled = true): SrsDayState {
  const state = readSrsDay(value, calendarDay);
  if (!enabled) return { srsDay: calendarDay, srsDayStepOn: calendarDay };
  if (state.srsDayStepOn >= calendarDay) return state;
  // The first Learn load of the calendar day decides the day's step, so finishing the leftover reviews
  // later the same day does not step the clock (the relearned cards would come back the same day).
  const stepped = state.srsDay < calendarDay ? addDays(state.srsDay, 1) : calendarDay;
  return { srsDay: hasReviews ? state.srsDay : stepped, srsDayStepOn: calendarDay };
}

/** Read only: Practice, Sentences and counters never advance the learning clock. */
export async function loadSrsDay(db: Pick<DB, 'getSrsDay' | 'getNoPileUp'> & Partial<SrsDayStore> & { getPcicLevel?: DB['getPcicLevel'] }, calendarDay: string): Promise<string> {
  if (!await db.getNoPileUp()) return calendarDay;
  const own = typeof db.getPcicLevel === 'function' && typeof db.getGameProgress === 'function'
    ? await loadResumeValue(db as DB, levelClockKey(await db.getPcicLevel())) : null;
  const legacy = await db.getSrsDay();
  const day = readSrsDay(own ?? legacy, calendarDay).srsDay;
  // The same legacy floor as advanceLearnSrsDay, so Practice never shows a lag that Learn would drop.
  return legacy && legacy.srsDay > day ? readSrsDay(legacy, calendarDay).srsDay : day;
}

/** Only Learn calls this, after filtering cards to its current level and corpus. With `level` the clock is that level's own. */
export async function advanceLearnSrsDay(db: SrsDayStore, calendarDay: string, cards: Sm2Card[], parked: readonly string[] = [], level?: string): Promise<string> {
  const legacy = await db.getSrsDay();
  const own = level === undefined ? null : await loadResumeValue(db as DB, levelClockKey(level));
  // A level without its own clock yet: seeded from the legacy value, not stepped today (its first load today decides the step).
  // The legacy columns are a floor for a level's own clock (a value set there after the level was seeded still applies).
  const floored = (v: SrsDayState): SrsDayState => (legacy && legacy.srsDay > v.srsDay ? { ...v, srsDay: readSrsDay(legacy, calendarDay).srsDay } : v);
  const saved: SrsDayState | null = level === undefined || own !== null ? (own !== null && level !== undefined ? floored(readSrsDay(own, calendarDay)) : legacy)
    : { srsDay: readSrsDay(legacy, calendarDay).srsDay, srsDayStepOn: addDays(calendarDay, -1) };
  const store = (value: SrsDayState) => level === undefined ? db.setSrsDay(value) : saveResumeValue(db as DB, levelClockKey(level), value);
  if (!await db.getNoPileUp()) {
    // While the setting is off the clock follows the calendar, so turning it back on does not bring back an old lag.
    const off = stepSrsDay(saved, calendarDay, false, false);
    if (saved?.srsDay !== off.srsDay || saved?.srsDayStepOn !== off.srsDayStepOn) await store(off);
    if (level !== undefined && (legacy?.srsDay !== off.srsDay || legacy?.srsDayStepOn !== off.srsDayStepOn)) await db.setSrsDay(off);
    return calendarDay;
  }
  const day = readSrsDay(saved, calendarDay).srsDay;
  const hasReviews = pickSm2Session(cards, [], day, 0).some((card) => !parked.includes(card.itemId));
  const next = stepSrsDay(saved, calendarDay, hasReviews);
  await store(next);
  return next.srsDay;
}
