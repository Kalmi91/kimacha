import fs from 'fs';
import path from 'path';
import { lessonFor } from '@/lib/grammar/syllabus';
import { buildLessonTest } from '@/lib/grammar/lessonTest';
import { normTyped } from '@/lib/grammar/resultDetail';
import type { FormItem } from '@/lib/grammar/lessonTypes';

// FB625 / FB629 / FB642-646: a typed level-test task whose generated question would not say which word or form to type
// carries its own whole question `q` (en and es). It is the only text above the input and must not hand over the answer.
const WITH_Q = ['quien-a-quien', 'tener-expresiones', 'ir-a-infinitivo', 'gustar', 'muy-mucho', 'numeros-hora-fecha', 'posesivos'];

describe('typed level-test tasks say what to type', () => {
  for (const topic of WITH_Q) {
    it(`${topic}: every form task has its own question`, () => {
      const lesson = lessonFor('es', topic)!;
      const forms = lesson.items.filter((i): i is FormItem => i.kind === 'form');
      expect(forms.length).toBeGreaterThan(0);
      const qs = buildLessonTest(lesson, { seed: 1, learnedLang: 'es', contentLang: 'en', size: 9999 });
      for (const f of forms) {
        expect(f.q?.en).toBeTruthy();
        expect(f.q?.es).toBeTruthy();
        expect(f.q?.es).toMatch(/^¿.*\?/);
        const q = qs.find((x) => x.id === f.id)!;
        expect(q.view.card).toBe('type');
        if (q.view.card !== 'type') continue;
        expect(q.view.prompt).toBe(f.q!.en);
        expect(q.view.hint).toBeUndefined();
        // the answer is not in the question as a word of its own ("me" in "mesa" is fine)
        const words = normTyped(q.view.prompt).split(/[^a-z0-9]+/);
        // muy-mucho names its small set of words (muy, mucho, mucha...) in the question, which is the topic itself
        if (topic !== 'muy-mucho') expect(normTyped(f.answer).split(/[^a-z0-9]+/).every((w) => words.includes(w))).toBe(false);
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

// a hint can never be dropped silently again: no form item of any course keeps an sk without its q.
describe('every sk has a q (data/games/grammar/**)', () => {
  it('no form item has an ask without a q', () => {
    const root = path.join(process.cwd(), 'data', 'games', 'grammar');
    const bad: string[] = [];
    let forms = 0;
    for (const course of fs.readdirSync(root)) {
      const dir = path.join(root, course);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        const lesson = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as { items?: { id: string; kind: string; ask?: unknown; q?: unknown }[] };
        for (const it of lesson.items ?? []) {
          if (it.kind !== 'form') continue;
          forms++;
          if (it.ask !== undefined && it.q === undefined) bad.push(`${course}/${file}#${it.id}`);
        }
      }
    }
    expect(forms).toBeGreaterThan(900);
    expect(bad).toEqual([]);
  });

  // E122: the generated question ("What is the form of Masculino plural for rojo?") is only fine for a conjugation (a person table);
  // every other A1 form task of every course says in its own words what to type (E122 es, E137 de, en, hu).
  const minNonVerb: Record<string, number> = { es: 140, de: 232, en: 16, hu: 201 };
  it.each(Object.keys(minNonVerb))('every non-verb A1 form task of the %s course has its own q (en and es) and its sidecar translations', (course) => {
    const games = path.join(process.cwd(), 'data', 'games');
    const dir = path.join(games, 'grammar', course);
    const personHeader = /^(person|persona|pronoun|pronombre)$/i;
    const bad: string[] = [];
    let nonVerb = 0;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const lesson = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as {
        level?: string;
        body?: { kind: string; id?: string; header?: { en?: string; es?: string }[] }[];
        items?: { id: string; kind: string; table?: string; q?: { en?: string; es?: string } }[];
      };
      if (lesson.level !== 'A1') continue;
      const sidecars = ['grammar-de', 'grammar-hu']
        .map((d) => path.join(games, d, course, file))
        .filter((p) => fs.existsSync(p))
        .map((p) => JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, string>);
      for (const it of lesson.items ?? []) {
        if (it.kind !== 'form') continue;
        const table = (lesson.body ?? []).find((b) => b.kind === 'table' && b.id === it.table);
        const h = table?.header?.[0];
        const conjugation = !table || (!!h && (personHeader.test(h.en ?? '') || personHeader.test(h.es ?? '')));
        if (conjugation) continue;
        nonVerb++;
        if (!it.q?.en || !it.q?.es || (course === 'es' && !/^¿.*\?/.test(it.q.es))) bad.push(`${file}#${it.id}`);
        else if (sidecars.some((s) => !s[it.q!.en!])) bad.push(`${file}#${it.id} (sidecar)`);
      }
    }
    expect(nonVerb).toBeGreaterThanOrEqual(minNonVerb[course]);
    expect(bad).toEqual([]);
  });
});
