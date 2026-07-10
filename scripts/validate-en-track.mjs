#!/usr/bin/env node
/**
 * validate-en-track.mjs, Structural gate for the English (hu→en) track.
 *
 * Checks (topics/sublevels always; cards when the word file exists):
 *  - topics: order contiguous from 1, unique ids, unique icons, type in
 *    {grammar,vocab}, all name_* + icon present, every subLevel referenced exists,
 *    sublevel orders contiguous from 1.
 *  - cards: required fields present + non-empty (id, level, es, hu, en, de, topic,
 *    topicOrder, sentence_{es,hu,en,de}); level matches file; id within the level's
 *    reserved block; ids globally unique across the en track; card.topic exists in
 *    that level's topic list.
 *  - cross-level dedup: one English headword (normalized `en`) is taught in exactly
 *    one level+topic (so A2 can't re-teach an A0/A1 word).
 *
 * Run: node scripts/validate-en-track.mjs   (exit 1 on any violation, build gate)
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LEVELS = ['A0', 'A1', 'A2'];

// Reserved, non-overlapping id blocks per en level.
const ID_RANGE = { A0: [5800, 5999], A1: [5001, 5399], A2: [5400, 5799] };

const errors = [];
const err = (m) => errors.push(m);
const loadJson = (p) => (existsSync(join(ROOT, p)) ? JSON.parse(readFileSync(join(ROOT, p), 'utf8')) : null);
const normEn = (s) => (s ?? '').toLowerCase().replace(/['’]/g, '').replace(/[.,;:!?"()]/g, '').trim();

// --- topics + sublevels ---
const topicIdsByLevel = {};
for (const lvl of LEVELS) {
  const L = lvl.toLowerCase();
  const T = loadJson(`data/topics/en/${L}.json`);
  const S = loadJson(`data/sublevels/en/${L}.json`);
  if (!T || !S) { topicIdsByLevel[lvl] = new Set(); continue; }
  const orders = T.map((t) => t.order);
  if (!orders.every((o, i) => o === i + 1)) err(`${lvl} topics: order not contiguous from 1`);
  const ids = T.map((t) => t.id);
  if (new Set(ids).size !== ids.length) err(`${lvl} topics: duplicate id`);
  const icons = T.map((t) => t.icon);
  if (new Set(icons).size !== icons.length) err(`${lvl} topics: duplicate icon`);
  const subIds = new Set(S.map((s) => s.id));
  for (const t of T) {
    if (!['grammar', 'vocab'].includes(t.type)) err(`${lvl} topic ${t.id}: bad type ${t.type}`);
    if (!(t.name_hu && t.name_en && t.name_es && t.name_de && t.icon)) err(`${lvl} topic ${t.id}: missing name/icon`);
    if (!subIds.has(t.subLevel)) err(`${lvl} topic ${t.id}: subLevel ${t.subLevel} not defined`);
  }
  if (!S.map((s) => s.order).every((o, i) => o === i + 1)) err(`${lvl} sublevels: order not contiguous from 1`);
  topicIdsByLevel[lvl] = new Set(ids);
}

// --- cards ---
const REQUIRED = ['id', 'level', 'es', 'hu', 'en', 'de', 'topic', 'topicOrder', 'sentence_es', 'sentence_hu', 'sentence_en', 'sentence_de'];
const seenId = new Map();       // id → level
const seenHeadword = new Map();  // normalized en → "level/topic"
let totalCards = 0;

for (const lvl of LEVELS) {
  const cards = loadJson(`data/words/en/${lvl.toLowerCase()}.json`);
  if (!cards) continue;
  totalCards += cards.length;
  const [lo, hi] = ID_RANGE[lvl];
  for (const c of cards) {
    for (const f of REQUIRED) {
      if (c[f] === undefined || c[f] === null || c[f] === '') err(`${lvl} card ${c.id ?? '?'}: missing/empty field ${f}`);
    }
    if (c.level !== lvl) err(`${lvl} card ${c.id}: level field is ${c.level}`);
    if (typeof c.id === 'number' && (c.id < lo || c.id > hi)) err(`${lvl} card ${c.id}: id outside block ${lo}-${hi}`);
    if (seenId.has(c.id)) err(`duplicate id ${c.id} (${seenId.get(c.id)} + ${lvl})`);
    else seenId.set(c.id, lvl);
    if (c.topic && !topicIdsByLevel[lvl].has(c.topic)) err(`${lvl} card ${c.id}: topic ${c.topic} not in ${lvl} topic list`);
    const hw = normEn(c.en);
    if (hw) {
      const where = `${lvl}/${c.topic}`;
      if (seenHeadword.has(hw) && seenHeadword.get(hw) !== where) {
        err(`cross-level dup headword "${hw}": ${seenHeadword.get(hw)} + ${where}`);
      } else if (!seenHeadword.has(hw)) {
        seenHeadword.set(hw, where);
      }
    }
  }
}

console.log('en-track validation:');
for (const lvl of LEVELS) console.log(`  ${lvl} topics: ${topicIdsByLevel[lvl].size}`);
console.log(`  total cards: ${totalCards}`);
if (errors.length === 0) {
  console.log('VALIDATE OK');
  process.exit(0);
} else {
  console.log(`VALIDATE FAIL (${errors.length}):`);
  for (const e of errors.slice(0, 40)) console.log('  - ' + e);
  process.exit(1);
}
