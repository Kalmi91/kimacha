// The Practice run after a wrong answer in the level test (FB574, FB575): up to 15 similar tasks with the rule on screen.
// Pure, no React, no DB. Practice answers never write evidence (decision 5a), so nothing here touches the level percent.

import { isFormItem, type GrammarTopicData } from '@/lib/games/content';
import type { FormItem } from '@/lib/grammar/lessonTypes';
import { buildLessonTest, questionOfItem, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { askedColumn, isPersonTable } from '@/lib/grammar/resultDetail';
import { shuffleArray } from '@/lib/shuffle';

export const PRACTICE_SIZE = 15;

/**
 * The tasks for a missed question, unique by id, at most PRACTICE_SIZE, no match cards, the missed question itself only as
 * one form of its verb's column. A form item of a person-column table: every cell of THAT verb's column as a generated form
 * task (all its forms, the missed one included), then the other form items of the same table, then other questions of the
 * topic. Anything else: the same kind in the topic first, then the other kinds. Order inside a group follows the seed.
 */
export function buildPractice(
  missed: LessonTestQuestion,
  lesson: GrammarTopicData,
  opts: { learnedLang: string; contentLang: string; seed: number }
): LessonTestQuestion[] {
  const { learnedLang, contentLang, seed } = opts;
  const all = buildLessonTest(lesson, { seed, learnedLang, contentLang, size: 9999 }).filter((q) => q.kind !== 'match');
  const out: LessonTestQuestion[] = [];
  const seen = new Set<string>();
  const add = (q: LessonTestQuestion | null) => {
    if (q && !seen.has(q.id) && out.length < PRACTICE_SIZE) {
      seen.add(q.id);
      out.push(q);
    }
  };
  const item = lesson.items.find((i) => i.id === missed.id);
  const table = item && isFormItem(item) ? lesson.body.find((b) => b.kind === 'table' && b.id === item.table) : undefined;
  if (item && isFormItem(item) && table && table.kind === 'table' && isPersonTable(table)) {
    const ci = askedColumn(table, item.verb);
    if (ci > 0) {
      table.rows.forEach((row, ri) => {
        const gen: FormItem = { kind: 'form', id: `${item.id}:p${ri}`, verb: item.verb, person: row[0], answer: row[ci], table: item.table, wrong: item.wrong };
        add(questionOfItem(gen, lesson, learnedLang, contentLang, seed));
      });
    }
    const sameTable = (q: LessonTestQuestion) => {
      const it = lesson.items.find((i) => i.id === q.id);
      return !!it && isFormItem(it) && it.table === item.table;
    };
    // the generated tasks already cover the verb's column: the real items of the same table follow, but not the missed one twice
    for (const q of shuffleArray(all.filter((q) => sameTable(q) && q.id !== missed.id), seed)) add(q);
    for (const q of shuffleArray(all.filter((q) => !sameTable(q) && q.id !== missed.id), seed + 1)) add(q);
    return out;
  }
  const rest = all.filter((q) => q.id !== missed.id);
  for (const q of shuffleArray(rest.filter((q) => q.kind === missed.kind), seed)) add(q);
  for (const q of shuffleArray(rest.filter((q) => q.kind !== missed.kind), seed + 1)) add(q);
  return out;
}
