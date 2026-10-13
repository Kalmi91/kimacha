// The Practice tab's unfinished round, so it survives a tab switch and an app restart (spec
// HAROM-JATEK.md 5.1). One JSON string in user_meta.practice_round (db.getPracticeRound / setPracticeRound):
//   {"v":1,"date":"2026-10-12","target":"es","ids":["o33","o47"],"index":1,"results":["right",null]}
// ids = the task order (card ids), index = the current task, results = the answer given per task
// ('right' / 'wrong' / null = not answered yet). It is only resumed on the same local day and in the same
// direction; it is deleted when the round ends. Pure logic plus two thin DB wrappers.

import type { PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import type { GapTask } from '@/lib/practice/gapFill';

export type RoundAnswer = 'right' | 'wrong' | null;

export interface PracticeRound {
  v: 1;
  /** The local day the round was built (localDateString). */
  date: string;
  target: PcicTarget;
  ids: string[];
  index: number;
  results: RoundAnswer[];
}

/** A round read back for the screen. */
export interface ResumedRound {
  tasks: GapTask[];
  index: number;
  results: RoundAnswer[];
}

export function newPracticeRound(tasks: GapTask[], target: PcicTarget, date: string): PracticeRound {
  return { v: 1, date, target, ids: tasks.map((t) => t.itemId), index: 0, results: tasks.map(() => null) };
}

// A missing, broken or wrongly shaped value gives null (= no round to resume).
export function parsePracticeRound(raw: unknown): PracticeRound | null {
  if (typeof raw !== 'string' || raw === '') return null;
  let p: any;
  try {
    p = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object' || p.v !== 1) return null;
  if (typeof p.date !== 'string' || (p.target !== 'es' && p.target !== 'en')) return null;
  if (!Array.isArray(p.ids) || p.ids.length === 0 || !p.ids.every((id: unknown) => typeof id === 'string')) return null;
  if (!Number.isInteger(p.index) || p.index < 0 || p.index > p.ids.length) return null;
  if (!Array.isArray(p.results) || p.results.length !== p.ids.length) return null;
  if (!p.results.every((r: unknown) => r === 'right' || r === 'wrong' || r === null)) return null;
  return { v: 1, date: p.date, target: p.target, ids: p.ids, index: p.index, results: p.results };
}

// The saved round as the screen resumes it, or null when a new one has to be built: nothing saved, another
// day, another direction, or a saved word that has no task any more. A task answered right is done (its
// feedback was shown before the screen was left), so the round moves past it; it never gives a half or XP
// again. A task answered wrong is shown again in its answered state, waiting for Next.
export function restorePracticeRound(
  saved: PracticeRound | null,
  today: string,
  target: PcicTarget,
  taskFor: (itemId: string) => GapTask | null,
): ResumedRound | null {
  if (!saved || saved.date !== today || saved.target !== target) return null;
  const tasks: GapTask[] = [];
  for (const id of saved.ids) {
    const task = taskFor(id);
    if (!task) return null;
    tasks.push(task);
  }
  let index = saved.index;
  while (index < tasks.length && saved.results[index] === 'right') index++;
  return { tasks, index, results: saved.results };
}

export async function loadPracticeRound(): Promise<PracticeRound | null> {
  return parsePracticeRound(await getDb().getPracticeRound());
}

/** null deletes the saved round (the round ended). */
export async function savePracticeRound(round: PracticeRound | null): Promise<void> {
  await getDb().setPracticeRound(round ? JSON.stringify(round) : null);
}
