// Coverage check for the 50 transform items of the `indefinido-10-verbos`
// lesson. The sentences are built only from the
// lesson's 28 words, with every main person of the 10 verbs. This test measures this
// coverage, not grammatical correctness (that is provided by audit-games.mjs +
// a human read-through).

import fs from 'fs';
import path from 'path';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';
import { isTransformItem } from '@/lib/games/content';

const FILE = path.join(__dirname, '..', '..', 'data', 'games', 'grammar', 'es', 'indefinido-10-verbos.json');
const lesson: LessonV2 = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const transformItems = lesson.items.filter(isTransformItem);

// The lesson may teach exactly these 28 words: neither more nor
// fewer wordIds may appear on the items. A wordId is the `order` of words-open:
// by lemma the 28 old words are 25 words-open cards (estoy/están
// = estar, ir/vas = ir, tiene/tenemos = tener).
const ALLOWED_WORD_IDS = [
  '119', '123', '129', '143', '150', '16', '174', '2', '208', '220', '254', '259', '283', '284', '285', '286',
  '33', '391', '51', '52', '610', '632', '74', '77', '88',
];

// 10 verbs x 6 forms; the person is decided from the answer text (word-boundary
// match so that "tuvo" does not match "estuvo"). gustar gets separate logic
// (me/te/le/nos/les), because it has no subject-person conjugation.
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

// Language fact: for regular -ar verbs the nosotros form is identical in the present and
// in the indefinido (miramos/miramos), so the transform prompt would equal the answer there
// (an error). Instead of nosotros, these four verbs therefore got a 5th item;
// since then it is an ustedes item (miraron...), not vosotros, so the required
// persons for them are: yo, tú, él, ellos (the second ellos/ustedes item is the 5th).
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

  it('wordIds union is exactly the 25 taught card ids (28 words), no more, no less', () => {
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
        ? ['yo', 'tu', 'el', 'ellos']
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
