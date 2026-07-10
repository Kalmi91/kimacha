#!/usr/bin/env node
/**
 * audit-corpus-en.mjs, English-target (hu→en) corpus audit.
 *
 * Guarantee: every `sentence_en` uses ONLY English words the learner has already
 * been taught (some card's `en` field), level-cumulative:
 *   A0 sentence_en ⊆ taught(A0)
 *   A1 sentence_en ⊆ taught(A0 ∪ A1)
 *   A2 sentence_en ⊆ taught(A0 ∪ A1 ∪ A2)
 * plus a glue whitelist of English function words that are never taught as cards.
 *
 * This is the en-track counterpart of scripts/audit-corpus.mjs (Spanish flagship,
 * left byte-untouched). Run: node scripts/audit-corpus-en.mjs
 * Exit 1 if any P1 (untaught token) is found, used as a build gate.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LEVELS = ['A0', 'A1', 'A2'];

// ---------------------------------------------------------------------------
// Glue whitelist, English function words NOT taught as vocabulary cards.
// Content words (nouns/verbs/adjectives/adverbs) must NOT be added here.
// ---------------------------------------------------------------------------
const GLUE_WHITELIST = new Set([
  // articles
  'a', 'an', 'the',
  // subject / object pronouns
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'us', 'them',
  // possessive adjectives / pronouns
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'mine', 'yours', 'hers', 'ours', 'theirs',
  // demonstratives
  'this', 'that', 'these', 'those',
  // to be
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  // auxiliaries / modals + contracted forms (apostrophes are stripped on tokenize)
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'shall',
  'should', 'can', 'could', 'may', 'might', 'must',
  'im', 'youre', 'hes', 'shes', 'its', 'were', 'theyre',
  'dont', 'doesnt', 'didnt', 'isnt', 'arent', 'wasnt', 'werent',
  'cant', 'cannot', 'wont', 'wouldnt', 'couldnt', 'shouldnt', 'mustnt',
  'ive', 'youve', 'weve', 'theyve', 'ill', 'youll', 'hell', 'well', 'theyll',
  'id', 'youd', 'hed', 'wed', 'theyd', 'lets', 'thats', 'whats', 'wheres',
  // prepositions
  'in', 'on', 'at', 'to', 'of', 'for', 'with', 'from', 'by', 'about',
  'into', 'onto', 'over', 'under', 'up', 'down', 'out', 'off', 'as',
  'than', 'between', 'near', 'through', 'after', 'before', 'during',
  // conjunctions
  'and', 'or', 'but', 'so', 'because', 'if', 'when', 'while', 'though',
  'although', 'nor', 'yet',
  // wh-words (also taught in question_words, whitelisted for safety)
  'what', 'who', 'whom', 'whose', 'which', 'where', 'why', 'how',
  // negation / affirmation / degree / common particles
  'not', 'no', 'yes', 'very', 'too', 'also', 'here', 'there', 'now',
  'then', 'some', 'any', 'many', 'much', 'more', 'most', 'all', 'both',
  'each', 'every', 'few', 'lot', 'lots', 'only', 'just', 'again',
  // number placeholders that recur as glue in dates/times if not yet taught
  'oclock',
]);

// Proper nouns accepted anywhere (transparent names/places, not taught vocab).
const PROPER_NOUN_LIST = new Set([
  'london', 'england', 'america', 'europe', 'spain', 'hungary',
  'john', 'mary', 'anna', 'tom', 'monday',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** lowercase, drop apostrophes (join contractions), other punctuation → space */
function normalizeEn(str) {
  return str
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[¡!¿?.,;:"()\-–, /]/g, ' ')
    .trim();
}

function tokenizeEn(str) {
  return normalizeEn(str).split(/\s+/).filter((t) => t.length > 0);
}

/**
 * Candidate stem set for an English token: the token plus conservative
 * de-inflections (plural, 3rd-person, past, gerund, comparative/superlative).
 * Symmetric matching is achieved by expanding both taught words and sentence
 * tokens through the same function and intersecting.
 */
function stemForms(token) {
  const t = token;
  const forms = new Set([t]);
  const add = (s) => { if (s && s.length >= 2) forms.add(s); };

  if (t.endsWith('ies') && t.length > 4) { add(t.slice(0, -3) + 'y'); }
  if (t.endsWith('es') && t.length > 3) { add(t.slice(0, -2)); add(t.slice(0, -1)); }
  if (t.endsWith('s') && !t.endsWith('ss') && t.length > 3) { add(t.slice(0, -1)); }
  if (t.endsWith('ied') && t.length > 4) { add(t.slice(0, -3) + 'y'); }
  if (t.endsWith('ed') && t.length > 4) { add(t.slice(0, -2)); add(t.slice(0, -1)); }
  if (t.endsWith('ing') && t.length > 5) { add(t.slice(0, -3)); add(t.slice(0, -3) + 'e'); }
  if (t.endsWith('est') && t.length > 4) { add(t.slice(0, -3)); add(t.slice(0, -2)); }
  if (t.endsWith('er') && t.length > 3) { add(t.slice(0, -2)); add(t.slice(0, -1)); }
  return forms;
}

// ---------------------------------------------------------------------------
// Load en-track data (graceful if a level's word file does not exist yet)
// ---------------------------------------------------------------------------

function loadCards(level) {
  const p = join(ROOT, `data/words/en/${level.toLowerCase()}.json`);
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, 'utf8'));
}

const cardsByLevel = {};
for (const lvl of LEVELS) cardsByLevel[lvl] = loadCards(lvl);

// taught stem set per level (from card.en), and cumulative sets
const taughtStemByLevel = {};
for (const lvl of LEVELS) {
  const s = new Set();
  for (const card of cardsByLevel[lvl]) {
    for (const tok of tokenizeEn(card.en ?? '')) {
      for (const f of stemForms(tok)) s.add(f);
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
  if (PROPER_NOUN_LIST.has(tok)) return true;
  for (const f of stemForms(tok)) {
    if (taughtStems.has(f)) return true;
  }
  return false;
}

for (const lvl of LEVELS) {
  const taught = cumulativeTaught(lvl);
  for (const card of cardsByLevel[lvl]) {
    const missing = [];
    for (const tok of tokenizeEn(card.sentence_en ?? '')) {
      if (!tokenTaught(tok, taught)) missing.push(tok);
    }
    if (missing.length > 0) {
      p1Issues.push({ id: card.id, level: lvl, topic: card.topic ?? '', sentence_en: card.sentence_en, missing });
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

let report = `# English-track Corpus Audit\n\nGenerated: ${new Date().toISOString()}\n\n## Summary\n\n`;
for (const lvl of LEVELS) report += `- ${lvl} cards: ${cardsByLevel[lvl].length}\n`;
report += `- P1 issues (untaught token in sentence_en): **${p1Issues.length}**\n\n`;
report += `## P1 Issues\n\n`;
if (p1Issues.length === 0) {
  report += `None, every sentence_en uses only taught English vocabulary.\n`;
} else {
  for (const it of p1Issues) {
    report += `- **Card ${it.id}** (${it.level}, \`${it.topic}\`)\n  - \`${it.sentence_en}\`\n  - Missing: ${it.missing.map((t) => `\`${t}\``).join(', ')}\n`;
  }
}
writeFileSync(join(ROOT, 'scripts/audit-report-en.md'), report, 'utf8');

console.log('English-track audit complete.');
for (const lvl of LEVELS) console.log(`  ${lvl} cards: ${cardsByLevel[lvl].length}`);
console.log(`P1 (untaught): ${p1Issues.length}`);
console.log('Report: scripts/audit-report-en.md');
process.exit(p1Issues.length > 0 ? 1 : 0);
