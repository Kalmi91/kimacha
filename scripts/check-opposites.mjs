// Gate for the opposite pairs, the word source of the "Opposites" practice game: data/practice/opposites.json (Spanish lemmas of
// data/words-open) and data/practice/opposites-de.json (German headwords of data/words/de, a noun with its article).
// Usage: node scripts/check-opposites.mjs
// Rules (every violation is an error, exit 1; the last lines are the summaries, one per file):
//   O1  file shape: an array of { "a": string, "b": string }, nothing else, no blank or padded strings
//   O2  no self pair (a === b)
//   O3  both members exist as a `lemma` in data/words-open/{a1,a2,b1}.json (exact match, accents included); German: as a headword
//       (an alternative of "der Ort / der Platz", without its bracketed gloss) in data/words/de/{a1,a2,b1}.json
//   O4  both members are A1-B1 words (a lemma that exists only in b2/c1 is an error)
//   O5  part of speech agrees: the A1-B1 cards of `a` and `b` share a `pos`
//   O6  no repeated pair (a-b is the same pair as b-a)
//   O7  a lemma is in at most 2 pairs
//   O8  German only, written form: a noun is "der / die / das" + a capitalised noun, anything else is lower case without an article
// While the German deck is still empty, O3-O5 cannot be decided for it: the German file is then checked for O1, O2, O6, O7, O8 only.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1'];
const LEVEL_RANK = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };
const MAX_RANK = LEVEL_RANK.B1;
const MAX_PAIRS_PER_LEMMA = 2;
const RANK_NAME = ['', 'A1', 'A2', 'B1'];

function readCards(dir) {
  return LEVELS.flatMap((level) => JSON.parse(fs.readFileSync(path.join(dir, `${level}.json`), 'utf8')));
}

// "der Ort / der Platz", "sein (Zustand, Ort)" -> the alternatives as written, without the bracketed gloss
const germanHeadwords = (de) =>
  de.split(' / ').map((alt) => alt.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);

// key -> { rank: lowest level rank, pos: Set of `pos` over the A1-B1 cards }
function indexCards(cards, keysOf) {
  const words = new Map();
  for (const card of cards) {
    const rank = LEVEL_RANK[card.level];
    for (const key of keysOf(card)) {
      const entry = words.get(key) || { rank, pos: new Set() };
      entry.rank = Math.min(entry.rank, rank);
      if (rank <= MAX_RANK) entry.pos.add(card.pos);
      words.set(key, entry);
    }
  }
  return words;
}

const WITH_ARTICLE = /^(der|die|das)\s+\S/;
const NOUN = /^(der|die|das)\s+\p{Lu}\p{Ll}*$/u;

// O8: the written form of one German member (the problem as text, or null)
function germanFormProblem(w) {
  if (WITH_ARTICLE.test(w)) return NOUN.test(w) ? null : `"${w}" has an article but is not a single capitalised noun`;
  if (/^\p{Lu}/u.test(w)) return `"${w}" is capitalised but has no article`;
  return /\p{Lu}/u.test(w) ? `"${w}" is not a noun but has a capital letter` : null;
}

function check({ file, label, words, german }) {
  const rules = {};
  const fail = (rule, msg) => (rules[rule] ||= []).push(msg);
  let pairs;
  try {
    pairs = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`${label} cannot be read: ${e.message}`);
    return { errors: 1 };
  }
  if (!Array.isArray(pairs)) {
    console.error(`${label} O1: the file must be an array of { "a", "b" } objects`);
    return { errors: 1 };
  }

  const seen = new Map();
  const perLemma = new Map();
  const perLevel = { A1: 0, A2: 0, B1: 0 };
  const where = german ? 'a headword in data/words/de' : 'a lemma in data/words-open';

  pairs.forEach((pair, i) => {
    const at = `#${i + 1}`;
    const keys = pair && typeof pair === 'object' ? Object.keys(pair) : [];
    const shapeOk =
      keys.length === 2 &&
      keys.includes('a') &&
      keys.includes('b') &&
      [pair.a, pair.b].every((v) => typeof v === 'string' && v.length > 0 && v === v.trim());
    if (!shapeOk) {
      fail('O1', `${at} ${JSON.stringify(pair)}`);
      return;
    }
    const { a, b } = pair;
    const name = `${at} ${a}-${b}`;

    if (a === b) fail('O2', name);

    if (german) {
      for (const w of [a, b]) {
        const problem = germanFormProblem(w);
        if (problem) fail('O8', `${name}: ${problem}`);
      }
    }

    const wa = words?.get(a);
    const wb = words?.get(b);
    if (words) {
      if (!wa) fail('O3', `${name}: "${a}" is not ${where}`);
      if (!wb) fail('O3', `${name}: "${b}" is not ${where}`);
      if (wa && wa.rank > MAX_RANK) fail('O4', `${name}: "${a}" is above B1`);
      if (wb && wb.rank > MAX_RANK) fail('O4', `${name}: "${b}" is above B1`);
      if (wa && wb && wa.pos.size && wb.pos.size && ![...wa.pos].some((p) => wb.pos.has(p))) {
        fail('O5', `${name}: ${[...wa.pos].join('/')} vs ${[...wb.pos].join('/')}`);
      }
    }

    const key = [a, b].sort().join('|');
    if (seen.has(key)) fail('O6', `${name} repeats ${seen.get(key)}`);
    else seen.set(key, at);

    for (const lemma of new Set([a, b])) perLemma.set(lemma, (perLemma.get(lemma) || 0) + 1);

    if (wa && wb && Math.max(wa.rank, wb.rank) <= MAX_RANK) perLevel[RANK_NAME[Math.max(wa.rank, wb.rank)]] += 1;
  });

  for (const [lemma, n] of perLemma) {
    if (n > MAX_PAIRS_PER_LEMMA) fail('O7', `"${lemma}" is in ${n} pairs (max ${MAX_PAIRS_PER_LEMMA})`);
  }

  let errors = 0;
  for (const [rule, list] of Object.entries(rules).sort()) {
    errors += list.length;
    console.error(`${label} ${rule}: ${list.length} error(s)`);
    for (const msg of list.slice(0, 5)) console.error(`  ${msg}`);
  }
  const levels = words ? ` (A1 ${perLevel.A1}, A2 ${perLevel.A2}, B1 ${perLevel.B1})` : ' (German deck empty, words not checked)';
  console.log(`${label}: ${pairs.length} pairs${levels}, ${errors} error(s)`);
  return { errors };
}

const spanish = check({
  file: path.join(ROOT, 'data', 'practice', 'opposites.json'),
  label: 'opposites',
  words: indexCards(readCards(path.join(ROOT, 'data', 'words-open')), (card) => [card.lemma]),
  german: false,
});

const germanCards = readCards(path.join(ROOT, 'data', 'words', 'de'));
const german = check({
  file: path.join(ROOT, 'data', 'practice', 'opposites-de.json'),
  label: 'opposites-de',
  // an empty German deck cannot say anything about the words: only the written form is checked then
  words: germanCards.length ? indexCards(germanCards, (card) => germanHeadwords(card.de)) : null,
  german: true,
});

process.exit(spanish.errors + german.errors ? 1 : 0);
