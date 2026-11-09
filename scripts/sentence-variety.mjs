#!/usr/bin/env node
// Variety gate for the example sentences of data/words-open (FB632: "the sentences are monotonous").
// Per level it measures and, for the levels in ENFORCED, fails when a limit is broken; the other levels are only reported.
//
//   node scripts/sentence-variety.mjs            report every level, exit 1 when an ENFORCED level breaks a limit
//   node scripts/sentence-variety.mjs a1 b1      only these levels
//   --top                                        also print the commonest openers and patterns
//
// Limits (share of the level's non-empty sentences):
//   opener    the same first two words in at most 1% (min 3 sentences)
//   family    a family member (madre, padre, hijo, ...) among the first 3 words, at most 10%
//   pattern   the most common pattern (subject type + person of the first verb) at most 25%
//   question  at least 15% questions or negations (? at the end, or no / nunca / nada / nadie / tampoco / ni / ningun*)
//   length    the mean length of the shortest 10% is at least WINDOW.lo - 1, the mean of the longest 10% is at most
//             WINDOW.hi, and the two means are at least 3 words apart
// A level is enforced once its rewrite is merged: add it to ENFORCED then.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1'];
const ENFORCED = ['a1', 'c1'];
const WINDOW = { a1: [4, 9], a2: [5, 12], b1: [7, 15], b2: [8, 18], c1: [8, 18] };
const FAMILY = ['madre', 'padre', 'hijo', 'hija', 'hermano', 'hermana', 'tía', 'tío', 'abuelo', 'abuela', 'esposo', 'esposa', 'primo', 'prima'];
const FAMILY_FORMS = new Set(FAMILY.flatMap((w) => [w, w + 's']).concat(['padres', 'hijos', 'hermanos', 'tíos', 'abuelos', 'esposos', 'primos']));
// Colon shape and sentence-initial pronoun came with the C1 review (2026-11-09); A1 was merged before them and is only reported.
const NEW_RULES_WAIVED = ['a1'];
const SUBJECT_PRONOUNS =new Set(['yo', 'tú', 'él', 'ella', 'nosotros', 'ustedes', 'ellos', 'ellas']);
const NEG = new Set(['no', 'nunca', 'nada', 'nadie', 'tampoco', 'ni', 'ninguno', 'ninguna', 'ningún']);
const PRON = { yo: 'yo', tú: 'tú', usted: 'usted', él: 'él/ella', ella: 'él/ella', nosotros: 'nosotros', nosotras: 'nosotros', ustedes: 'ustedes', ellos: 'ellos', ellas: 'ellos' };
const CLITIC = new Set(['me', 'te', 'se', 'lo', 'la', 'le', 'los', 'las', 'les', 'nos']);
const IRREGULAR = {
  soy: '1s', eres: '2s', es: '3s', somos: '1p', son: '3p', estoy: '1s', estás: '2s', está: '3s', estamos: '1p', están: '3p',
  voy: '1s', vas: '2s', va: '3s', vamos: '1p', van: '3p', doy: '1s', hay: '3s', sé: '1s', sabe: '3s', hago: '1s', veo: '1s',
  tengo: '1s', tienes: '2s', tiene: '3s', tenemos: '1p', tienen: '3p', quiero: '1s', quieres: '2s', quiere: '3s', queremos: '1p', quieren: '3p',
  puedo: '1s', puedes: '2s', puede: '3s', podemos: '1p', pueden: '3p', digo: '1s', dice: '3s', vengo: '1s', viene: '3s',
};
const tokenize = (s) => s.toLowerCase().replace(/[¿?¡!.,;:()"«»…]/g, ' ').split(/\s+/).filter(Boolean);
const person = (t) => {
  if (IRREGULAR[t]) return IRREGULAR[t];
  if (/(amos|emos|imos)$/.test(t)) return '1p';
  if (/(an|en)$/.test(t)) return '3p';
  if (/(as|es)$/.test(t)) return '2s';
  if (/o$/.test(t)) return '1s';
  return '3s';
};

const pos = new Map();
for (const lv of LEVELS) for (const c of JSON.parse(fs.readFileSync(path.join(ROOT, 'data/words-open', `${lv}.json`), 'utf8'))) if (!pos.has(c.lemma) || c.pos === 'verb') pos.set(c.lemma, c.pos);

const pct = (n, d) => (d ? (100 * n) / d : 0);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function measure(lv) {
  const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/words-open', `${lv}.json`), 'utf8')).filter((c) => c.sentence_es);
  const n = cards.length;
  const openers = new Map();
  const patterns = new Map();
  let family = 0;
  let qn = 0;
  let colon = 0;
  let pronOpen = 0;
  const lengths = [];
  for (const c of cards) {
    const toks = tokenize(c.sentence_es);
    lengths.push(toks.length);
    const op = toks.slice(0, 2).join(' ');
    openers.set(op, (openers.get(op) ?? 0) + 1);
    if (toks.slice(0, 3).some((t) => FAMILY_FORMS.has(t))) family++;
    if (/\?\s*$/.test(c.sentence_es) || toks.some((t) => NEG.has(t))) qn++;
    if (c.sentence_es.includes(': ')) colon++;
    if (SUBJECT_PRONOUNS.has(toks[0])) pronOpen++;
    const lem = c.sentence_lemmas ?? [];
    const vi = lem.findIndex((l) => pos.get(l) === 'verb');
    const before = vi < 0 ? [] : toks.slice(0, vi);
    const pron = before.map((t) => PRON[t]).find(Boolean);
    // subject type: q = question, a pronoun, none = nothing before the verb but no / me / te / se ..., adv = the sentence opens
    // with a preposition, adverb or conjunction (En verano ..., Hoy ..., Siempre ...), np = a noun phrase
    const subj = /^¿/.test(c.sentence_es) ? 'q' : pron ? pron
      : before.every((t) => NEG.has(t) || CLITIC.has(t)) ? 'none'
        : ['prep', 'adv', 'conj'].includes(pos.get(lem[0])) ? 'adv' : 'np';
    const key = `${subj}+${vi < 0 ? '?' : person(toks[vi])}`;
    patterns.set(key, (patterns.get(key) ?? 0) + 1);
    if (process.argv.includes(`--list=${key}`)) console.log(`o${c.order} ${c.sentence_es}`);
  }
  const sorted = [...lengths].sort((a, b) => a - b);
  const k = Math.max(1, Math.round(n * 0.1));
  const short = mean(sorted.slice(0, k));
  const long = mean(sorted.slice(-k));
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['-', 0];
  const [op, opN] = top(openers);
  const [pat, patN] = top(patterns);
  const [lo, hi] = WINDOW[lv];
  const limit = Math.max(3, Math.floor(n * 0.01));
  const checks = [
    [`opener "${op}" ${opN}x (max ${limit})`, opN <= limit],
    [`family subjects ${pct(family, n).toFixed(1)}% (max 10)`, pct(family, n) <= 10],
    [`top pattern ${pat} ${pct(patN, n).toFixed(1)}% (max 25)`, pct(patN, n) <= 25],
    [`questions/negations ${pct(qn, n).toFixed(1)}% (min 15)`, pct(qn, n) >= 15],
    [`colon shape "claim: elaboration" ${pct(colon, n).toFixed(1)}% (max 10)`, pct(colon, n) <= 10, true],
    [`sentence-initial subject pronoun ${pct(pronOpen, n).toFixed(1)}% (max 5)`, pct(pronOpen, n) <= 5, true],
    [`length shortest10% ${short.toFixed(1)} (min ${lo - 1}), longest10% ${long.toFixed(1)} (max ${hi}), gap ${(long - short).toFixed(1)} (min 3)`, short >= lo - 1 && long <= hi && long - short >= 3],
  ];
  return { n, checks, openers, patterns };
}

const wanted = process.argv.slice(2).filter((a) => LEVELS.includes(a));
let failed = false;
for (const lv of wanted.length ? wanted : LEVELS) {
  const { n, checks, openers, patterns } = measure(lv);
  const enforced = ENFORCED.includes(lv);
  console.log(`${lv} (${n} sentences, ${enforced ? 'ENFORCED' : 'report only'})`);
  for (const [text, ok, newRule] of checks) {
    const waived = newRule && NEW_RULES_WAIVED.includes(lv);
    console.log(`  ${ok ? 'ok  ' : waived ? 'warn' : 'FAIL'} ${text}`);
    if (!ok && enforced && !waived) failed = true;
  }
  if (process.argv.includes('--top')) {
    for (const [name, m] of [['openers', openers], ['patterns', patterns]]) {
      console.log(`  ${name}: ` + [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${v}`).join(', '));
    }
  }
}
console.log(failed ? 'sentence-variety: ROT' : 'sentence-variety: ZÖLD');
process.exit(failed ? 1 : 0);
