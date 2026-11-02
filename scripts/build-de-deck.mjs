#!/usr/bin/env node
// Builds the German deck data/words/de/{a1,a2,b1,b2,c1}.json from the three source decks and their
// gloss-hu / gloss-de overlays. Deterministic and re-runnable, the output is never edited by hand.
//
//   node scripts/build-de-deck.mjs          write the deck files and print the counts
//   node scripts/build-de-deck.mjs --check  exit 1 when the committed files differ from what would be built
//
// Rules (see the German expansion contract):
//   - sources: words-open (Spanish deck, key = order), en deck (key = id), hu deck (key = id)
//   - level map: words-open a1..c1 -> A1..C1; en and hu a0 + a1 -> A1, a2..c1 -> same level
//   - ids: 100000 + order (words-open), 200000 + id (en), 300000 + id (hu); src = o<order> | e<id> | h<id>
//   - a German headword appears once (key: lower-case, article and parenthetical stripped), at the LOWEST
//     level; within a level the priority is words-open > en > hu, then file order
//   - a card is kept only when it has all four meanings and all four sentences

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1'];
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const readIfExists = (rel) => (fs.existsSync(path.join(ROOT, rel)) ? read(rel) : []);
const byKey = (rows) => new Map(rows.map((r) => [r.k, r]));
const text = (v) => (typeof v === 'string' ? v.trim() : '');

// One entry per source file, in the order they are considered inside a level.
// `files` lists the card files that feed the level (the en and hu decks fold a0 into A1).
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
    name: 'en',
    prefix: 'e',
    base: 200000,
    key: 'id',
    levelFiles: { a1: ['a0', 'a1'], a2: ['a2'], b1: ['b1'], b2: ['b2'], c1: ['c1'] },
    dir: 'data/words/en',
    glossHu: 'data/words/en/gloss-hu',
    glossDe: 'data/words/en/gloss-de',
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
  const gd = glossDe.get(k);
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
  for (const f of ['de', 'es', 'en', 'hu', 'sentence_de', 'sentence_es', 'sentence_en', 'sentence_hu']) {
    if (!out[f]) return null;
  }
  return out;
}

export function buildDeck() {
  const seen = new Map(); // headword key -> src of the card that owns it
  const decks = Object.fromEntries(LEVELS.map((l) => [l, []]));
  const stats = { considered: 0, incomplete: 0, duplicate: 0, kept: 0, bySource: {}, perLevel: {} };
  for (const level of LEVELS) {
    for (const src of SOURCES) {
      for (const file of src.levelFiles[level]) {
        const cards = readIfExists(`${src.dir}/${file}.json`);
        const glossDe = byKey(readIfExists(`${src.glossDe}/${file}.json`));
        const glossHu = src.glossHu ? byKey(readIfExists(`${src.glossHu}/${file}.json`)) : null;
        for (const card of cards) {
          stats.considered += 1;
          const out = toCard(src, level, file, card, glossDe, glossHu);
          if (!out) {
            stats.incomplete += 1;
            continue;
          }
          const key = headwordKey(out.de);
          if (seen.has(key)) {
            stats.duplicate += 1;
            continue;
          }
          seen.set(key, out.src);
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
