// FB316 (NYELVTAN.md NY10): lefedettség-ellenőrzés az `indefinido-10-verbos`
// lecke 50 transform itemjére. Kálmán döntése (2026-09-18): a mondatok csak a
// lecke 28 szavából épülnek, a 10 ige minden fő személyével. Ez a teszt ezt a
// lefedettséget méri, nem a nyelvtani helyességet (azt az audit-games.mjs +
// az emberi átolvasás adja).

import fs from 'fs';
import path from 'path';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';
import { isTransformItem } from '@/lib/games/content';

const FILE = path.join(__dirname, '..', '..', 'data', 'games', 'grammar', 'es', 'indefinido-10-verbos.json');
const lesson: LessonV2 = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const transformItems = lesson.items.filter(isTransformItem);

// A lecke pontosan ezt a 28 szót taníthatja (TASK-9, Kálmán szava): sem több,
// sem kevesebb wordId nem szerepelhet az itemeken.
const ALLOWED_WORD_IDS = [
  '1051', '1087', '31', '1073', '1074', '28', '29', '1880', '1887', '80', '85', '1229', '1055',
  '1312', '1869', '3587', '76', '74', '218', '1875', '1240', '1400', '1224', '21', '202', '1566', '1851', '1857',
];

// 10 ige x 6 alak; az answer szövegéből dönti el a személyt (szóhatáros
// egyezés, hogy "tuvo" ne illeszkedjen "estuvo"-ra). A gustar külön logikát
// kap (me/te/le/nos/les), mert nála nem alanyi személyragozás van.
const VERB_FORMS: Record<string, Record<string, string>> = {
  estar: { yo: 'estuve', tu: 'estuviste', el: 'estuvo', nosotros: 'estuvimos', vosotros: 'estuvisteis', ellos: 'estuvieron' },
  ir: { yo: 'fui', tu: 'fuiste', el: 'fue', nosotros: 'fuimos', vosotros: 'fuisteis', ellos: 'fueron' },
  tener: { yo: 'tuve', tu: 'tuviste', el: 'tuvo', nosotros: 'tuvimos', vosotros: 'tuvisteis', ellos: 'tuvieron' },
  saber: { yo: 'supe', tu: 'supiste', el: 'supo', nosotros: 'supimos', vosotros: 'supisteis', ellos: 'supieron' },
  poder: { yo: 'pude', tu: 'pudiste', el: 'pudo', nosotros: 'pudimos', vosotros: 'pudisteis', ellos: 'pudieron' },
  mirar: { yo: 'miré', tu: 'miraste', el: 'miró', nosotros: 'miramos', vosotros: 'mirasteis', ellos: 'miraron' },
  pasar: { yo: 'pasé', tu: 'pasaste', el: 'pasó', nosotros: 'pasamos', vosotros: 'pasasteis', ellos: 'pasaron' },
  esperar: { yo: 'esperé', tu: 'esperaste', el: 'esperó', nosotros: 'esperamos', vosotros: 'esperasteis', ellos: 'esperaron' },
  necesitar: { yo: 'necesité', tu: 'necesitaste', el: 'necesitó', nosotros: 'necesitamos', vosotros: 'necesitasteis', ellos: 'necesitaron' },
};

// Nyelvi tény: a szabályos -ar igéknél a nosotros alak azonos jelen időben és
// indefinidóban (miramos/miramos), tehát ott a transform prompt==answer lenne
// (audit P1 hiba). Ez a négy ige ezért a nosotros helyett vosotros itemet
// kapott (a brief "vosotros legfeljebb 1 item igénként" pontja pont erre ad
// módot), így náluk ez az 5. kötelező személy a nosotros helyett.
const NOSOTROS_REPLACED_BY_VOSOTROS = new Set(['mirar', 'pasar', 'esperar', 'necesitar']);

function wordsOf(answer: string): string[] {
  return answer
    .replace(/[¿?.,]/g, '')
    .split(/\s+/)
    .map((w) => w.toLowerCase());
}

function classify(answer: string): { verb: string; person: string } | null {
  const words = wordsOf(answer);
  for (const [verb, forms] of Object.entries(VERB_FORMS)) {
    for (const [person, form] of Object.entries(forms)) {
      if (words.includes(form.toLowerCase())) return { verb, person };
    }
  }
  if (words.includes('gustó') || words.includes('gustaron')) {
    for (const clitic of ['me', 'te', 'le', 'nos', 'les']) {
      if (words.includes(clitic)) return { verb: 'gustar', person: clitic };
    }
  }
  return null;
}

describe('indefinido-10-verbos, FB316 coverage', () => {
  it('has exactly 50 transform items', () => {
    expect(transformItems.length).toBe(50);
  });

  it('wordIds union is exactly the 28 taught ids, no more, no less', () => {
    const used = new Set<string>();
    for (const item of transformItems) {
      for (const id of item.wordIds) used.add(id);
    }
    expect([...used].sort()).toEqual([...ALLOWED_WORD_IDS].sort());
  });

  it('every item classifies to a known verb+person', () => {
    for (const item of transformItems) {
      expect(classify(item.answer)).not.toBeNull();
    }
  });

  it('every verb has at least 5 items', () => {
    const counts: Record<string, number> = {};
    for (const item of transformItems) {
      const c = classify(item.answer)!;
      counts[c.verb] = (counts[c.verb] ?? 0) + 1;
    }
    for (const verb of [...Object.keys(VERB_FORMS), 'gustar']) {
      expect(counts[verb] ?? 0).toBeGreaterThanOrEqual(5);
    }
  });

  it('every verb covers all 5 main persons (gustar: me/te/le/nos/les)', () => {
    const personsByVerb: Record<string, Set<string>> = {};
    for (const item of transformItems) {
      const c = classify(item.answer)!;
      if (!personsByVerb[c.verb]) personsByVerb[c.verb] = new Set();
      personsByVerb[c.verb].add(c.person);
    }
    for (const verb of Object.keys(VERB_FORMS)) {
      const required = NOSOTROS_REPLACED_BY_VOSOTROS.has(verb)
        ? ['yo', 'tu', 'el', 'ellos', 'vosotros']
        : ['yo', 'tu', 'el', 'nosotros', 'ellos'];
      for (const person of required) {
        expect(personsByVerb[verb]?.has(person)).toBe(true);
      }
    }
    for (const clitic of ['me', 'te', 'le', 'nos', 'les']) {
      expect(personsByVerb.gustar?.has(clitic)).toBe(true);
    }
  });

  it('no duplicate prompt.es', () => {
    const prompts = transformItems.map((i) => i.prompt.es);
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it('at least 8 negative and 8 question items', () => {
    const neg = transformItems.filter((i) => i.prompt.es.trim().startsWith('No ')).length;
    const q = transformItems.filter((i) => i.prompt.es.trim().startsWith('¿')).length;
    expect(neg).toBeGreaterThanOrEqual(8);
    expect(q).toBeGreaterThanOrEqual(8);
  });
});
