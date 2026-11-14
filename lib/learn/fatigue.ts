import { mixNewCards, type QueuedSm2Card } from '@/lib/pcicSession';
import type { DB } from '@/lib/dbTypes';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';

export const FATIGUE_KEY = 'fatigue';

export interface FatigueState {
  day: string;
  tired: boolean;
  misses: Record<string, number>;
  parked: string[];
}

export interface FatigueOptions {
  tiredButton: boolean;
  missCap: boolean;
  keepFirst?: boolean;
  // Session callers request the existing normal ordering here, so every queue build has one entry point.
  mixNew?: boolean;
}

export const emptyFatigue = (day: string): FatigueState => ({ day, tired: false, misses: {}, parked: [] });

export function readFatigue(value: unknown, day: string): FatigueState {
  if (!value || typeof value !== 'object') return emptyFatigue(day);
  const v = value as Partial<FatigueState>;
  if (v.day !== day || typeof v.tired !== 'boolean' || !v.misses || typeof v.misses !== 'object' || Array.isArray(v.misses)
    || !Object.values(v.misses).every((n) => Number.isSafeInteger(n) && n >= 0)
    || !Array.isArray(v.parked) || !v.parked.every((id) => typeof id === 'string')) return emptyFatigue(day);
  return { day, tired: v.tired, misses: { ...v.misses }, parked: [...v.parked] };
}

export async function clearFatigueMisses(db: DB): Promise<void> {
  const saved = await loadResumeValue(db, FATIGUE_KEY);
  if (!saved || typeof saved !== 'object' || !('day' in saved) || typeof saved.day !== 'string') return;
  const state = readFatigue(saved, saved.day);
  await saveResumeValue(db, FATIGUE_KEY, { ...state, misses: {}, parked: [] });
}

export function recordMiss(value: FatigueState, day: string, itemId: string): FatigueState {
  const state = readFatigue(value, day);
  const n = (state.misses[itemId] ?? 0) + 1;
  return { ...state, misses: { ...state.misses, [itemId]: n },
    parked: n >= 4 && !state.parked.includes(itemId) ? [...state.parked, itemId] : state.parked };
}

export function undoMiss(value: FatigueState, day: string, itemId: string, parkedByGrade: boolean): FatigueState {
  const state = readFatigue(value, day);
  const misses = { ...state.misses };
  const n = Math.max(0, (misses[itemId] ?? 0) - 1);
  if (n === 0) delete misses[itemId];
  else misses[itemId] = n;
  return { ...state, misses, parked: parkedByGrade ? state.parked.filter((id) => id !== itemId) : state.parked };
}

export const isFatigueReview = (card: QueuedSm2Card, day: string): boolean => card.state !== 'new' && card.introducedAt !== day;

/** A separate queue-only layer: never changes cards or their scheduler state. */
export function arrangeQueue(queue: QueuedSm2Card[], day: string, value: FatigueState, opts: FatigueOptions): QueuedSm2Card[] {
  const state = value.day === day ? value : emptyFatigue(day);
  const base = opts.missCap && state.parked.length > 0 ? queue.filter((c) => !state.parked.includes(c.itemId)) : queue;
  if (!opts.tiredButton || !state.tired) return opts.mixNew ? mixNewCards(base, day) : base;
  const head = opts.keepFirst ? base.slice(0, 1) : [];
  const rest = opts.keepFirst ? base.slice(1) : base;
  const ordinary = (c: QueuedSm2Card) => isFatigueReview(c, day) && c.returnAt === undefined;
  const sorted = rest.filter(ordinary).sort((a, b) => b.interval - a.interval || b.ease - a.ease || a.lapses - b.lapses);
  let index = 0;
  const ordered = rest.map((c) => ordinary(c) ? sorted[index++] : c);
  return [...head, ...ordered.filter((c) => c.state !== 'new'), ...ordered.filter((c) => c.state === 'new')];
}
