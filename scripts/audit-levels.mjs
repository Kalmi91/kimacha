#!/usr/bin/env node
/**
 * FB209, Kálmán 2026-09-09 (word:real): „A1 es az A2 szavak kozott sem látok nagy
 * különbséget olyan mintha A2 kozott lenne néhány a1 es szó mint a ser be nem
 * tudom hogy ennek A2 ben kellene e lenni".
 *
 * Ez a szkript nem mozgat semmit, csak MEGMUTATJA, hol csúszott el a szint-
 * besorolás, mert a szó áthelyezése tanulási döntés (a kártya SRS-előzménye az
 * id-hez tapad, a szint viszont eldönti, mikor kerül elő):
 *
 *   1. ugyanaz a szótő két szinten (a1 "la carta" + a2 "las cartas"),
 *   2. a FŐNÉVI IGENÉV magasabb szinten, mint a ragozott alakjai
 *      (a1 "yo soy / tú eres / él es" mellett a2 "ser", pont Kálmán példája).
 *
 * Futtatás: node scripts/audit-levels.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS = ['a0', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

function loadLevel(level) {
  try {
    return JSON.parse(readFileSync(join(ROOT, `data/words/${level}.json`), 'utf8'));
  } catch {
    return [];
  }
}

// "la carta" → "carta", "las cartas" → "carta": a névelő és a többes szám nem
// tesz egy szót másik szóvá, tehát a duplikátum-keresésnek le kell vágnia.
function lemma(text) {
  const bare = String(text ?? '')
    .toLowerCase()
    .trim()
    .replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '');
  return bare.replace(/(es|s)$/, '');
}

const words = [];
for (const level of LEVELS) {
  for (const w of loadLevel(level)) words.push({ ...w, file: level });
}

// 1. ugyanaz a szótő két szinten
const byLemma = new Map();
for (const w of words) {
  const key = lemma(w.es);
  if (!key) continue;
  byLemma.set(key, [...(byLemma.get(key) ?? []), w]);
}
const crossLevel = [...byLemma.entries()]
  .filter(([, list]) => new Set(list.map((w) => w.file)).size > 1)
  .sort((a, b) => a[0].localeCompare(b[0]));

// 2. főnévi igenév a ragozott alakjai FÖLÖTT. A „tartalmazza a szótövet" teszt
// itt nem elég (a `ser` töve egy betű, és akkor a `sí` is találat lenne), tehát a
// ragozott alakokat kigeneráljuk: a szabályosakat a tőből, a hat leggyakoribb
// rendhagyót kézzel.
const INFINITIVE = /^(.+?)(ar|er|ir)$/;
const REGULAR_ENDINGS = {
  ar: ['o', 'as', 'a', 'amos', 'an', 'aba', 'abas', 'aban', 'é', 'aste', 'ó'],
  er: ['o', 'es', 'e', 'emos', 'en', 'ía', 'ías', 'ían', 'í', 'iste', 'ió'],
  ir: ['o', 'es', 'e', 'imos', 'en', 'ía', 'ías', 'ían', 'í', 'iste', 'ió'],
};
const IRREGULAR_FORMS = {
  ser: ['soy', 'eres', 'es', 'somos', 'sois', 'son', 'era', 'fue', 'fui'],
  estar: ['estoy', 'estás', 'está', 'estamos', 'están', 'estuve'],
  haber: ['he', 'has', 'ha', 'hemos', 'han', 'hay', 'había'],
  ir: ['voy', 'vas', 'va', 'vamos', 'van', 'iba', 'fue'],
  tener: ['tengo', 'tienes', 'tiene', 'tenemos', 'tienen', 'tuve'],
  hacer: ['hago', 'haces', 'hace', 'hacemos', 'hacen', 'hice'],
};
const MIN_STEM = 3;

const strip = (text) => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function conjugationsOf(infinitive) {
  const forms = new Set((IRREGULAR_FORMS[infinitive] ?? []).map(strip));
  const match = INFINITIVE.exec(infinitive);
  if (match) {
    const [, stem, ending] = match;
    if (stem.length >= MIN_STEM) {
      for (const suffix of REGULAR_ENDINGS[ending]) forms.add(strip(stem + suffix));
    }
  }
  return forms;
}

const levelRank = (file) => LEVELS.indexOf(file);
const lateInfinitives = [];
for (const w of words) {
  const es = String(w.es ?? '').toLowerCase().trim();
  if (!INFINITIVE.test(es) || es.includes(' ')) continue;
  const forms = conjugationsOf(es);
  if (forms.size === 0) continue;
  const conjugated = words.filter((o) => {
    if (o === w || levelRank(o.file) >= levelRank(w.file)) return false;
    return strip(o.es).split(/\s+/).some((token) => forms.has(token));
  });
  if (conjugated.length >= 2) {
    lateInfinitives.push({ word: w, conjugated: conjugated.slice(0, 5) });
  }
}

const lines = [
  '# Level audit (FB209)',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `- Same lemma on two levels: **${crossLevel.length}**`,
  `- Infinitive above its own conjugated forms: **${lateInfinitives.length}**`,
  '',
  '## Same lemma on two levels',
  '',
];
for (const [key, list] of crossLevel) {
  lines.push(`- \`${key}\`: ${list.map((w) => `${w.file.toUpperCase()} #${w.id} "${w.es}" (${w.hu ?? ''})`).join(' · ')}`);
}
lines.push('', '## Infinitive above its conjugated forms', '');
for (const { word, conjugated } of lateInfinitives) {
  lines.push(
    `- \`${word.es}\` is ${word.file.toUpperCase()} #${word.id}, but ${conjugated
      .map((c) => `${c.file.toUpperCase()} "${c.es}"`)
      .join(', ')}`
  );
}
lines.push('');

writeFileSync(join(ROOT, 'scripts/audit-levels.md'), lines.join('\n'), 'utf8');
console.log(`audit-levels: ${crossLevel.length} cross-level lemmas, ${lateInfinitives.length} late infinitives`);
console.log('Report: scripts/audit-levels.md');
