import type { DB } from '@/lib/dbTypes';
import { addDays, pickSm2Session, type Sm2Card } from '@/lib/sm2';

export interface SrsDayState {
  srsDay: string;
  srsDayStepOn: string;
}

type SrsDayStore = Pick<DB, 'getSrsDay' | 'setSrsDay' | 'getNoPileUp'>;

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
  if (state.srsDayStepOn < calendarDay && !hasReviews) {
    return { srsDay: state.srsDay < calendarDay ? addDays(state.srsDay, 1) : calendarDay, srsDayStepOn: calendarDay };
  }
  return state;
}

/** Read only: Practice, Sentences and counters never advance the learning clock. */
export async function loadSrsDay(db: Pick<DB, 'getSrsDay' | 'getNoPileUp'>, calendarDay: string): Promise<string> {
  return await db.getNoPileUp() ? readSrsDay(await db.getSrsDay(), calendarDay).srsDay : calendarDay;
}

/** Only Learn calls this, after filtering cards to its current level and corpus. */
export async function advanceLearnSrsDay(db: SrsDayStore, calendarDay: string, cards: Sm2Card[], parked: readonly string[] = []): Promise<string> {
  if (!await db.getNoPileUp()) return calendarDay;
  const saved = await db.getSrsDay();
  const day = readSrsDay(saved, calendarDay).srsDay;
  const hasReviews = pickSm2Session(cards, [], day, 0).some((card) => !parked.includes(card.itemId));
  const next = stepSrsDay(saved, calendarDay, hasReviews);
  await db.setSrsDay(next);
  return next.srsDay;
}
