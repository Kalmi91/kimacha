// PLAN-vizsga A. szakasz (Kálmán, 2026-10-01, A3 a): az átmenés 80%, ugyanaz,
// mint a feloldás küszöbe és a nyelvtani lecke küszöbe. Egész számokkal számol,
// hogy 79,9% soha ne kerekedjen 80-ra.

import type { ExamItemResult, ExamSkill } from './types';

export const EXAM_PASS_PCT = 80;

export interface ExamScore {
  correct: number;
  total: number;
  /** Egész százalék, lefelé kerekítve (79,9 -> 79). */
  pct: number;
  passed: boolean;
  /** Készségenként (A4 eredmény-lap, későbbi lépés); csak a szerepelt készségek kulcsai vannak meg. */
  bySkill: Partial<Record<ExamSkill, { correct: number; total: number }>>;
}

export function examPassed(correct: number, total: number): boolean {
  return total > 0 && correct * 100 >= total * EXAM_PASS_PCT;
}

export function scoreExam(results: ExamItemResult[]): ExamScore {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const bySkill: ExamScore['bySkill'] = {};
  for (const r of results) {
    const entry = bySkill[r.item.skill] ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (r.correct) entry.correct += 1;
    bySkill[r.item.skill] = entry;
  }
  return {
    correct,
    total,
    pct: total > 0 ? Math.floor((correct * 100) / total) : 0,
    passed: examPassed(correct, total),
    bySkill,
  };
}
