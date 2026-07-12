#!/usr/bin/env node
/**
 * audit-corpus-hu.mjs, Hungarian-target corpus audit.
 *
 * Guarantee: every `sentence_hu` uses ONLY Hungarian words the learner has
 * already been taught (some card's `hu` field), level-cumulative, plus a glue
 * whitelist of function words never taught as cards.
 *
 * Copy of scripts/audit-corpus-en.mjs adapted to Hungarian: accents are kept,
 * the stemmer strips common agglutinative suffixes (conservative: stripped
 * stems must stay >= 3 chars, final long vowel is shortened back, e.g.
 * "kávét" -> "kávé"/"kava" variants).
 *
 * Levels: A0 only for now. The hu/a1.json 6-card stub (ids 6001-6006) predates
 * the matrix model and is protected ("NE bántsd"); A1+ joins the audit when a
 * real A1 track is authored. Run: node scripts/audit-corpus-hu.mjs
 * Exit 1 if any P1 (untaught token) is found, used as a build gate.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LEVELS = ['A0'];

// ---------------------------------------------------------------------------
// Glue whitelist, Hungarian function words NOT taught as vocabulary cards.
// Content words (nouns/verbs/adjectives/adverbs) must NOT be added here.
// ---------------------------------------------------------------------------
const GLUE_WHITELIST = new Set([
  // articles
  'a', 'az', 'egy',
  // personal pronouns (+ common suffixed forms)
  'én', 'te', 'ő', 'mi', 'ti', 'ők', 'ön', 'maga',
  'engem', 'téged', 'őt', 'minket', 'titeket', 'őket', 'nekem', 'neked', 'neki',
  // demonstratives
  'ez', 'ezt', 'ezek', 'azt', 'azok',
  // copula / existence forms (dictionary forms are also taught, inflections are glue)
  'van', 'vannak', 'vagyok', 'vagy', 'vagyunk', 'vagytok', 'volt', 'lesz', 'nincs', 'nincsen',
  // conjunctions
  'és', 'de', 'vagy', 'hogy', 'mert', 'ha', 'is', 'hanem', 'pedig',
  // question words
  'mi', 'mit', 'ki', 'kit', 'hol', 'hova', 'honnan', 'mikor', 'hogyan', 'miért', 'mennyi', 'melyik', 'hány',
  // negation / affirmation / degree / common particles
  'nem', 'igen', 'ne', 'csak', 'még', 'már', 'nagyon', 'kicsit', 'itt', 'ott',
  'most', 'majd', 'túl', 'olyan', 'ilyen', 'minden', 'semmi', 'valami', 'sok', 'kevés',
  // frequent postpositions / verbal particles that glue simple sentences
  'meg', 'el', 'be', 'ki', 'fel', 'le', 'oda', 'ide', 'után', 'előtt', 'mellett', 'felé',
]);

// Proper nouns accepted anywhere (transparent names/places, not taught vocab).
const PROPER_NOUN_LIST = new Set([
  'budapest', 'magyarország', 'anna', 'péter', 'jános', 'éva',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** lowercase, punctuation → space; Hungarian accents are KEPT (meaningful) */
function normalizeHu(str) {
  return str
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[¡!¿?.,;:"()\-–,_ /]/g, ' ')
    .trim();
}

function tokenizeHu(str) {
  return normalizeHu(str).split(/\s+/).filter((t) => t.length > 0);
}

// Common Hungarian suffixes, longest-first so the greedy strip below prefers
// the longest match. Conservative: one suffix layer only, stem must stay >= 3.
const HU_SUFFIXES = [
  'unkat', 'ünket', 'okat', 'eket', 'öket', 'ákat', 'éket',
  'ban', 'ben', 'ból', 'ből', 'nak', 'nek', 'val', 'vel', 'hoz', 'hez', 'höz',
  'ról', 'ről', 'unk', 'ünk', 'tok', 'tek', 'tök', 'nál', 'nél', 'kor',
  'ba', 'be', 'ra', 're', 'on', 'en', 'ön', 'ot', 'et', 'öt', 'at',
  'om', 'em', 'öm', 'am', 'od', 'ed', 'öd', 'ad', 'ja', 'je', 'ok', 'ek', 'ök', 'ak',
  't', 'k', 'm', 'd', 'n', 'i',
];

/** shorten a final long vowel back (kávé+t → kávét, strip → kávé; almá+t → alma) */
function shortenFinalVowel(s) {
  const map = { 'á': 'a', 'é': 'e', 'ó': 'o', 'ő': 'ö', 'ú': 'u', 'ű': 'ü', 'í': 'i' };
  const last = s[s.length - 1];
  return map[last] ? s.slice(0, -1) + map[last] : null;
}

/** shorten the LAST long vowel anywhere (víz→viz, kenyér→kenyer: stem-internal
 *  shortening under suffixation, e.g. vizet, kenyeret) */
function shortenLastLongVowel(s) {
  const map = { 'á': 'a', 'é': 'e', 'ó': 'o', 'ő': 'ö', 'ú': 'u', 'ű': 'ü', 'í': 'i' };
  for (let i = s.length - 1; i >= 0; i--) {
    if (map[s[i]]) return s.slice(0, i) + map[s[i]] + s.slice(i + 1);
  }
  return null;
}

/** drop the epenthetic vowel of a C-V-C ending (étterem→étterm, as in éttermet) */
function dropEpentheticVowel(s) {
  const m = s.match(/^(.*[bcdfghjklmnprstvz])[aeiouöüő]([bcdfghjklmnprstvz])$/);
  return m ? m[1] + m[2] : null;
}

// Taught dictionary forms whose everyday conjugation is irregular; the taught
// 1sg form doesn't reduce to the same stem as the other persons.
const IRREGULAR_PARADIGM_MAP = {
  'jövök': ['jön', 'jössz', 'jönnek', 'jövünk', 'jöttök'],
  'megyek': ['megy', 'mész', 'mennek', 'megyünk', 'mentek'],
  'eszem': ['eszik', 'eszel', 'esznek', 'eszünk', 'esztek'],
  'iszom': ['iszik', 'iszol', 'isznak', 'iszunk', 'isztok'],
};

/**
 * Candidate stem set for a Hungarian token: the token plus conservative
 * de-inflections (single suffix layer + final/internal vowel shortening +
 * epenthetic-vowel drop). Symmetric matching: taught words and sentence tokens
 * both expand through this and the sets are intersected.
 */
function stemForms(token) {
  const forms = new Set([token]);
  const add = (s) => {
    if (!s || s.length < 3) return;
    forms.add(s);
    const short = shortenFinalVowel(s);
    if (short) forms.add(short);
    const internal = shortenLastLongVowel(s);
    if (internal) forms.add(internal);
    const epenth = dropEpentheticVowel(s);
    if (epenth && epenth.length >= 3) forms.add(epenth);
  };
  add(token);
  for (const suf of HU_SUFFIXES) {
    if (token.endsWith(suf) && token.length - suf.length >= 3) {
      add(token.slice(0, -suf.length));
    }
  }
  return forms;
}

// ---------------------------------------------------------------------------
// Load hu-track data (graceful if a level's word file does not exist yet)
// ---------------------------------------------------------------------------

function loadCards(level) {
  const p = join(ROOT, `data/words/hu/${level.toLowerCase()}.json`);
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, 'utf8'));
}

const cardsByLevel = {};
for (const lvl of LEVELS) cardsByLevel[lvl] = loadCards(lvl);

// taught stem set per level (from card.hu), and cumulative sets
const taughtStemByLevel = {};
for (const lvl of LEVELS) {
  const s = new Set();
  for (const card of cardsByLevel[lvl]) {
    for (const tok of tokenizeHu(card.hu ?? '')) {
      for (const f of stemForms(tok)) s.add(f);
      for (const irr of IRREGULAR_PARADIGM_MAP[tok] ?? []) {
        for (const f of stemForms(irr)) s.add(f);
      }
    }
  }
  taughtStemByLevel[lvl] = s;
}

function cumulativeTaught(level) {
  const idx = LEVELS.indexOf(level);
  const s = new Set();
  for (let i = 0; i <= idx; i++) {
    for (const f of taughtStemByLevel[LEVELS[i]]) s.add(f);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

const p1Issues = [];

function tokenTaught(tok, taughtStems) {
  if (GLUE_WHITELIST.has(tok)) return true;
  for (const f of stemForms(tok)) {
    if (PROPER_NOUN_LIST.has(f)) return true;
    if (taughtStems.has(f)) return true;
  }
  return false;
}

for (const lvl of LEVELS) {
  const taught = cumulativeTaught(lvl);
  for (const card of cardsByLevel[lvl]) {
    const missing = [];
    for (const tok of tokenizeHu(card.sentence_hu ?? '')) {
      if (!tokenTaught(tok, taught)) missing.push(tok);
    }
    if (missing.length > 0) {
      p1Issues.push({ id: card.id, level: lvl, topic: card.topic ?? '', sentence_hu: card.sentence_hu, missing });
    }
  }
}

// ---------------------------------------------------------------------------
// Exam audit, data/exams/hu/*.json (gap questions), same rule as the en gate:
// question sentence + CORRECT option only; wrong options are exempt.
// ---------------------------------------------------------------------------

function loadExam(level) {
  const p = join(ROOT, `data/exams/hu/${level.toLowerCase()}.json`);
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, 'utf8'));
}

const examByLevel = {};
for (const lvl of LEVELS) examByLevel[lvl] = loadExam(lvl);

const p1ExamIssues = [];

for (const lvl of LEVELS) {
  const taught = cumulativeTaught(lvl);
  for (const q of examByLevel[lvl]) {
    if (q.type !== 'gap') continue;
    const correct = q.options?.[q.correctIndex] ?? '';
    const missing = [];
    for (const tok of tokenizeHu(`${q.sentence ?? ''} ${correct}`)) {
      if (!tokenTaught(tok, taught)) missing.push(tok);
    }
    if (missing.length > 0) {
      p1ExamIssues.push({ id: q.id, level: lvl, sentence: q.sentence, correct, missing });
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

let report = `# Hungarian-track Corpus Audit\n\nGenerated: ${new Date().toISOString()}\n\n## Summary\n\n`;
for (const lvl of LEVELS) report += `- ${lvl} cards: ${cardsByLevel[lvl].length}, exam questions: ${examByLevel[lvl].length}\n`;
report += `- P1 issues (untaught token in sentence_hu): **${p1Issues.length}**\n`;
report += `- P1 exam issues (untaught token in question sentence/correct option): **${p1ExamIssues.length}**\n\n`;
report += `## P1 Issues\n\n`;
if (p1Issues.length === 0) {
  report += `None, every sentence_hu uses only taught Hungarian vocabulary.\n`;
} else {
  for (const it of p1Issues) {
    report += `- **Card ${it.id}** (${it.level}, \`${it.topic}\`)\n  - \`${it.sentence_hu}\`\n  - Missing: ${it.missing.map((t) => `\`${t}\``).join(', ')}\n`;
  }
}
report += `\n## P1 Exam Issues\n\n`;
if (p1ExamIssues.length === 0) {
  report += `None, every exam sentence + correct option uses only taught Hungarian vocabulary.\n`;
} else {
  for (const it of p1ExamIssues) {
    report += `- **Question ${it.id}** (${it.level})\n  - \`${it.sentence}\` (correct: \`${it.correct}\`)\n  - Missing: ${it.missing.map((t) => `\`${t}\``).join(', ')}\n`;
  }
}
writeFileSync(join(ROOT, 'scripts/audit-report-hu.md'), report, 'utf8');

console.log('Hungarian-track audit complete.');
for (const lvl of LEVELS) console.log(`  ${lvl} cards: ${cardsByLevel[lvl].length}, exam questions: ${examByLevel[lvl].length}`);
console.log(`P1 (untaught): ${p1Issues.length}`);
console.log(`P1 exam (untaught): ${p1ExamIssues.length}`);
console.log('Report: scripts/audit-report-hu.md');
process.exit(p1Issues.length + p1ExamIssues.length > 0 ? 1 : 0);
