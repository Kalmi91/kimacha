// The Practice run after a wrong answer in the level test (FB574, FB575): up to 15 similar tasks with the rule on screen.
// Pure, no React, no DB. Practice answers never write evidence (decision 5a), so nothing here touches the level percent.

import { isFormItem, type GrammarTopicData } from '@/lib/games/content';
import type { FormItem } from '@/lib/grammar/lessonTypes';
import { buildLessonTest, questionOfItem, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { askedColumn, isPersonTable } from '@/lib/grammar/resultDetail';
import { isVosotrosItem } from '@/lib/grammar/vosotros';
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
    // a topic whose tables hold several verbs (ser and estar on two tables, ser/ir/ver on one): the missed verb's column
    // first, then the column of every other verb the topic asks in a person table (the missed table's other verbs before
    // the other tables), so all forms of each of those verbs are practised (FB590)
    const columns: { table: typeof table; verb: string }[] = [{ table, verb: item.verb }];
    const tables = [table, ...lesson.body.filter((b) => b.kind === 'table' && b.id !== table.id)];
    for (const b of tables) {
      if (b.kind !== 'table' || !isPersonTable(b)) continue;
      const verbs = new Set(lesson.items.filter((i): i is FormItem => isFormItem(i) && i.table === b.id).map((i) => i.verb));
      for (const verb of verbs) if (!(b === table && verb === item.verb)) columns.push({ table: b, verb });
    }
    for (const col of columns) {
      const ci = askedColumn(col.table, col.verb);
      if (ci <= 0) continue;
      col.table.rows.forEach((row, ri) => {
        // a cell may list alternatives ("he's / she's / it's"): the first is the answer, the rest are accepted
        const [answer, ...accept] = row[ci].split(' / ').map((x) => x.trim()).filter(Boolean);
        if (!answer) return;
        // the missed row keeps the item's own mistake texts; they describe that answer and no other
        const mine = col.table === table && col.verb === item.verb;
        const gen: FormItem = {
          kind: 'form',
          id: `${mine ? item.id : `${item.id}:${col.table.id}:${col.verb}`}:p${ri}`,
          verb: col.verb,
          person: row[0],
          answer,
          ...(accept.length > 0 ? { accept } : {}),
          table: col.table.id,
          ...(mine && row[0] === item.person && item.wrong ? { wrong: item.wrong } : {}),
        };
        // the Mexican norm has no vosotros: such a row is no task (the real items are filtered the same way)
        if (learnedLang === 'es' && isVosotrosItem(gen)) return;
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
