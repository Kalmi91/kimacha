#!/usr/bin/env node
/**
 * audit-corpus.mjs — Corpus audit: sentences must only use taught vocabulary
 * Task 11a — FB3 full audit
 * Run: node scripts/audit-corpus.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Glue whitelist — function words NOT in the vocabulary
// (articles, pronouns, prepositions, conjunctions, auxiliary forms)
// Content words (nouns/verbs/adjectives/adverbs) must NOT appear here.
// ---------------------------------------------------------------------------
const GLUE_WHITELIST = new Set([
  // articles
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  // subject pronouns
  'yo', 'tu', 'el', 'ella', 'nosotros', 'nosotras', 'vosotros', 'vosotras',
  'ellos', 'ellas', 'usted', 'ustedes',
  // object/reflexive pronouns
  'me', 'te', 'se', 'nos', 'le', 'les', 'lo', 'la', 'los', 'las',
  'mi', 'ti', 'si',
  // possessives (unstressed)
  'mi', 'tu', 'su', 'mis', 'tus', 'sus', 'nuestro', 'nuestra',
  'nuestros', 'nuestras', 'vuestro', 'vuestra', 'vuestros', 'vuestras',
  // prepositions
  'a', 'ante', 'bajo', 'con', 'contra', 'de', 'desde', 'durante',
  'en', 'entre', 'hacia', 'hasta', 'mediante', 'para', 'por', 'segun',
  'sin', 'sobre', 'tras',
  // conjunctions
  'y', 'e', 'o', 'u', 'pero', 'sino', 'que', 'porque', 'si',
  'aunque', 'cuando', 'como', 'donde', 'mientras', 'ni', 'pues',
  'ya', 'tanto', 'tan',
  // demonstratives
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
  'aquel', 'aquella', 'aquellos', 'aquellas', 'esto', 'eso', 'aquello',
  // auxiliaries / copulas (forms of ser/estar/haber/tener not in vocab)
  'es', 'son', 'somos', 'soy', 'eres', 'sois',
  'esta', 'estan', 'estoy', 'estas', 'estamos', 'estais',
  'hay', 'ha', 'he', 'has', 'hemos', 'han',
  // common adverbs / particles
  'no', 'si', 'mas', 'muy', 'bien', 'mal', 'ya', 'aqui', 'alli',
  'ahi', 'hoy', 'ayer', 'manana', 'ahora', 'luego', 'siempre', 'nunca',
  'tambien', 'tampoco', 'solo', 'solo', 'cerca', 'lejos', 'antes', 'despues',
  // interrogatives / relatives
  'que', 'quien', 'quienes', 'cual', 'cuales', 'cuanto', 'cuanta',
  'cuantos', 'cuantas', 'donde', 'cuando', 'como',
  // negation, affirmation
  'no', 'si', 'claro',
  // contractions
  'del', 'al',
  // quantifiers / distributors (functional, no teachable lexical content)
  'cada',
  // prepositional pronouns (compound prep+pronoun, not content)
  'conmigo', 'contigo', 'consigo',
]);

// Pre-compute accent-stripped glue whitelist for fast lookup
const GLUE_WHITELIST_STRIPPED = new Set([...GLUE_WHITELIST].map(w => w.normalize('NFD').replace(/[̀-ͯ]/g, '')));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize: lowercase, remove punctuation, keep accents */
function normalize(str) {
  return str.toLowerCase().replace(/[¡!¿?.,;:'"()\-–\/]/g, ' ').trim();
}

/** Remove accents for stem comparison */
function removeAccents(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Tokenize a Spanish string */
function tokenize(str) {
  return normalize(str).split(/\s+/).filter(t => t.length > 0);
}

// All recognized verb endings: infinitives + present tense conjugations
// Sorted longest-first to avoid greedy undershooting
const VERB_ENDINGS = [
  'amos', 'emos', 'imos', 'ais', 'eis', 'an', 'en', 'is',
  'ar', 'er', 'ir',
  'as', 'es', 'o', 'a', 'e',
];

function getVerbStem(token) {
  const t = removeAccents(token);
  for (const ending of VERB_ENDINGS) {
    if (t.endsWith(ending) && t.length - ending.length >= 4) {
      return t.slice(0, t.length - ending.length);
    }
  }
  return null;
}

/**
 * Check if token matches a taught token via:
 * (a) exact match
 * (b) plural/gender variant (+s/+es; final o↔a)
 * (c) verb stem match (≥4-char stem, both have known verb endings)
 */
function matches(token, taughtSet) {
  if (taughtSet.has(token)) return true;

  const ta = removeAccents(token);

  // (b) plural/gender variants
  for (const t of taughtSet) {
    const ta2 = removeAccents(t);
    if (ta === ta2) return true;
    // +s / +es plural
    if (ta + 's' === ta2 || ta + 'es' === ta2) return true;
    if (ta2 + 's' === ta || ta2 + 'es' === ta) return true;
    // gender o↔a
    if (ta.slice(0, -1) === ta2.slice(0, -1)) {
      const e1 = ta.slice(-1), e2 = ta2.slice(-1);
      if ((e1 === 'o' && e2 === 'a') || (e1 === 'a' && e2 === 'o')) return true;
    }
    // plural gender: os↔as
    if (ta.slice(0, -2) === ta2.slice(0, -2)) {
      const e1 = ta.slice(-2), e2 = ta2.slice(-2);
      if ((e1 === 'os' && e2 === 'as') || (e1 === 'as' && e2 === 'os')) return true;
    }
  }

  // (c) verb stem
  const stem = getVerbStem(ta);
  if (stem && stem.length >= 4) {
    for (const t of taughtSet) {
      const tStem = getVerbStem(removeAccents(t));
      if (tStem && tStem === stem) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

const a0Cards = JSON.parse(readFileSync(join(ROOT, 'data/words/a0.json'), 'utf8'));
const a1Cards = JSON.parse(readFileSync(join(ROOT, 'data/words/a1.json'), 'utf8'));
const a1Topics = JSON.parse(readFileSync(join(ROOT, 'data/topics/a1.json'), 'utf8'));

// Build topic order map: topicId → order
const topicOrderMap = {};
for (const t of a1Topics) {
  topicOrderMap[t.id] = t.order;
}

// ---------------------------------------------------------------------------
// Build taught token sets with earliest introduction tracking
// token → { level, topicOrder }
// A0 cards have no topic → assign topicOrder = 0
// ---------------------------------------------------------------------------

const taughtTokenInfo = {}; // token → { level, topicOrder }

function recordToken(token, level, topicOrder) {
  const existing = taughtTokenInfo[token];
  if (!existing) {
    taughtTokenInfo[token] = { level, topicOrder };
  } else {
    // keep earliest: A0 < A1; within A1, lower topicOrder = earlier
    const existingScore = existing.level === 'A0' ? -1 : existing.topicOrder;
    const newScore = level === 'A0' ? -1 : topicOrder;
    if (newScore < existingScore) {
      taughtTokenInfo[token] = { level, topicOrder };
    }
  }
}

for (const card of a0Cards) {
  for (const token of tokenize(card.es)) {
    recordToken(token, 'A0', 0);
  }
}

for (const card of a1Cards) {
  const order = card.topicOrder ?? 99;
  for (const token of tokenize(card.es)) {
    recordToken(token, 'A1', order);
  }
}

const allTaughtTokens = new Set(Object.keys(taughtTokenInfo));

// A0-only taught set (for checking A0 sentences)
const a0TaughtTokens = new Set(
  Object.entries(taughtTokenInfo)
    .filter(([, v]) => v.level === 'A0')
    .map(([k]) => k)
);

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

const p1Issues = []; // sehol nincs tanítva
const p2Issues = []; // tanítva van, de később
const p2TokenCount = {}; // token → count for top-20

function auditCard(card, availableLevel) {
  const sentTokens = tokenize(card.sentence_es);
  const p1Tokens = [];
  const p2Tokens = [];

  const taughtSet = availableLevel === 'A0' ? a0TaughtTokens : allTaughtTokens;

  for (const tok of sentTokens) {
    // Glue check: accent-insensitive
    if (GLUE_WHITELIST.has(tok) || GLUE_WHITELIST_STRIPPED.has(removeAccents(tok))) continue;
    if (matches(tok, taughtSet)) continue;

    // Not in available set — is it in the full set (just later)?
    if (availableLevel === 'A1' && matches(tok, allTaughtTokens)) {
      // Find when it was introduced
      const intro = taughtTokenInfo[tok];
      let cardTopicOrder = card.topicOrder ?? 0;
      if (intro && intro.topicOrder > cardTopicOrder) {
        p2Tokens.push({ tok, introOrder: intro.topicOrder });
        p2TokenCount[tok] = (p2TokenCount[tok] || 0) + 1;
      }
      // if introOrder <= cardTopicOrder, it might be a stem/plural match for something later
      // but the token itself is taught later - still P2
      else if (intro) {
        p2Tokens.push({ tok, introOrder: intro.topicOrder });
        p2TokenCount[tok] = (p2TokenCount[tok] || 0) + 1;
      }
    } else if (!matches(tok, allTaughtTokens)) {
      p1Tokens.push(tok);
    }
  }

  if (p1Tokens.length > 0) {
    p1Issues.push({
      id: card.id,
      topic: card.topic ?? 'A0',
      topicOrder: card.topicOrder ?? 0,
      sentence_es: card.sentence_es,
      missingTokens: p1Tokens,
      card,
    });
  }
  if (p2Tokens.length > 0) {
    for (const { tok, introOrder } of p2Tokens) {
      p2Issues.push({
        id: card.id,
        topic: card.topic ?? 'A0',
        topicOrder: card.topicOrder ?? 0,
        sentence_es: card.sentence_es,
        tok,
        introOrder,
      });
    }
  }
}

for (const card of a0Cards) {
  auditCard(card, 'A0');
}
for (const card of a1Cards) {
  auditCard(card, 'A1');
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

// Group P1 by topic
const p1ByTopic = {};
for (const issue of p1Issues) {
  const key = issue.topic;
  if (!p1ByTopic[key]) p1ByTopic[key] = [];
  p1ByTopic[key].push(issue);
}

// Group P2 by topic
const p2ByTopic = {};
for (const issue of p2Issues) {
  const key = issue.topic;
  if (!p2ByTopic[key]) p2ByTopic[key] = [];
  p2ByTopic[key].push(issue);
}

const allTopics = new Set([...Object.keys(p1ByTopic), ...Object.keys(p2ByTopic)]);

let report = `# Corpus Audit Report\n\n`;
report += `Generated: ${new Date().toISOString()}\n\n`;
report += `## Summary\n\n`;
report += `- Total A0 cards: ${a0Cards.length}\n`;
report += `- Total A1 cards: ${a1Cards.length}\n`;
report += `- P1 issues (untaught token): **${p1Issues.length}**\n`;
report += `- P2 issues (taught but later): **${p2Issues.length}**\n\n`;

report += `## By Topic\n\n`;
report += `| Topic | P1 | P2 |\n|---|---|---|\n`;

const topicsSorted = ['A0', ...a1Topics.map(t => t.id)];
for (const topic of topicsSorted) {
  const p1c = (p1ByTopic[topic] || []).length;
  const p2c = (p2ByTopic[topic] || []).length;
  if (p1c > 0 || p2c > 0) {
    report += `| ${topic} | ${p1c} | ${p2c} |\n`;
  }
}

report += `\n## P1 Issues (untaught tokens — must fix)\n\n`;
if (p1Issues.length === 0) {
  report += `None — all sentences use only taught vocabulary.\n`;
} else {
  for (const issue of p1Issues) {
    report += `- **Card ${issue.id}** (topic: \`${issue.topic}\`, order: ${issue.topicOrder})\n`;
    report += `  - \`${issue.sentence_es}\`\n`;
    report += `  - Missing: ${issue.missingTokens.map(t => `\`${t}\``).join(', ')}\n`;
  }
}

report += `\n## P2 Issues — Top 20 tokens (taught but at later topic)\n\n`;
const top20 = Object.entries(p2TokenCount)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);
if (top20.length === 0) {
  report += `None.\n`;
} else {
  report += `| Token | Occurrences |\n|---|---|\n`;
  for (const [tok, cnt] of top20) {
    report += `| \`${tok}\` | ${cnt} |\n`;
  }
}

const reportPath = join(ROOT, 'scripts/audit-report.md');
writeFileSync(reportPath, report, 'utf8');

console.log(`Audit complete.`);
console.log(`P1 (untaught): ${p1Issues.length}`);
console.log(`P2 (later topic): ${p2Issues.length}`);
console.log(`Report: scripts/audit-report.md`);

// Exit with error if P1 > 0 (used by acceptance check)
process.exit(p1Issues.length > 0 ? 1 : 0);
