import { lessonFor } from '@/lib/grammar/syllabus';
import { buildLessonTest } from '@/lib/grammar/lessonTest';
import { normTyped } from '@/lib/grammar/resultDetail';
import type { FormItem } from '@/lib/grammar/lessonTypes';

// FB625 / FB629: a typed level-test task whose prompt alone does not say which word or form to type carries an `ask`
// text, shown as its hint. It says what to type and must not hand over the answer.
const ASKED = ['posesivos', 'quien-a-quien', 'tener-expresiones', 'gustar', 'ir-a-infinitivo', 'numeros-hora-fecha', 'muy-mucho'];
const GENERIC = /^(Type the form of the verb|Type the word|Type the correct form)$/;

describe('typed level-test tasks say what to type', () => {
  for (const topic of ASKED) {
    it(`${topic}: every form task has its own hint`, () => {
      const lesson = lessonFor('es', topic)!;
      const forms = lesson.items.filter((i): i is FormItem => i.kind === 'form');
      expect(forms.length).toBeGreaterThan(0);
      const qs = buildLessonTest(lesson, { seed: 1, learnedLang: 'es', contentLang: 'en', size: 9999 });
      for (const f of forms) {
        expect(f.ask?.en).toBeTruthy();
        expect(f.ask?.es).toBeTruthy();
        const q = qs.find((x) => x.id === f.id)!;
        expect(q.view.card).toBe('type');
        if (q.view.card !== 'type') continue;
        const hint = q.view.hint ?? '';
        expect(hint).toBe(f.ask!.en);
        expect(GENERIC.test(hint)).toBe(false);
        // muy-mucho names its small set of words (muy, mucho, mucha...), which is the topic itself
        if (topic !== 'muy-mucho') expect(normTyped(hint)).not.toContain(normTyped(f.answer));
      }
    });
  }

  it('ir-a-infinitivo no longer has the why task iai-why-02 (FB618)', () => {
    expect(lessonFor('es', 'ir-a-infinitivo')!.items.some((i) => i.id === 'iai-why-02')).toBe(false);
  });
});

describe('pronombres-od: the place of the pronoun is explained (FB620, FB626, FB627)', () => {
  const lesson = lessonFor('es', 'pronombres-od')!;
  const byId = (id: string) => lesson.items.find((i) => i.id === id) as unknown as { why: { en: string; es: string }; wrong: Record<string, { en: string }> };

  it('od-06 says why the pronoun joins the end of the infinitive and that the other place is right too', () => {
    const w = byId('od-06').why;
    expect(w.en).toMatch(/Rule:.*no person of its own/);
    expect(w.en).toContain('Te quiero ayudar');
    expect(w.es).toContain('Te quiero ayudar');
  });

  it('od-08 says why the pronoun joins the end of the gerund and why it cannot stand in front of it', () => {
    const it8 = byId('od-08');
    expect(it8.why.en).toContain('La estoy comiendo');
    expect(it8.wrong['la comiendo'].en).toMatch(/never between estoy and comiendo/);
  });

  it('the lesson rule covers ir a / querer + infinitive in both places and estar + gerund', () => {
    const usage = lesson.body.find((b) => b.kind === 'usage');
    expect(usage?.kind).toBe('usage');
    if (usage?.kind !== 'usage') return;
    const text = usage.points.map((p) => p.text.en).join(' | ');
    expect(text).toContain('querer, poder, ir a');
    expect(text).toContain('la estoy comiendo');
    const pairs = usage.points.flatMap((p) => p.examples.map((e) => e.es));
    expect(pairs).toEqual(expect.arrayContaining(['Voy a comprarlo.', 'Lo voy a comprar.']));
  });
});
