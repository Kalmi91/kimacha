// az eredmény-lap készségenként
// (szó, nyelvtan, olvasás, szóbeli): pont és %, "erős" vagy "gyenge" (gyenge = a készség % az átmenési
// küszöb alatt), és a gyenge nyelvtanhoz a leggyakrabban elrontott leckék (lecke-link). Tiszta
// függvények, a képernyő (app/exam.tsx) csak megjeleníti.

import { examPassed, type ExamScore } from './score';
import type { ExamItemResult, ExamSkill } from './types';

/** A készségek sorrendje az eredmény-lapon; csak a vizsgában szerepelt készségek jelennek meg. */
const EXAM_SKILL_ORDER: readonly ExamSkill[] = ['words', 'grammar', 'reading', 'speaking'];

/** Legfeljebb ennyi lecke-link jön a gyenge nyelvtan alá. */
export const MAX_LESSON_LINKS = 3;

export interface SkillResult {
  skill: ExamSkill;
  correct: number;
  total: number;
  /** Egész százalék, lefelé kerekítve (79,9 -> 79), mint a teljes pontszámnál. */
  pct: number;
  /** A készség % az átmenési küszöb alatt van. */
  weak: boolean;
}

export function skillResults(score: ExamScore): SkillResult[] {
  const out: SkillResult[] = [];
  for (const skill of EXAM_SKILL_ORDER) {
    const entry = score.bySkill[skill];
    if (!entry || entry.total === 0) continue;
    out.push({
      skill,
      correct: entry.correct,
      total: entry.total,
      pct: Math.floor((entry.correct * 100) / entry.total),
      weak: !examPassed(entry.correct, entry.total),
    });
  }
  return out;
}

interface WeakLesson {
  topicId: string;
  /** Ennyi tétel ment el a leckéből a vizsgában. */
  missed: number;
}

/** A leggyakrabban elrontott leckék (csak a hibás nyelvtani tételekből), a legtöbb hibás elöl; döntetlennél a vizsgabeli sorrend. */
export function weakLessons(results: ExamItemResult[], max: number = MAX_LESSON_LINKS): WeakLesson[] {
  const missed = new Map<string, number>();
  for (const { item, correct } of results) {
    if (correct || item.kind !== 'gap_mc') continue;
    missed.set(item.topicId, (missed.get(item.topicId) ?? 0) + 1);
  }
  return [...missed.entries()]
    .map(([topicId, count]) => ({ topicId, missed: count }))
    .sort((a, b) => b.missed - a.missed)
    .slice(0, max);
}
