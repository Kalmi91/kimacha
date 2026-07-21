#!/usr/bin/env node
// Sentence-QA linter, distilled from the 2026-07-16/21 feedback round (FB52-58).
// Scans card sentences for the SAME problem classes the user flagged by hand, so
// the rest of the corpus can be swept for repeats instead of waiting for reports.
//
// Usage:  node scripts/sentence-qa.mjs [level ...]
//   default levels: a0 a1 a2  (the range an A1 learner actually reaches)
//   e.g.  node scripts/sentence-qa.mjs a0 a1 a2 b1 b2
//
// Every check is a HEURISTIC, output is a review list, not an auto-fix. A hit is
// "look at this card", not "this is definitely wrong". Tune the curated lists as
// real false positives show up; keep each entry commented with its origin.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const levels = process.argv.slice(2).length ? process.argv.slice(2) : ['a0', 'a1', 'a2'];

// ── Class NUM: EN↔ES number divergence (FB52 trousers, FB53 fruit, FB54 vegetables)
// Only a SUBSET of number differences is a real problem. Many nouns simply have a
// fixed, natural number in Spanish that differs from English, `la ropa` (never
// pluralised), `las vacaciones` / `las noticias` / `los deberes` (plural-only), `la
// gente` (collective singular). Those are CORRECT, not bugs, so they carry
// `natural: true` and are only listed in an INFO bucket, never flagged.
// The actionable cases: an English pluralia-tantum garment vs a singular Spanish
// noun (`pantalón` ↔ trousers → NUM), and collective food nouns the user asked to
// align (`fruta` / `verdura` → COLL, review-only).
const NUM_NOUNS = [
  { es_s: 'pantalón', es_p: 'pantalones', en: /\b(trousers|pants|jeans)\b/i, enAlwaysPlural: true, cls: 'NUM' },   // FB52
  { es_s: 'fruta', es_p: 'frutas', en: /\bfruit\b/i, enUncountable: true, cls: 'COLL' },                            // FB53
  { es_s: 'verdura', es_p: 'verduras', en: /\bvegetables?\b/i, cls: 'COLL' },                                        // FB54
  { es_s: 'ropa', es_p: 'ropas', en: /\bclothes\b/i, enAlwaysPlural: true, natural: true },
  { es_s: 'noticia', es_p: 'noticias', en: /\bnews\b/i, enUncountable: true, natural: true },
  { es_s: 'consejo', es_p: 'consejos', en: /\badvice\b/i, enUncountable: true, natural: true },
  { es_s: 'mueble', es_p: 'muebles', en: /\bfurniture\b/i, enUncountable: true, natural: true },
  { es_s: 'gente', es_p: 'gentes', en: /\bpeople\b/i, enAlwaysPlural: true, natural: true },
  { es_s: 'deber', es_p: 'deberes', en: /\bhomework\b/i, enUncountable: true, natural: true },
  { es_s: 'vacación', es_p: 'vacaciones', en: /\b(holiday|vacation)\b/i, natural: true },
];

// ── Class HARD: grammar above A0/A1 (FB56 "desde hace" + present perfect)
const HARD_EN = [/\b(have|has)\s+been\b/i, /\b(have|has)\s+had\b/i, /\bused to\b/i, /\bhad\s+\w+ed\b/i];
const HARD_ES = [
  /\bdesde hace\b/i,                              // "desde hace dos años"
  /\bllev[oae]\b[^.?!]{0,25}\baños?\b/i,          // "llevo X años ..."
  /\b(he|has|ha|hemos|habéis|han)\s+\w+(ado|ido)\b/i, // pretérito perfecto (haber + participle)
  /\bhab[íi]a\b/i,                                // pluscuamperfecto / imperfect "había"
];

// ── Class AGE: "Mi edad es X años" instead of "Tengo X años" (FB55)
const AGE_ES = /\bedad\s+(es|era)\b/i;

// ── Class OBSCURE-EN: rare EN words a beginner can't produce (FB57 "delighted").
// Small starter blocklist; extend as more show up. A0/A1 scope only.
const OBSCURE_EN = /\b(delighted|fond|keen|dull|weary|thorough|utterly|henceforth|whom|whilst|amid|seldom)\b/i;

// ── Class AMBIG: color word == the subject object it describes (FB58 fruta/naranja).
const AMBIG_ES = [
  { re: /\bfruta\b[^.?!]*\bnaranja\b/i, note: 'naranja = fruit AND color' },
  { re: /\bflor\b[^.?!]*\brosa\b/i, note: 'rosa = flower AND color' },
];

function numberOfEs(sentence, noun) {
  const hasP = new RegExp(`\\b${noun.es_p}\\b`, 'i').test(sentence);
  const hasS = new RegExp(`\\b${noun.es_s}\\b`, 'i').test(sentence);
  if (hasP) return 'plural';
  if (hasS) return 'singular';
  return null;
}

const findings = [];
function add(card, cls, why) {
  findings.push({ level: card.level, id: card.id, topic: card.topic || '-', cls, why,
    es: card.sentence_es || '', en: card.sentence_en || '' });
}

for (const lvl of levels) {
  let cards;
  try {
    cards = JSON.parse(readFileSync(join(ROOT, 'data', 'words', `${lvl}.json`), 'utf8'));
  } catch {
    console.error(`skip ${lvl}: no data/words/${lvl}.json`);
    continue;
  }
  const lowLevel = lvl === 'a0' || lvl === 'a1';
  for (const c of cards) {
    const es = c.sentence_es || '';
    const en = c.sentence_en || '';
    if (!es && !en) continue;

    // NUM / COLL (skip the naturally-divergent nouns entirely)
    for (const n of NUM_NOUNS) {
      if (n.natural) continue;
      const esNum = numberOfEs(es, n);
      if (!esNum || !n.en.test(en)) continue;
      const enPlural = n.enAlwaysPlural || /\b(vegetables|fruits)\b/i.test(en);
      const enNum = n.enUncountable ? 'uncountable' : (enPlural ? 'plural' : 'singular');
      const disagree =
        (enNum === 'plural' && esNum === 'singular') ||
        (enNum === 'singular' && esNum === 'plural') ||
        (n.enUncountable && esNum === 'plural');
      if (disagree) add(c, n.cls, `EN ${enNum} vs ES ${esNum} (${n.es_s})`);
    }

    // HARD, flag on the SPANISH side (that is the tile the learner assembles);
    // an EN-only complex tense with a simple ES sentence is not a learner problem.
    if (lowLevel && HARD_ES.some(r => r.test(es))) {
      add(c, 'HARD', 'ES complex grammar (perfecto / desde hace / había)');
    }

    // AGE
    if (AGE_ES.test(es)) add(c, 'AGE', 'edad-es construction (prefer "Tengo X años")');

    // OBSCURE-EN (A0/A1 only)
    if (lowLevel && OBSCURE_EN.test(en)) add(c, 'OBSCURE', `rare EN word: ${en.match(OBSCURE_EN)[0]}`);

    // AMBIG
    for (const a of AMBIG_ES) if (a.re.test(es)) add(c, 'AMBIG', a.note);
  }
}

// Report, grouped by class.
const byClass = {};
for (const f of findings) (byClass[f.cls] ||= []).push(f);
const order = ['NUM', 'COLL', 'HARD', 'AGE', 'OBSCURE', 'AMBIG'];
console.log(`Sentence-QA, levels: ${levels.join(', ')}, ${findings.length} finding(s)\n`);
for (const cls of order) {
  const list = byClass[cls] || [];
  console.log(`## ${cls}: ${list.length}`);
  for (const f of list) {
    console.log(`  [${f.level} #${f.id} ${f.topic}] ${f.why}`);
    console.log(`     es: ${f.es}`);
    console.log(`     en: ${f.en}`);
  }
  console.log('');
}
process.exitCode = findings.length ? 1 : 0;
