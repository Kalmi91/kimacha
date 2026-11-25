import fs from 'fs';
import path from 'path';
import { findWordByText, normalizeWordToken } from '@/data/words';
import { exerciseWords, exerciseTexts } from '../exerciseWords';
import { formGlosses } from '../formGlosses';

type L = Parameters<typeof exerciseWords>[0];
const lesson = (items: object[]): L => ({ items });
const keys = (l: L, lang = 'es', shown: string[] = []) => exerciseWords(l, lang, shown).map((w) => w.key);

describe('exerciseWords', () => {
  it('gap: only the correct option, never the wrong ones or accept', () => {
    const l = lesson([{ id: 'a', sentence: 'Ella ___ bien.', options: ['canta', 'inteligenta'], correct: 0, examples: ['Nosotros cantamos.'], accept: ['zzz'] }]);
    const k = keys(l);
    expect(k).toContain('canta');
    expect(k).toContain('cantamos');
    expect(k).not.toContain('inteligenta');
    expect(k).not.toContain('zzz');
  });

  it('fix and spot: the word at wrongIndex is left out, the fix is in', () => {
    const l = lesson([
      { kind: 'fix', id: 'f', es: 'Yo hizo pan', wrongIndex: 1, answer: 'hice', accept: ['nope'] },
      { kind: 'spot', id: 's', es: 'Ella tiene sed fea', wrongIndex: 3, options: ['', 'bella', 'bonita'], correctIndex: 0 },
      { kind: 'spot', id: 's2', es: 'Ellos son malo', wrongIndex: 2, options: ['malos', 'x', 'y'], correctIndex: 0 },
    ]);
    const k = keys(l);
    expect(k).not.toContain('hizo');
    expect(k).not.toContain('fea');
    expect(k).not.toContain('malo');
    expect(k).toEqual(expect.arrayContaining(['hice', 'pan', 'malos', 'tiene']));
    expect(k).not.toContain('bella');
  });

  it('match in an en-learned lesson takes the en side', () => {
    const l = lesson([{ kind: 'match', id: 'm', pairs: [{ es: 'perro', en: 'dog' }] }]);
    expect(keys(l, 'en')).toEqual(['dog']);
    expect(keys(l, 'es')).toEqual(['perro']);
  });

  it('transform takes prompt[learnedLang] and the answer', () => {
    const l = lesson([{ kind: 'transform', id: 't', prompt: { en: 'english', es: 'hablaba mucho' }, answer: 'habló', accept: ['q'] }]);
    expect(exerciseTexts(l, 'es')).toEqual(['hablaba mucho', 'habló']);
  });

  it('form: verb/person only when a single token; «hints», "-ra" and "+" are skipped', () => {
    const l = lesson([
      { kind: 'form', id: 'f', verb: 'tener + sustantivo', person: 'to be thirsty', answer: 'tiene sed' },
      { kind: 'form', id: 'g', verb: 'hablar', person: 'yo', answer: 'hablo' },
      { kind: 'dictation', id: 'd', es: 'Escribe «alg» -ra + 5.º x_y' },
    ]);
    const k = keys(l);
    expect(k).toEqual(expect.arrayContaining(['hablar', 'yo', 'hablo', 'tiene', 'sed', 'escribe']));
    expect(k).not.toContain('tener');
    expect(k).not.toContain('thirsty');
    expect(k).not.toContain('alg');
    expect(k).not.toContain('-ra');
    expect(k).not.toContain('ra');
  });

  it('excludes shown words, sorts, keeps always-capitalized words capitalized', () => {
    const l = lesson([
      { kind: 'dictation', id: '1', es: 'Hablaba con Ana.' },
      { kind: 'dictation', id: '2', es: 'Ana hablaba de México.' },
      { kind: 'dictation', id: '3', es: 'El zorro come árbol.' },
    ]);
    const w = exerciseWords(l, 'es', ['Con el']);
    expect(w.map((x) => x.display)).toEqual(['Ana', 'árbol', 'come', 'de', 'hablaba', 'México', 'zorro']);
    expect(w.find((x) => x.key === 'con')).toBeUndefined();
  });
});

describe('exercise words content gate', () => {
  const root = path.join(__dirname, '..', '..', '..', 'data', 'games', 'grammar');
  // Ratchet for en/de/hu: lower these as the form glosses (data/games/grammar-forms/*.json) are filled.
  const MAX_UNRESOLVED: Record<string, number> = { en: 43, de: 729, hu: 3649 };

  function unresolved(lang: string): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    const dir = path.join(root, lang);
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (!Array.isArray(data.items)) continue;
      const own = new Set<string>((data.glossary ?? []).map((g: { word: string }) => normalizeWordToken(g.word)));
      const shared = formGlosses(lang);
      const shown = data.items
        .filter((i: { kind?: string }) => i.kind === undefined || i.kind === 'gap')
        .slice(0, 3)
        .map((i: { sentence: string; options: string[]; correct: number }) => i.sentence.replace('___', i.options[i.correct]));
      const missing = exerciseWords({ items: data.items }, lang, shown)
        .filter((w) => !own.has(w.key) && !shared[w.key] && !findWordByText(w.key, lang, lang))
        .map((w) => w.display);
      if (missing.length) out[file] = missing;
    }
    return out;
  }
  const total = (r: Record<string, string[]>) => Object.values(r).reduce((n, a) => n + a.length, 0);
  const report = (r: Record<string, string[]>) => Object.entries(r).map(([f, w]) => `${f}: ${w.join(', ')}`).join('\n');

  it('es: every task word resolves', () => {
    const r = unresolved('es');
    if (total(r)) console.log(report(r));
    expect(total(r)).toBe(0);
  });

  for (const lang of ['en', 'de', 'hu']) {
    it(`${lang}: unresolved words do not grow`, () => {
      const r = unresolved(lang);
      if (total(r) > MAX_UNRESOLVED[lang]) console.log(report(r));
      expect(total(r)).toBeLessThanOrEqual(MAX_UNRESOLVED[lang]);
    });
  }

  it('grammar-forms files: normalized keys, a gloss per other content language', () => {
    const dir = path.join(__dirname, '..', '..', '..', 'data', 'games', 'grammar-forms');
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const own = file.replace('.json', '');
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as Record<string, Record<string, string>>;
      for (const [key, glosses] of Object.entries(data)) {
        expect(key).toBe(normalizeWordToken(key));
        for (const cl of ['en', 'es', 'hu', 'de'].filter((c) => c !== own)) {
          expect(typeof glosses[cl] === 'string' && glosses[cl].trim().length > 0).toBe(true);
        }
      }
    }
  });
});
