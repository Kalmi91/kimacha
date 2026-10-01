// PLAN-vizsga A. szakasz 2. lépés (A6 a): a szintvizsga eredménye (átment-e,
// legjobb pontszám, szintenként) a meglévő `game_progress` táblában tárolódik,
// `level-exam` játékként, itemId = a szint. Nincs új tábla és migráció, a mentés
// pár-szintű, és a backup (exportAll/importAll) magától viszi. A DB-osztályok
// (lib/database.ts ÉS lib/database.web.ts) ugyanezt a két segédet hívják, hogy
// a két megvalósítás ne csúszhasson el egymástól.

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

/** Új próba beolvasztása a korábbi eredménybe: az átmenés és a legjobb pontszám nem vész el. */
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
