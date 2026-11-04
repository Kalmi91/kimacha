#!/usr/bin/env node
// Builds the German deck data/words/de/{a1,a2,b1,b2,c1}.json from the Spanish and Hungarian decks seen from the
// German side (their gloss-hu / gloss-de overlays), the way the Hungarian deck was built from the existing cards. Deterministic and re-runnable, the output is never edited by hand.
//
//   node scripts/build-de-deck.mjs          write the deck files and print the counts
//   node scripts/build-de-deck.mjs --check  exit 1 when the committed files differ from what would be built
//
// Rules (see the German expansion contract):
//   - sources: words-open (Spanish deck, key = order), the hu deck (key = id) and data/words/de-extra (a small German-native
//     card source for the words neither deck has: fressen, spüren, das Bad, haben, gern ...; key = id). The en deck is not a
//     source (its German gloss serves de→en); with it the deck grew to about 1.5 times the planned size at every level.
//   - level map: words-open a1..c1 -> A1..C1; hu a0 + a1 -> A1, a2..c1 -> same level; de-extra a1..c1 -> A1..C1
//   - ids: 100000 + order (words-open), 300000 + id (hu), 400000 + id (de-extra); src = o<order> | h<id> | x<id>
//     (200000 + id / e<id> stays reserved)
//   - a German headword appears once (key: lower-case, article and parenthetical stripped), at the LOWEST
//     level; within a level the priority is words-open > hu > de-extra, then file order
//   - exception: a de-extra card at a LOWER level than an existing card claims the headword. Every " / " branch of its
//     headword is claimed, so an existing card at a higher level with that branch is dropped (that is how "liegen" moves
//     from A2 to A1). A de-extra card is dropped when any of its branches is already owned at the same or a lower level.
//   - data/words/de-overrides.json maps a card's src (h6146) to the fields that replace the built ones, for texts that
//     came from the Hungarian deck and are not neutral for a learner (Budapest, Ungarisch ...); id, level, pos, src stay,
//     and duplicates are still judged on the headword before the override
//   - a card is kept only when it has all four meanings and all four sentences

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1'];
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const readIfExists = (rel) => (fs.existsSync(path.join(ROOT, rel)) ? read(rel) : []);
const byKey = (rows) => new Map(rows.map((r) => [r.k, r]));
const OVERRIDES = fs.existsSync(path.join(ROOT, 'data/words/de-overrides.json')) ? read('data/words/de-overrides.json') : {};
const ORIGINAL_DE = new Map(); // src -> built headword before an override, so duplicates are judged as before
const text = (v) => (typeof v === 'string' ? v.trim() : '');

// One entry per source file, in the order they are considered inside a level.
// `files` lists the card files that feed the level (the hu deck folds a0 into A1).
const SOURCES = [
  {
    name: 'open',
    prefix: 'o',
    base: 100000,
    key: 'order',
    levelFiles: { a1: ['a1'], a2: ['a2'], b1: ['b1'], b2: ['b2'], c1: ['c1'] },
    dir: 'data/words-open',
    glossHu: 'data/words-open/gloss-hu',
    glossDe: 'data/words-open/gloss-de',
  },
  {
    name: 'hu',
    prefix: 'h',
    base: 300000,
    key: 'id',
    levelFiles: { a1: ['a0', 'a1'], a2: ['a2'], b1: ['b1'], b2: ['b2'], c1: ['c1'] },
    dir: 'data/words/hu',
    glossHu: null, // the hu deck carries its own Hungarian
    glossDe: 'data/words/hu/gloss-de',
  },
  {
    name: 'extra',
    prefix: 'x',
    base: 400000,
    key: 'id',
    levelFiles: { a1: ['a1'], a2: ['a2'], b1: ['b1'], b2: ['b2'], c1: ['c1'] },
    dir: 'data/words/de-extra',
    glossHu: null,
    glossDe: null, // self-contained: the card carries its own German
  },
];

// Dedupe key: lower-case, parentheticals and a leading article stripped from every " / " branch.
export function headwordKey(de) {
  return de
    .split(' / ')
    .map((b) =>
      b
        .replace(/\([^)]*\)/g, ' ')
        .replace(/^\s*(der|die|das)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean)
    .join(' / ');
}

function toCard(src, level, file, card, glossDe, glossHu) {
  const k = card[src.key];
  const gd = src.glossDe ? glossDe.get(k) : { de: card.de, sentence_de: card.sentence_de };
  if (!gd) return null;
  let hu;
  let sentenceHu;
  if (src.glossHu) {
    const gh = glossHu.get(k);
    if (!gh) return null;
    hu = text(gh.hu);
    sentenceHu = text(gh.sentence_hu);
  } else {
    hu = text(card.hu);
    sentenceHu = text(card.sentence_hu);
  }
  const out = {
    id: src.base + k,
    level: level.toUpperCase(),
    de: text(gd.de),
    es: text(card.es),
    en: text(card.en),
    hu,
    sentence_de: text(gd.sentence_de),
    sentence_es: text(card.sentence_es),
    sentence_en: text(card.sentence_en),
    sentence_hu: sentenceHu,
    pos: card.pos,
    src: src.prefix + k,
  };
  if (OVERRIDES[out.src]) {
    ORIGINAL_DE.set(out.src, out.de);
    Object.assign(out, OVERRIDES[out.src]);
  }
  for (const f of ['de', 'es', 'en', 'hu', 'sentence_de', 'sentence_es', 'sentence_en', 'sentence_hu']) {
    if (!out[f]) return null;
  }
  return out;
}

export function branchKeys(de) {
  return headwordKey(de).split(' / ').filter(Boolean);
}

export function buildDeck() {
  const seen = new Map(); // headword key -> src of the card that owns it
  const seenBranches = new Set(); // every branch key of a kept card
  // branch key -> index of the lowest level at which a de-extra card claims it
  const claimed = new Map();
  const extra = SOURCES.find((s) => s.name === 'extra');
  LEVELS.forEach((level, li) => {
    for (const file of extra.levelFiles[level]) {
      for (const card of readIfExists(`${extra.dir}/${file}.json`)) {
        for (const b of branchKeys(text(card.de))) if (!claimed.has(b)) claimed.set(b, li);
      }
    }
  });
  const decks = Object.fromEntries(LEVELS.map((l) => [l, []]));
  const stats = { considered: 0, incomplete: 0, duplicate: 0, kept: 0, bySource: {}, perLevel: {} };
  for (const [li, level] of LEVELS.entries()) {
    for (const src of SOURCES) {
      for (const file of src.levelFiles[level]) {
        const cards = readIfExists(`${src.dir}/${file}.json`);
        const glossDe = src.glossDe ? byKey(readIfExists(`${src.glossDe}/${file}.json`)) : null;
        const glossHu = src.glossHu ? byKey(readIfExists(`${src.glossHu}/${file}.json`)) : null;
        for (const card of cards) {
          stats.considered += 1;
          const out = toCard(src, level, file, card, glossDe, glossHu);
          if (!out) {
            stats.incomplete += 1;
            continue;
          }
          const de0 = ORIGINAL_DE.get(out.src) ?? out.de;
          const key = headwordKey(de0);
          const branches = branchKeys(de0);
          const isExtra = src.name === 'extra';
          // an existing card gives way to a de-extra card of a lower level; a de-extra card gives way to any owner
          const claimedLower = !isExtra && branches.some((b) => claimed.has(b) && claimed.get(b) < li);
          if (seen.has(key) || claimedLower || (isExtra && branches.some((b) => seenBranches.has(b)))) {
            stats.duplicate += 1;
            continue;
          }
          seen.set(key, out.src);
          for (const b of branches) seenBranches.add(b);
          decks[level].push(out);
          stats.kept += 1;
          stats.bySource[src.name] = (stats.bySource[src.name] || 0) + 1;
        }
      }
    }
    stats.perLevel[level.toUpperCase()] = decks[level].length;
  }
  return { decks, stats };
}

const serialise = (cards) => (cards.length ? JSON.stringify(cards, null, 2) + '\n' : '[]\n');

function main() {
  const check = process.argv.includes('--check');
  const { decks, stats } = buildDeck();
  const drift = [];
  for (const level of LEVELS) {
    const rel = `data/words/de/${level}.json`;
    const abs = path.join(ROOT, rel);
    const body = serialise(decks[level]);
    if (check) {
      const current = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
      if (current !== body) drift.push(rel);
    } else {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, body);
    }
  }
  const per = Object.entries(stats.perLevel)
    .map(([l, n]) => `${l} ${n}`)
    .join(', ');
  const src = Object.entries(stats.bySource)
    .map(([s, n]) => `${s} ${n}`)
    .join(', ');
  console.log(`German deck: ${stats.kept} cards (${per}). Sources: ${src || 'none'}.`);
  console.log(`Considered ${stats.considered}, incomplete ${stats.incomplete}, duplicate headwords ${stats.duplicate}.`);
  if (check) {
    if (drift.length) {
      console.error(`German deck is out of date: ${drift.join(', ')}. Run node scripts/build-de-deck.mjs`);
      process.exit(1);
    }
    console.log('German deck files are up to date.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
