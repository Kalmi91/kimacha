// FB700 + FB705: a tense form item names the asked tense in everyday words and gives a sample sentence with a time adverb.
import type { FormItem, LessonBlock, LessonV2 } from '@/lib/grammar/lessonTypes';
import { TENSE_ADVERB, TENSE_EVERYDAY, formTenseCue } from '@/lib/grammar/formTenseCue';
import { formTask } from '@/lib/grammar/resultDetail';
import { detectStructures } from '@/lib/grammar/tenseGate';
import { lessonFor } from '@/lib/grammar/syllabus';

const pickEn = (l: Record<string, string>) => l.en;

const form = (to: FormItem['tense'] extends infer T ? (T extends { to: infer U } ? U : never) : never, person = 'ellos/ellas/ustedes'): FormItem => ({
  kind: 'form',
  id: 'x-form-01',
  verb: 'poder',
  person,
  answer: 'pudieron',
  table: 't',
  tense: { from: 'presente', to },
});

describe('formTenseCue', () => {
  it('names the past tense in everyday words and adds an adverb sentence with a gap (indefinido)', () => {
    expect(formTenseCue(form('indefinido'), pickEn)).toEqual({
      label: 'Past (finished action)',
      sentence: 'Ayer, ellos/ellas/ustedes ___ (poder).',
    });
  });

  it('imperfecto, perfecto, futuro and presente get their own everyday name and adverb', () => {
    expect(formTenseCue(form('imperfecto'), pickEn)).toEqual({ label: 'Past (used to / was doing)', sentence: 'Antes, ellos/ellas/ustedes ___ (poder).' });
    expect(formTenseCue(form('futuro-simple'), pickEn)?.sentence).toBe('Mañana, ellos/ellas/ustedes ___ (poder).');
    expect(formTenseCue(form('perfecto', 'yo'), pickEn)?.sentence).toBe('Hoy ya yo ___ (poder).');
    expect(formTenseCue(form('presente', 'tú'), pickEn)?.sentence).toBe('Hoy, tú ___ (poder).');
  });

  it('every mapped tense has an everyday name in all four languages', () => {
    for (const [tense, names] of Object.entries(TENSE_EVERYDAY)) {
      expect(TENSE_ADVERB[tense as keyof typeof TENSE_ADVERB]).toBeTruthy();
      for (const lang of ['en', 'es', 'hu', 'de'] as const) expect(names?.[lang]?.trim()).toBeTruthy();
    }
  });

  it('the adverb sentences stay inside the level grammar: the tense gate sees no tense in them', () => {
    for (const to of Object.keys(TENSE_ADVERB) as (keyof typeof TENSE_ADVERB)[]) {
      const cue = formTenseCue(form(to), pickEn)!;
      expect([...detectStructures(cue.sentence.replace('___', '').replace('(poder)', ''))]).toEqual([]);
    }
  });

  it('keeps hand-written questions, time-cue persons and unmapped tenses unchanged', () => {
    expect(formTenseCue({ ...form('indefinido'), q: { en: 'x', es: 'x' } }, pickEn)).toBeNull();
    expect(formTenseCue(form('indefinido', 'ayer'), pickEn)).toBeNull();
    expect(formTenseCue(form('condicional'), pickEn)).toBeNull();
    expect(formTenseCue(form('subjuntivo-presente'), pickEn)).toBeNull();
    expect(formTenseCue({ ...form('indefinido'), tense: undefined }, pickEn)).toBeNull();
  });
});

describe('the question of a tense form item (FB705)', () => {
  const lesson = lessonFor('es', 'indefinido-10-verbos') as LessonV2;
  const item = lesson.items.find((i) => (i as { id: string }).id === 'i10-form-04') as FormItem;
  const table = lesson.body.find((b) => b.kind === 'table' && b.id === item.table) as Extract<LessonBlock, { kind: 'table' }>;

  it('i10-form-04 tells which tense and gives the time adverb sentence', () => {
    const { question } = formTask(item, table, pickEn);
    expect(question).toContain('Past (finished action)');
    expect(question).toContain('poder');
    expect(question).toContain('Ayer, ellos/ellas/ustedes ___ (poder).');
  });

  it('the Spanish wording uses the Spanish everyday name', () => {
    const { question } = formTask(item, table, (l) => l.es ?? l.en);
    expect(question).toContain('Pasado (acción terminada)');
  });
});

describe('the ser table and items of indefinido-10-verbos (FB704)', () => {
  const lesson = lessonFor('es', 'indefinido-10-verbos') as LessonV2;

  it('has the ind10-ser table with the six forms, ir and ser alike', () => {
    const ser = lesson.body.find((b) => b.kind === 'table' && b.id === 'ind10-ser') as Extract<LessonBlock, { kind: 'table' }>;
    const ir = lesson.body.find((b) => b.kind === 'table' && b.id === 'ind10-ir') as Extract<LessonBlock, { kind: 'table' }>;
    expect(ser.rows.map((r) => r[1])).toEqual(['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron']);
    expect(ser.rows.map((r) => r[1])).toEqual(ir.rows.map((r) => r[1]));
  });

  it('has as many items as an average verb gets (about 8.5) and the title says 11', () => {
    const serItems = lesson.items.filter((i) => {
      const x = i as { id: string };
      return /^(i10-tr-5[1-5]|i10-06|i10-form-06|i10-why-06|i10-cloze-06)$/.test(x.id);
    });
    expect(serItems.length).toBeGreaterThanOrEqual(8);
    expect(lesson.title.en).toContain('11 most frequent verbs');
    expect(lesson.title.es).toContain('11 verbos más frecuentes');
  });
});
