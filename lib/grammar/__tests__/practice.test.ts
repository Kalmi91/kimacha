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

describe('buildPractice', () => {
  it('a form item of a person table: every form of THAT verb first (the missed one included), then other form items, then the rest', () => {
    const lesson = lessonFor('es', 'gustar')!;
    const missed = missedOf('gustar', 'gu-form-12');
    const tasks = buildPractice(missed, lesson, O);
    const table = lesson.body.find((b) => b.kind === 'table')!;
    if (table.kind !== 'table') throw new Error('table');
    const forms = tasks.slice(0, table.rows.filter((r) => !/vosotr/i.test(r[0])).length);
    // the vosotros row is no task in Spanish (Mexican norm)
    const rows = table.rows.filter((r) => !/vosotr/i.test(r[0]));
    expect(forms.map((q) => (q.view.card === 'type' ? q.view.answer : ''))).toEqual(rows.map((r) => r[2]));
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
});
