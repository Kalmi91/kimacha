import greetings from '@/data/listening/greetings-es.json';
import greetingsEn from '@/data/listening/greetings-en.json';
import type { PcicTarget } from '@/data/pcic';
import { shuffleNoFixedPoints } from '@/lib/shuffle';

// The "Greetings: listening" step of the Speak tab: a recording the learner listens to and a matching task (place <-> greeting).
// The content is data (data/listening/greetings-es.json, the pair count is not fixed); this file holds the type, the loader and the
// pure logic of the matching run (seeded shuffle, the reducer, the saved form). No I/O.

export interface ListeningPair {
  place: string;
  greeting: string;
}
export interface ListeningData {
  id: string;
  lang: string;
  level: string;
  /** The length of the recording in seconds (0 = not known). */
  durationSec: number;
  pairs: ListeningPair[];
}

export const GREETINGS: ListeningData = greetings;
export const GREETINGS_EN: ListeningData = greetingsEn;

/** The listening step of a target language (undefined = that target has none). */
export function listeningFor(target: PcicTarget): ListeningData | undefined {
  return target === 'es' ? GREETINGS : target === 'en' ? GREETINGS_EN : undefined;
}

/** The `game_progress` game of the finished listening steps (the item is the data id). */
export const LISTENING_PROGRESS_KEY = 'speech-listening';
export const LISTENING_RATE_KEY = 'speech-listen-rate';
export const LISTENING_RUN_KEY = 'speech-listen-run';
/** The resume key of the saved run per language (Spanish keeps the original key, so saved runs still work). */
export const runKeyFor = (lang: string): string => (lang === 'es' ? LISTENING_RUN_KEY : `${LISTENING_RUN_KEY}-${lang}`);

export const RATES: readonly number[] = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5];
export const DEFAULT_RATE = 1;

export const parseRate = (x: unknown): number => (typeof x === 'number' && RATES.includes(x) ? x : DEFAULT_RATE);

/** m:ss of a number of seconds (negative and non-numbers are 0:00). */
export function clock(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The pair indexes in the order of the right column: seeded, and with more than one pair never every pair next to its place. */
export function rightOrder(n: number, seed: number): number[] {
  return shuffleNoFixedPoints(n, seed);
}

export interface MatchRun {
  seed: number;
  /** The pair indexes matched so far, in the order they were matched. */
  matched: number[];
  mistakes: number;
}

export const newRun = (seed: number): MatchRun => ({ seed, matched: [], mistakes: 0 });

/** Place `left` and greeting `right` (both pair indexes) tapped together: the same index is a match, anything else a mistake. */
export function pick(run: MatchRun, left: number, right: number): { run: MatchRun; correct: boolean } {
  if (run.matched.includes(left) || run.matched.includes(right)) return { run, correct: false };
  if (left === right) return { run: { ...run, matched: [...run.matched, left] }, correct: true };
  return { run: { ...run, mistakes: run.mistakes + 1 }, correct: false };
}

export const isComplete = (run: MatchRun, n: number): boolean => n > 0 && run.matched.length >= n;

export const serializeRun = (run: MatchRun): MatchRun => ({ seed: run.seed, matched: [...run.matched], mistakes: run.mistakes });

/** A saved run back, or null when it is not one of this data (wrong shape, an index out of range, a pair twice). */
export function parseRun(raw: unknown, n: number): MatchRun | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<MatchRun>;
  if (!Number.isInteger(r.seed) || !Number.isInteger(r.mistakes) || (r.mistakes as number) < 0 || !Array.isArray(r.matched)) return null;
  const ok = r.matched.every((i) => Number.isInteger(i) && i >= 0 && i < n) && new Set(r.matched).size === r.matched.length;
  return ok ? { seed: r.seed as number, matched: [...r.matched], mistakes: r.mistakes as number } : null;
}
