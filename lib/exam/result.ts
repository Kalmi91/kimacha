// The level exam result (passed or not, best score, per level) is stored in the existing
// `game_progress` table, as the `level-exam` game, itemId = the level. No new table or migration,
// the save is per pair and level, and the backup (exportAll/importAll) carries it automatically.
// The DB classes (lib/database.ts AND lib/database.web.ts) call the same two helpers, so that
// the two implementations cannot drift apart.

import type { ExamResult, ExamResults } from './types';

export const EXAM_PROGRESS_KEY = 'level-exam';

type Row = { itemId: string; state: string; data: unknown };
type ProgressStore = {
  getGameProgress(gameId: string): Promise<Row[]>;
  setGameProgress(gameId: string, itemId: string, state: string, data?: unknown): Promise<void>;
};

function isResult(data: unknown): data is ExamResult {
  const d = data as Partial<ExamResult> | null | undefined;
  return !!d && typeof d.passed === 'boolean' && typeof d.best === 'number' && typeof d.last === 'number';
}

/** Merges a new attempt into the earlier result: the pass and the best score are not lost. */
export function mergeExamResult(prev: ExamResult | undefined, pct: number, passed: boolean, date: string): ExamResult {
  if (!prev) return { passed, best: pct, bestAt: date, last: pct, lastAt: date };
  const better = pct > prev.best;
  return {
    passed: prev.passed || passed,
    best: better ? pct : prev.best,
    bestAt: better ? date : prev.bestAt,
    last: pct,
    lastAt: date,
  };
}

export async function readExamResults(store: ProgressStore): Promise<ExamResults> {
  const out: ExamResults = {};
  for (const row of await store.getGameProgress(EXAM_PROGRESS_KEY)) {
    if (isResult(row.data)) out[row.itemId] = row.data;
  }
  return out;
}

export async function writeExamResult(
  store: ProgressStore,
  level: string,
  pct: number,
  passed: boolean,
  date: string,
): Promise<ExamResult> {
  const prev = (await readExamResults(store))[level];
  const next = mergeExamResult(prev, pct, passed, date);
  await store.setGameProgress(EXAM_PROGRESS_KEY, level, next.passed ? 'passed' : 'failed', next);
  return next;
}
