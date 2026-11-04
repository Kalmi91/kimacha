// The Practice run builder (lib/grammar/practice.ts): all forms of the missed verb first, then the rest, at most 15, unique,
// no match cards, deterministic for a pinned seed.

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
    const forms = tasks.slice(0, table.rows.length);
    expect(forms.map((q) => (q.view.card === 'type' ? q.view.answer : ''))).toEqual(table.rows.map((r) => r[2]));
    for (const q of forms) expect(q.kind).toBe('form');
    expect(forms.some((q) => q.view.card === 'type' && q.view.answer === missed.review.answer)).toBe(true);
    // the real items of the same table follow, the missed one is not asked twice
    expect(tasks.slice(table.rows.length).every((q) => q.id !== missed.id)).toBe(true);
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
