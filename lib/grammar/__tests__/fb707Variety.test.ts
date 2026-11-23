// FB707, FB709, FB712, FB715, FB716, FB717: the icr-why task is gone, the match pairs are one word, the transform
// sentences of indefinido-regular are varied, and every route that shows options mixes them.
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildGrammarRound, isChoiceRoundItem } from '@/lib/games/grammarChoice';
import { lessonFor, lessonKinds } from '@/lib/grammar/syllabus';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

type Item = { id: string; kind?: string; pairs?: { es: string; en: string }[]; prompt?: { es: string; en: string }; why?: { en: string } };
const itemsOf = (id: string) => (lessonFor('es', id) as unknown as LessonV2).items as unknown as Item[];

describe('indefinido-cambios-raiz (FB707, FB712, FB709)', () => {
  it('has no icr-why item and no why kind', () => {
    expect(itemsOf('indefinido-cambios-raiz').some((i) => /^icr-why-/.test(i.id))).toBe(false);
    expect(lessonKinds('es', 'indefinido-cambios-raiz')).not.toContain('why');
  });

  it('icr-match-01 pairs one Spanish word with a subject + past verb', () => {
    const m = itemsOf('indefinido-cambios-raiz').find((i) => i.id === 'icr-match-01')!;
    expect(m.pairs).toHaveLength(6);
    for (const p of m.pairs!) {
      expect(p.es.trim().split(/\s+/)).toHaveLength(1);
      expect(p.en).toMatch(/^(he|she) \w+$/);
    }
  });
});

describe('indefinido-regular transform items (FB715, FB716, FB717)', () => {
  const tr = itemsOf('indefinido-regular').filter((i) => i.kind === 'transform');
  const person = (i: Item) => /, ([^,:]+): /.exec(i.why!.en)![1];
  const cls = (p: string) => (/^(yo)$/.test(p) ? 'yo' : p === 'tú' ? 'tú' : /ellos|ustedes/.test(p) ? 'ellos' : /nosotros/.test(p) ? 'nos' : 'él');

  it('has 10 items, not all starting with Hoy, madre and correo at most once', () => {
    expect(tr).toHaveLength(10);
    expect(tr.filter((i) => /^hoy\b/i.test(i.prompt!.es)).length).toBeLessThanOrEqual(1);
    for (const w of ['madre', 'correo']) {
      expect(tr.filter((i) => new RegExp(`\\b${w}\\b`, 'i').test(i.prompt!.es)).length).toBeLessThanOrEqual(1);
    }
  });

  it('yo and tú are equally many, and no person comes twice in a row', () => {
    const classes = tr.map((i) => cls(person(i)));
    expect(classes.filter((c) => c === 'yo').length).toBe(classes.filter((c) => c === 'tú').length);
    for (let n = 1; n < classes.length; n++) expect(classes[n]).not.toBe(classes[n - 1]);
  });
});

describe('every route that shows options mixes them', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', '..', '..', p), 'utf8');
  it('the option-showing components and builders call the seeded shuffle', () => {
    expect(read('lib/games/grammarChoice.ts')).toMatch(/shuffleOptions\(item\.options, item\.correct,/);
    expect(read('components/grammar/NewKinds.tsx')).toMatch(/shuffleOptions\(item\.options, item\.correctIndex,/);
    expect(read('components/grammar/drill/WhyTransformItems.tsx')).toMatch(/shuffleOptions\(item\.options, item\.correctIndex,/);
    expect(read('components/grammar/TypedKinds.tsx')).toMatch(/shuffleArray\(item\.bank,/);
    expect(read('components/grammar/drill/MatchFormItems.tsx')).toMatch(/shuffleNoFixedPoints\(/);
  });

  it('the right option is not always first in a built round', () => {
    const lesson = lessonFor('es', 'indefinido-regular') as unknown as LessonV2;
    const choice = buildGrammarRound(lesson as never, 3).filter(isChoiceRoundItem);
    expect(choice.length).toBeGreaterThan(5);
    expect(choice.filter((c) => c.correctIndex === 0).length).toBeLessThan(choice.length);
  });
});
