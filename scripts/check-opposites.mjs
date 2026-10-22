// Gate for the opposite pairs (data/practice/opposites.json), the word source of the "Opposites" practice game.
// Usage: node scripts/check-opposites.mjs
// Rules (every violation is an error, exit 1; the last line is the summary):
//   O1  file shape: an array of { "a": string, "b": string }, nothing else, no blank or padded strings
//   O2  no self pair (a === b)
//   O3  both members exist as a `lemma` in data/words-open/{a1,a2,b1}.json (exact match, accents included)
//   O4  both members are A1-B1 words (a lemma that exists only in b2/c1 is an error)
//   O5  part of speech agrees: the A1-B1 cards of `a` and `b` share a `pos`
//   O6  no repeated pair (a-b is the same pair as b-a)
//   O7  a lemma is in at most 2 pairs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'practice', 'opposites.json');
const WORDS_DIR = path.join(ROOT, 'data', 'words-open');
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1'];
const LEVEL_RANK = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };
const MAX_RANK = LEVEL_RANK.B1;
const MAX_PAIRS_PER_LEMMA = 2;

const RULES = {};
function fail(rule, msg) {
  (RULES[rule] ||= []).push(msg);
}

// lemma -> { rank: lowest level rank, pos: Set of `pos` over the A1-B1 cards }
const words = new Map();
for (const level of LEVELS) {
  const cards = JSON.parse(fs.readFileSync(path.join(WORDS_DIR, `${level}.json`), 'utf8'));
  for (const card of cards) {
    const rank = LEVEL_RANK[card.level];
    const entry = words.get(card.lemma) || { rank, pos: new Set() };
    entry.rank = Math.min(entry.rank, rank);
    if (rank <= MAX_RANK) entry.pos.add(card.pos);
    words.set(card.lemma, entry);
  }
}

let pairs;
try {
  pairs = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  console.error(`opposites.json cannot be read: ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(pairs)) {
  console.error('O1: the file must be an array of { "a", "b" } objects');
  process.exit(1);
}

const seen = new Map();
const perLemma = new Map();
const perLevel = { A1: 0, A2: 0, B1: 0 };
const RANK_NAME = ['', 'A1', 'A2', 'B1'];

pairs.forEach((pair, i) => {
  const where = `#${i + 1}`;
  const keys = pair && typeof pair === 'object' ? Object.keys(pair) : [];
  const shapeOk =
    keys.length === 2 &&
    keys.includes('a') &&
    keys.includes('b') &&
    [pair.a, pair.b].every((v) => typeof v === 'string' && v.length > 0 && v === v.trim());
  if (!shapeOk) {
    fail('O1', `${where} ${JSON.stringify(pair)}`);
    return;
  }
  const { a, b } = pair;
  const label = `${where} ${a}-${b}`;

  if (a === b) fail('O2', label);

  const wa = words.get(a);
  const wb = words.get(b);
  if (!wa) fail('O3', `${label}: "${a}" is not a lemma in data/words-open`);
  if (!wb) fail('O3', `${label}: "${b}" is not a lemma in data/words-open`);

  if (wa && wa.rank > MAX_RANK) fail('O4', `${label}: "${a}" is above B1`);
  if (wb && wb.rank > MAX_RANK) fail('O4', `${label}: "${b}" is above B1`);

  if (wa && wb && wa.pos.size && wb.pos.size && ![...wa.pos].some((p) => wb.pos.has(p))) {
    fail('O5', `${label}: ${[...wa.pos].join('/')} vs ${[...wb.pos].join('/')}`);
  }

  const key = [a, b].sort().join('|');
  if (seen.has(key)) fail('O6', `${label} repeats ${seen.get(key)}`);
  else seen.set(key, where);

  for (const lemma of new Set([a, b])) perLemma.set(lemma, (perLemma.get(lemma) || 0) + 1);

  if (wa && wb && Math.max(wa.rank, wb.rank) <= MAX_RANK) perLevel[RANK_NAME[Math.max(wa.rank, wb.rank)]] += 1;
});

for (const [lemma, n] of perLemma) {
  if (n > MAX_PAIRS_PER_LEMMA) fail('O7', `"${lemma}" is in ${n} pairs (max ${MAX_PAIRS_PER_LEMMA})`);
}

let errors = 0;
for (const [rule, list] of Object.entries(RULES).sort()) {
  errors += list.length;
  console.error(`${rule}: ${list.length} error(s)`);
  for (const msg of list.slice(0, 5)) console.error(`  ${msg}`);
}
console.log(
  `opposites: ${pairs.length} pairs (A1 ${perLevel.A1}, A2 ${perLevel.A2}, B1 ${perLevel.B1}), ${errors} error(s)`,
);
process.exit(errors ? 1 : 0);
