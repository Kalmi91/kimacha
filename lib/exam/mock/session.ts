// Part-by-part saving of the practice exam and the result.
// It writes into the existing `game_progress` table under the `mock-exam` game key (no new table or
// migration, the backup carries it automatically, see the pattern of lib/exam/result.ts):
//   - `<direction>-<level>-session`: the abandoned exam (core + the answers of the finished papers)
//   - `<direction>-<level>`: the latest result (the Stats "Practice exam" card shows this)
// We save paper by paper: the answers of a finished paper are kept, an abandoned paper starts over.

import type { MockResult } from './score';
import type { MockAnswers, MockLevel, MockTarget } from './types';

export const MOCK_EXAM_PROGRESS_KEY = 'mock-exam';

export interface MockSession {
  /** The core of the task set: the same exam is built from the same core (lib/exam/mock/build.ts). */
  seed: number;
  /** The fingerprint of the task set: resumable only on a match (changed vocabulary = new exam). */
  sig: string;
  /** Ids of the papers already closed (lib/exam/mock/types.ts MockPaper.id). */
  done: string[];
  /** The answers to the tasks of the closed papers. */
  answers: MockAnswers;
}

export interface MockLast {
  passed: boolean;
  /** True if speaking was a placeholder. */
  provisional: boolean;
  /** YYYY-MM-DD. */
  date: string;
  /** The numbers of the pass rule: per group, or a single entry from the total score / the average percentage. */
  groups: { points: number; needed: number; of: number }[];
}

export type MockOverview = Partial<Record<MockLevel, { last?: MockLast; session?: MockSession }>>;

type Row = { itemId: string; state: string; data: unknown };
type ProgressStore = {
  getGameProgress(gameId: string): Promise<Row[]>;
  setGameProgress(gameId: string, itemId: string, state: string, data?: unknown): Promise<void>;
};

const lastId = (target: MockTarget, level: MockLevel) => `${target}-${level}`;
const sessionId = (target: MockTarget, level: MockLevel) => `${target}-${level}-session`;

function isSession(data: unknown): data is MockSession {
  const d = data as Partial<MockSession> | null | undefined;
  return !!d && typeof d.seed === 'number' && typeof d.sig === 'string' && Array.isArray(d.done) && !!d.answers && typeof d.answers === 'object';
}

function isLast(data: unknown): data is MockLast {
  const d = data as Partial<MockLast> | null | undefined;
  return !!d && typeof d.passed === 'boolean' && typeof d.date === 'string' && Array.isArray(d.groups);
}

/** The saved state of all levels of the direction (for the Stats card in a single read). */
export async function readMockOverview(store: ProgressStore, target: MockTarget, levels: readonly MockLevel[]): Promise<MockOverview> {
  const rows = await store.getGameProgress(MOCK_EXAM_PROGRESS_KEY);
  const out: MockOverview = {};
  for (const level of levels) {
    const last = rows.find((r) => r.itemId === lastId(target, level))?.data;
    const session = rows.find((r) => r.itemId === sessionId(target, level))?.data;
    out[level] = { ...(isLast(last) ? { last } : {}), ...(isSession(session) ? { session } : {}) };
  }
  return out;
}

export async function saveMockSession(store: ProgressStore, target: MockTarget, level: MockLevel, session: MockSession): Promise<void> {
  await store.setGameProgress(MOCK_EXAM_PROGRESS_KEY, sessionId(target, level), 'open', session);
}

export async function clearMockSession(store: ProgressStore, target: MockTarget, level: MockLevel): Promise<void> {
  await store.setGameProgress(MOCK_EXAM_PROGRESS_KEY, sessionId(target, level), 'done', null);
}

function lastFromResult(result: MockResult, date: string): MockLast {
  return {
    passed: result.passed,
    provisional: result.provisional,
    date,
    groups:
      result.rule.kind === 'groups'
        ? result.rule.groups.map((g) => ({ points: g.points, needed: g.needed, of: g.of }))
        : result.rule.kind === 'total'
          ? [{ points: result.rule.points, needed: result.rule.needed, of: result.rule.of }]
          : [{ points: result.rule.pct, needed: result.rule.passPct, of: 100 }],
  };
}

export async function saveMockLast(store: ProgressStore, target: MockTarget, level: MockLevel, result: MockResult, date: string): Promise<MockLast> {
  const last = lastFromResult(result, date);
  await store.setGameProgress(MOCK_EXAM_PROGRESS_KEY, lastId(target, level), last.passed ? 'passed' : 'failed', last);
  return last;
}

// --- Clock: computed from a timestamp, not from a tick counter, so that an app sent to the background does not drift.

/** How many seconds are left of a paper (never goes below 0). */
export function secondsLeft(startedAt: number, minutes: number, now: number): number {
  return Math.max(0, Math.ceil((startedAt + minutes * 60_000 - now) / 1000));
}

/** m:ss. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Below this many remaining seconds the clock gets a warning colour. */
export const CLOCK_WARNING_SECONDS = 60;
