#!/usr/bin/env node
/**
 * freq-order.mjs, PLAN-freq.md 2-3. lépés: a `data/words/{level}.json`
 * kártyáit szinten belül a FrequencyWords es_50k lista (CC BY-SA 4.0)
 * szerinti gyakoriságra rendezi (a jelenlegi SUBTLEX-ESP alapú sorrend
 * helyett, ld. a PLAN fejlécét). Szint közötti áthelyezés NEM történik,
 * csak a tömbön belüli sorrend változik.
 *
 * Run:       node scripts/freq-order.mjs          (rendez + felülír)
 * Ellenőrzés: node scripts/freq-order.mjs --check  (nem ír, 1-gyel lép ki,
 *             ha bármelyik fájl sorrendje eltér a számított rangsortól)
 *
 * A lista forrása: https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt
 * Cache: os.tmpdir()/es_50k.txt (ha megvan, nem tölti le újra).
 *
 * A kulcs- és rangoló logika (ARTICLES/PRONOUNS/stripAccents/tokenizeEs/
 * parseFreqList/rankOfToken/cardRank/sortByFreqRank) a lib/freqOrder.ts-ben
 * él; ez a szkript .mjs, nem tud TS-t importálni build-lépés nélkül, ezért
 * az alábbi blokk DUPLIKÁLVA van innen (keep in sync; a TS oldalt a
 * lib/__tests__/freqOrder.test.ts fedi).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LIST_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt';
const CACHE_PATH = join(tmpdir(), 'es_50k.txt');
const LEVELS = ['a0', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
const CHECK = process.argv.includes('--check');

// --- same as lib/freqOrder.ts, keep in sync ----------------------------------

const ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas']);
const PRONOUNS = new Set([
  'yo', 'tú', 'él', 'ella', 'usted',
  'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'ustedes',
]);

export function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function tokenizeEs(es) {
  const withoutParens = es.replace(/\([^)]*\)/g, '');
  const cleaned = withoutParens.toLowerCase().replace(/[¿?¡!.,;:"()]/g, '');
  const rawTokens = cleaned
    .split(/[\s/]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const filtered = rawTokens.filter((t) => !ARTICLES.has(t) && !PRONOUNS.has(t));
  return filtered.length > 0 ? filtered : rawTokens;
}

export function parseFreqList(text) {
  const exact = new Map();
  const folded = new Map();
  let rank = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const spaceIdx = trimmed.indexOf(' ');
    const word = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
    if (!word) continue;
    rank += 1;
    if (!exact.has(word)) exact.set(word, rank);
    const fold = stripAccents(word);
    const best = folded.get(fold);
    if (best === undefined || rank < best) folded.set(fold, rank);
  }
  return { exact, folded };
}

export function rankOfToken(token, index) {
  const exact = index.exact.get(token);
  if (exact !== undefined) return exact;
  const folded = index.folded.get(stripAccents(token));
  return folded !== undefined ? folded : Infinity;
}

export function cardRank(es, index) {
  const tokens = tokenizeEs(es);
  if (tokens.length === 0) return Infinity;
  let worst = 0;
  for (const token of tokens) worst = Math.max(worst, rankOfToken(token, index));
  return worst;
}

export function sortByFreqRank(cards, index) {
  return cards
    .map((card, i) => ({ card, i, rank: cardRank(card.es, index) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((entry) => entry.card);
}

// --- end duplicated block -----------------------------------------------

async function loadFreqText() {
  if (existsSync(CACHE_PATH)) return readFileSync(CACHE_PATH, 'utf8');
  const res = await fetch(LIST_URL);
  if (!res.ok) throw new Error(`es_50k letöltés sikertelen: HTTP ${res.status}`);
  const text = await res.text();
  writeFileSync(CACHE_PATH, text, 'utf8');
  return text;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const freqText = await loadFreqText();
const index = parseFreqList(freqText);

let mismatches = 0;
const summary = [];

for (const level of LEVELS) {
  const path = join(ROOT, 'data/words', `${level}.json`);
  const raw = readFileSync(path, 'utf8');
  const words = JSON.parse(raw);
  const sorted = sortByFreqRank(words, index);
  const sameOrder = words.length === sorted.length && words.every((w, i) => w.id === sorted[i].id);

  const ranks = words.map((w) => cardRank(w.es, index));
  const found = ranks.filter((r) => Number.isFinite(r));
  summary.push({
    level,
    count: words.length,
    found: found.length,
    notFound: ranks.length - found.length,
    median: median(found),
  });

  if (CHECK) {
    if (!sameOrder) mismatches += 1;
    console.log(`${level}: ${sameOrder ? 'OK' : 'MISMATCH'} (${words.length} kártya)`);
    continue;
  }

  if (!sameOrder) {
    writeFileSync(path, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  }
  console.log(`${level}: ${sameOrder ? 'változatlan' : 'átrendezve'} (${words.length} kártya)`);
}

console.log('\nszint | kártya | talált | nem talált | medián rang');
for (const s of summary) {
  console.log(`${s.level} | ${s.count} | ${s.found} | ${s.notFound} | ${s.median ?? '-'}`);
}

if (CHECK && mismatches > 0) {
  console.log(`\n${mismatches} szint nincs rangsorban.`);
  process.exit(1);
}
