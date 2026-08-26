#!/usr/bin/env node
// Sentence specificity linter, from the 2026-08-25/26 feedback round (FB154/155/157).
//
// Kálmán, `word:Saturday`: "ezek a mondatok ... nem specifikus ... szombaton nem
// dolgozunk ezzel az a baj hogy vasárnap sem". Same for "el guisante es una
// verdura verde", which is equally true of the courgette, and `word:home cooking`,
// "eléggé rövid mondat és nem specifikus".
//
// The shared defect: the example sentence stays TRUE when the target word is
// swapped for a sibling, so it teaches nothing about the word it is supposed to
// teach. That is checkable without understanding the sentence: blank the target
// word out and see whether the remaining frame is shared with other cards.
//
// Usage:  node scripts/sentence-specificity.mjs [level ...] [--branch=es|en|hu]
//   default levels: a0 a1 a2      (the range a learner actually reaches today)
//   --branch picks the word set: es = the shared Spanish corpus (default),
//   en/hu = the dedicated target-language branches under data/words/<branch>/.
//
// Every class is a HEURISTIC: a hit means "look at this card", not "this is
// wrong". Exit code is non-zero when there are findings, so it works as a gate.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const branchArg = args.find(a => a.startsWith('--branch='));
const branch = branchArg ? branchArg.split('=')[1] : 'es';
const levels = args.filter(a => !a.startsWith('--'));
const LEVELS = levels.length ? levels : ['a0', 'a1', 'a2'];

// The language a card's example sentence is graded in: the branch teaches that
// language, so that is the sentence the learner reads and repeats.
const SENTENCE_FIELD = { es: 'sentence_es', en: 'sentence_en', hu: 'sentence_hu' }[branch] ?? 'sentence_es';
const HEADWORD_FIELD = { es: 'es', en: 'en', hu: 'hu' }[branch] ?? 'es';

// A frame this short carries no information about the word, whatever it is.
const MIN_SENTENCE_WORDS = 5;

const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ARTICLES = /^(el|la|los|las|un|una|unos|unas|the|a|an|to|az|egy)\s+/;

function loadLevel(level) {
  const path = branch === 'es'
    ? join(ROOT, 'data', 'words', `${level}.json`)
    : join(ROOT, 'data', 'words', branch, `${level}.json`);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return [];
  }
}

// The stem the target word is recognised by inside its own sentence. Headwords
// carry articles ("la pimienta") and multi-word forms ("tú hablas"); the last
// word is the content one, and its first letters survive most inflection.
// A headword can offer variants ("casado/casada", "el amigo / la amiga"); each of
// them counts as the word appearing.
function targetStems(headword) {
  return String(headword ?? '')
    .split('/')
    .map(variant => {
      const bare = strip(variant).replace(ARTICLES, '').trim();
      const last = bare.split(/\s+/).pop() ?? '';
      return last.length <= 4 ? last : last.slice(0, Math.max(4, last.length - 2));
    })
    .filter(Boolean);
}

// The sentence with its target word blanked out. Two cards sharing a frame is
// exactly the "swap the word and it stays true" defect.
function frameOf(sentence, headword) {
  const stems = targetStems(headword);
  const words = strip(String(sentence ?? ''))
    .replace(/[¿?¡!.,;:«»"'“”‘’()…]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (!stems.length) return { frame: words.join(' '), hits: 0, words };
  let hits = 0;
  const frame = words.map(w => {
    if (stems.some(stem => w.startsWith(stem))) { hits += 1; return '#'; }
    return w;
  });
  return { frame: frame.join(' '), hits, words };
}

// A frame that says nothing but "it is a <category>" or "it is <adjective>":
// true of every sibling in the topic.
const GENERIC_FRAMES = [
  /^(el|la|los|las)?\s*#\s+(es|son)\s+(un|una|unos|unas)?\s*\w+(\s+\w+)?$/,
  /^#\s+(is|are)\s+(a|an)?\s*\w+(\s+\w+)?$/,
  /^(a|az)?\s*#\s+\w+$/,
];

const cards = [];
for (const level of LEVELS) {
  for (const card of loadLevel(level)) {
    const headword = card[HEADWORD_FIELD];
    const sentence = card[SENTENCE_FIELD];
    if (!headword || !sentence) continue;
    const { frame, hits, words } = frameOf(sentence, headword);
    cards.push({ level: level.toUpperCase(), card, headword, sentence, frame, hits, words });
  }
}

const findings = { SHARED: [], SHORT: [], GENERIC: [], ABSENT: [] };

// Class SHARED: the same frame under two or more different words.
const byFrame = new Map();
for (const c of cards) {
  if (c.hits === 0) continue; // ABSENT reports that separately
  byFrame.set(c.frame, [...(byFrame.get(c.frame) ?? []), c]);
}
for (const [frame, group] of byFrame) {
  if (group.length < 2) continue;
  findings.SHARED.push({ frame, group });
}

// A conjugated verb rarely keeps its infinitive stem ("fregar" → "friego",
// "vestirse" → "me visto"), so ABSENT would flag every irregular verb card. The
// paradigm knowledge for that lives in audit-corpus.mjs; here verbs simply skip
// the class, the other three still apply to them.
const isVerbHeadword = headword => /(ar|er|ir)(se)?$/.test(strip(headword).trim());

for (const c of cards) {
  if (c.words.length < MIN_SENTENCE_WORDS) findings.SHORT.push(c);
  if (GENERIC_FRAMES.some(re => re.test(c.frame))) findings.GENERIC.push(c);
  // The sentence never says the word it teaches, so it cannot teach its use.
  if (c.hits === 0 && !isVerbHeadword(c.headword)) findings.ABSENT.push(c);
}

const label = c => `[${c.level} #${c.card.id} ${c.card.topic ?? '-'}] ${c.headword}`;

console.log(`Sentence specificity, branch ${branch}, levels ${LEVELS.join(' ')}`);
console.log(`  cards checked: ${cards.length}`);
console.log('');

console.log(`── SHARED frame (the word is swappable, FB155): ${findings.SHARED.length} frames`);
for (const { frame, group } of findings.SHARED.sort((a, b) => b.group.length - a.group.length)) {
  console.log(`  "${frame}"  ×${group.length}`);
  for (const c of group) console.log(`      ${label(c)}, ${c.sentence}`);
}
console.log('');

console.log(`── GENERIC frame (only names a category, FB155): ${findings.GENERIC.length} cards`);
for (const c of findings.GENERIC) console.log(`  ${label(c)}, ${c.sentence}`);
console.log('');

console.log(`── SHORT (under ${MIN_SENTENCE_WORDS} words, FB157): ${findings.SHORT.length} cards`);
for (const c of findings.SHORT) console.log(`  ${label(c)}, ${c.sentence}`);
console.log('');

console.log(`── ABSENT (sentence never uses the word): ${findings.ABSENT.length} cards`);
for (const c of findings.ABSENT) console.log(`  ${label(c)}, ${c.sentence}`);
console.log('');

const total =
  findings.SHARED.reduce((n, f) => n + f.group.length, 0) +
  findings.GENERIC.length +
  findings.SHORT.length +
  findings.ABSENT.length;
console.log(`Total cards to review: ${total}`);
process.exit(total > 0 ? 1 : 0);
