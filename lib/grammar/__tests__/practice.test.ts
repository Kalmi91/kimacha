// The Practice run builder (lib/grammar/practice.ts): all forms of the missed verb first, then the rest, at most 15, unique,
// no match cards, deterministic for a pinned seed.

import { getGrammarTopics } from '@/lib/games/content';
import { isVosotrosItem } from '@/lib/grammar/vosotros';
import { lessonFor } from '@/lib/grammar/syllabus';
import { buildLessonTest, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { PRACTICE_SIZE, buildPractice } from '../practice';

const O = { learnedLang: 'es', contentLang: 'en', seed: 7 };
const all = (topic: string) => buildLessonTest(lessonFor('es', topic)!, { ...O, size: 9999 });
const missedOf = (topic: string, id: string) => all(topic).find((q) => q.id === id)!;

const tableRowOf = (table: { rows: string[][] }, person: string) => table.rows.filter((r) => !/vosotr/i.test(r[0])).findIndex((r) => r[0] === person);

describe('buildPractice', () => {
  it('a form item of a person table: every form of THAT verb first (the missed one included), then other form items, then the rest', () => {
    const lesson = lessonFor('es', 'gustar')!;
    const missed = missedOf('gustar', 'gu-form-12');
    const tasks = buildPractice(missed, lesson, O);
    const table = lesson.body.find((b) => b.kind === 'table')!;
    if (table.kind !== 'table') throw new Error('table');
    // the vosotros row is no task in Spanish (Mexican norm)
    const rows = table.rows.filter((r) => !/vosotr/i.test(r[0]));
    const forms = tasks.slice(0, 2 * rows.length);
    const answers = forms.map((q) => (q.view.card === 'type' ? q.view.answer : ''));
    // the table holds two verbs (one thing / several things): the missed verb's whole column is among the first tasks
    for (const r of rows) expect(answers).toContain(r[2]);
    for (const q of forms) expect(q.kind).toBe('form');
    expect(forms.some((q) => q.view.card === 'type' && q.view.answer === missed.review.answer)).toBe(true);
    // the real items of the same table follow, the missed one is not asked twice
    expect(tasks.slice(forms.length).every((q) => q.id !== missed.id)).toBe(true);
    expect(tasks.length).toBe(PRACTICE_SIZE);
  });

  it('is capped at 15, unique, has no match card, and is the same for the same seed', () => {
    for (const [topic, id] of [['gustar', 'gu-form-01'], ['presente-regular', all('presente-regular')[0].id]]) {
      const missed = missedOf(topic, id);
      const a = buildPractice(missed, lessonFor('es', topic)!, O);
      const b = buildPractice(missed, lessonFor('es', topic)!, O);
      expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
      expect(a.length).toBeLessThanOrEqual(PRACTICE_SIZE);
      expect(new Set(a.map((q) => q.id)).size).toBe(a.length);
      expect(a.some((q) => q.view.card === 'match')).toBe(false);
    }
  });

  it('anything else: the same kind first, then the other kinds, never the missed question', () => {
    const lesson = lessonFor('es', 'presente-regular')!;
    const missed = all('presente-regular').find((q) => q.kind === 'choice')!;
    const tasks = buildPractice(missed, lesson, O);
    expect(tasks.some((q) => q.id === missed.id)).toBe(false);
    const kinds = tasks.map((q: LessonTestQuestion) => q.kind);
    const firstOther = kinds.findIndex((k) => k !== 'choice');
    expect(kinds.slice(0, firstOther < 0 ? kinds.length : firstOther).every((k) => k === 'choice')).toBe(true);
  });

  it('a topic with few questions gives only what it has', () => {
    const lesson = { ...lessonFor('es', 'gustar')!, items: lessonFor('es', 'gustar')!.items.filter((i) => i.kind === 'form').slice(0, 3) };
    const missed = buildLessonTest(lesson, { ...O, size: 9999 })[0];
    const tasks = buildPractice(missed, lesson, O);
    expect(tasks.length).toBeLessThan(PRACTICE_SIZE);
    expect(tasks.length).toBeGreaterThanOrEqual(6);
  });
});

describe('buildPractice over the real lessons of all four courses', () => {
  it('every form item gets at least one task; no vosotros in es, no " / " answer, no mistake text on another row', () => {
    jest.setTimeout(240000);
    let items = 0;
    let generated = 0;
    for (const lang of ['es', 'en', 'de', 'hu']) {
      for (const lesson of getGrammarTopics(lang)) {
        const opts = { learnedLang: lang, contentLang: 'en', seed: 1 };
        const questions = buildLessonTest(lesson, { ...opts, size: 9999 });
        for (const q of questions) {
          if (q.kind !== 'form') continue;
          const item = lesson.items.find((i) => i.id === q.id);
          if (!item || item.kind !== 'form') continue;
          items++;
          const tasks = buildPractice(q, lesson, opts);
          expect(tasks.length).toBeGreaterThanOrEqual(1);
          for (const t of tasks) {
            if (t.view.card !== 'type') continue;
            expect(t.view.answer).not.toContain(' / ');
            for (const a of t.view.accept ?? []) expect(a).not.toContain(' / ');
            if (!t.id.includes(':p')) continue;
            generated++;
            if (lang === 'es') {
              expect(isVosotrosItem({ kind: 'form', id: 'x', verb: '', person: '', answer: t.view.answer, table: '' })).toBe(false);
              expect(t.view.prompt).not.toMatch(/vosotr/i);
            }
            // a mistake text of the missed row never answers another row's task
            if (item.wrong && t.review.question !== q.review.question) {
              for (const [typed, texts] of Object.entries(item.wrong)) {
                const own = t.detail?.explainTyped?.(typed);
                expect(own === texts.en || own === texts.es).toBe(false);
              }
            }
          }
        }
      }
    }
    expect(items).toBeGreaterThan(2000);
    expect(generated).toBeGreaterThan(1000);
  }, 240000);

  it("an alternatives cell (he's / she's / it's) becomes the first as the answer with the others accepted", () => {
    const lesson = getGrammarTopics('en').find((l) => l.items.some((i) => i.id === 'tb-07'))!;
    const q = buildLessonTest(lesson, { learnedLang: 'en', contentLang: 'es', seed: 1, size: 9999 }).find((x) => x.id === 'tb-07')!;
    const tasks = buildPractice(q, lesson, { learnedLang: 'en', contentLang: 'es', seed: 1 });
    const slash = tasks.find((t) => t.view.card === 'type' && (t.view.accept ?? []).length > 0);
    expect(slash).toBeTruthy();
    if (slash?.view.card === 'type') expect(slash.view.answer).toBe("he's");
  });
  it('se-form-05 (ser): the 15 tasks practise every form of ser AND of estar, not one column (FB590)', () => {
    const lesson = lessonFor('es', 'ser-estar')!;
    const missed = missedOf('ser-estar', 'se-form-05');
    const tasks = buildPractice(missed, lesson, O);
    const forms = tasks.filter((q) => q.view.card === 'type').map((q) => (q.view.card === 'type' ? q.view.answer : ''));
    const col = (id: string) =>
      (lesson.body.find((b) => b.kind === 'table' && b.id === id) as Extract<(typeof lesson.body)[number], { kind: 'table' }>).rows
        .filter((r) => !/vosotr/i.test(r[0]))
        .map((r) => r[1]);
    const ser = col('ser-presente');
    const estar = col('estar-presente');
    // round robin: the missed verb and person first (ser, él/ella/usted = es), the first 6 hold both verbs on different persons
    expect(forms[0]).toBe('es');
    const first6 = tasks.slice(0, 6).map((q) => (q.view.card === 'type' ? q.view.label ?? q.view.prompt : ''));
    expect(forms.slice(0, 6).some((a, i) => i % 2 === 1 && estar.includes(a) && !ser.includes(a))).toBe(true);
    expect(new Set(first6).size).toBe(6);
    // every form of ser AND of estar is practised
    for (const a of [...ser, ...estar]) expect(forms).toContain(a);
    expect(tasks.length).toBe(PRACTICE_SIZE);
    expect(new Set(tasks.map((q) => q.id)).size).toBe(tasks.length);
  });

  it('a topic with one verb keeps working: gustar still starts with the one column', () => {
    const lesson = lessonFor('es', 'gustar')!;
    const tasks = buildPractice(missedOf('gustar', 'gu-form-12'), lesson, O);
    expect(tasks.length).toBe(PRACTICE_SIZE);
    expect(tasks[0].kind).toBe('form');
  });
  it('several verbs on ONE table (imperfecto: ser / ir / ver): every verb column is practised, the missed verb first (FB590)', () => {
    const lesson = lessonFor('es', 'imperfecto')!;
    const table = lesson.body.find((b) => b.kind === 'table' && b.id === 'imperfecto-irregular');
    if (!table || table.kind !== 'table') throw new Error('table');
    const miss = lesson.items.find((i) => i.kind === 'form' && i.table === 'imperfecto-irregular' && i.verb === 'ir')!;
    const tasks = buildPractice(all('imperfecto').find((q) => q.id === miss.id)!, lesson, O);
    const answers = tasks.map((q) => (q.view.card === 'type' ? q.view.answer : ''));
    const col = (verb: string) => {
      const ci = table.header.findIndex((h) => h.es === verb);
      return table.rows.filter((r) => !/vosotr/i.test(r[0])).map((r) => r[ci].split(' / ')[0].trim());
    };
    expect(answers[0]).toBe(col('ir')[tableRowOf(table, (miss as { person: string }).person)]); // the missed verb and person first
    // the 15-task cap is shared with the topic's other verbs: each verb of the table is in, the missed verb completely
    for (const a of col('ir')) expect(answers).toContain(a);
    for (const verb of ['ser', 'ver']) expect(col(verb).some((a) => answers.includes(a))).toBe(true);
    expect(new Set(tasks.map((q) => q.id)).size).toBe(tasks.length);
    expect(tasks.length).toBeLessThanOrEqual(PRACTICE_SIZE);
  });
});
