// The result sheet per skill
// (words, grammar, reading, speaking): score and %, "strong" or "weak" (weak = the skill % is below
// the pass threshold), and for weak grammar the most frequently missed lessons (lesson links). Pure
// functions; the screen (app/exam.tsx) only displays them.

import { examPassed, type ExamScore } from './score';
import type { ExamItemResult, ExamSkill } from './types';

/** Order of the skills on the result sheet; only skills that appeared in the exam are shown. */
const EXAM_SKILL_ORDER: readonly ExamSkill[] = ['words', 'grammar', 'reading', 'speaking'];

/** At most this many lesson links appear under weak grammar. */
export const MAX_LESSON_LINKS = 3;

export interface SkillResult {
  skill: ExamSkill;
  correct: number;
  total: number;
  /** Whole percent, rounded down (79.9 -> 79), as with the total score. */
  pct: number;
  /** The skill % is below the pass threshold. */
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
  /** Number of items from this lesson that were missed in the exam. */
  missed: number;
}

/** The most frequently missed lessons (from wrong grammar items only), most misses first; ties keep exam order. */
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
