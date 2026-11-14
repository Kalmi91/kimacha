import type { AnswerLogEntry } from '../answerLogFormat';

export const FATIGUE_DETECTOR = {
  RUN_GAP_MS: 15 * 60_000, // A pause this long starts a new run.
  MAX_RUN_ANSWERS: 300, // Maximum answers read for run detection and offer recovery.
  BASELINE_ANSWERS: 8, // First answers in the run establish the learner's baseline pace.
  RECENT_ANSWERS: 8, // Latest answers used to measure fatigue.
  SLOWDOWN_RATIO: 1.5, // Recent median must reach this multiple of the baseline.
  MIN_RECENT_THINK_MS: 4_000, // Faster recent medians do not count as slowdown.
  SLOW_MIN_MISSES: 2, // Slowdown also requires this many recent misses.
  REPEAT_MISSES: 3, // This many repeated misses in the recent window mean difficulty.
  MAX_THINK_MS: 60_000, // Upper bound for each recorded thinking time.
  COOLDOWN_ANSWERS: 20, // Answers required after declining before another offer.
} as const;

export const FATIGUE_OFFER_KEY = 'fatigueOffer';
export interface FatigueOfferState { day: string; declinedAt: number | null }
export interface FatigueOffer { reason: 'repeat-misses' | 'slowdown' }

export function readFatigueOffer(value: unknown, day: string): FatigueOfferState {
  const empty = { day, declinedAt: null };
  if (!value || typeof value !== 'object') return empty;
  const v = value as Partial<FatigueOfferState>;
  if (v.day !== day || !(v.declinedAt === null || (typeof v.declinedAt === 'number' && Number.isFinite(v.declinedAt) && v.declinedAt >= 0))) return empty;
  return { day, declinedAt: v.declinedAt };
}

export function currentRun(entries: AnswerLogEntry[], now: number): AnswerLogEntry[] {
  const sorted = [...entries].sort((a, b) => a.at - b.at);
  if (!sorted.length || now - sorted[sorted.length - 1].at >= FATIGUE_DETECTOR.RUN_GAP_MS) return [];
  let start = sorted.length - 1;
  while (start > 0 && sorted[start].at - sorted[start - 1].at < FATIGUE_DETECTOR.RUN_GAP_MS) start--;
  return sorted.slice(start);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function detectFatigue(run: AnswerLogEntry[]): FatigueOffer | null {
  const recentStart = Math.max(0, run.length - FATIGUE_DETECTOR.RECENT_ANSWERS);
  const missed = new Set<string>();
  let repeats = 0;
  run.forEach((entry, index) => {
    if (entry.knew) return;
    if (index >= recentStart && missed.has(entry.itemId)) repeats++;
    missed.add(entry.itemId);
  });
  if (repeats >= FATIGUE_DETECTOR.REPEAT_MISSES) return { reason: 'repeat-misses' };
  if (run.length < FATIGUE_DETECTOR.BASELINE_ANSWERS + FATIGUE_DETECTOR.RECENT_ANSWERS) return null;
  const recent = run.slice(recentStart);
  const base = median(run.slice(0, FATIGUE_DETECTOR.BASELINE_ANSWERS).map(e => e.thinkMs));
  const fresh = median(recent.map(e => e.thinkMs));
  return fresh >= base * FATIGUE_DETECTOR.SLOWDOWN_RATIO && fresh >= FATIGUE_DETECTOR.MIN_RECENT_THINK_MS
    && recent.filter(e => !e.knew).length >= FATIGUE_DETECTOR.SLOW_MIN_MISSES ? { reason: 'slowdown' } : null;
}

export function shouldOfferFatigue(run: AnswerLogEntry[], state: FatigueOfferState,
  ctx: { enabled: boolean; tired: boolean; hasReview: boolean }): FatigueOffer | null {
  if (!ctx.enabled || ctx.tired || !ctx.hasReview) return null;
  if (state.declinedAt !== null && run.length && run[0].at <= state.declinedAt
    && run.filter(e => e.at > state.declinedAt!).length < FATIGUE_DETECTOR.COOLDOWN_ANSWERS) return null;
  return detectFatigue(run);
}
