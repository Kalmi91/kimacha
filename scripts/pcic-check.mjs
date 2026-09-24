// PCIC B1 fordítás- es id-ellenorzo (PLAN-pcic.md 3. lepes + 2. lepes 3. kor).
//
// Ellenőrzi:
// 1. minden nem-pattern b1-sample.json id-nak van nem-üres `en`-je b1-en.json-ban
// 2. nincs két azonos kisbetűs `es` a mintában
// 3. nincs olyan en kulcs, ami nem szerepel a korpuszban (all)
// 4. minden b1-all.json id "b1-" + 8 hex karakter
// 5. az `order` mezo egyedi es hezagmentes 0..n-1 a b1-all.json-ban
// 6. minden `headword` letezo id-ra mutat
// --all kapcsoló: a checked halmaz b1-all.json (nem a minta); 1. ellenőrzés helyett
// csak azt nézi, hogy minden meglévő b1-en.json érték nem-üres string, és kiírja
// az `en <lefordított>/<fordítható>` állást.
//
// Usage: node scripts/pcic-check.mjs [--level a1|a2|b1|b2] [--all]

import { readFileSync } from 'node:fs';

const levelArgIdx = process.argv.indexOf('--level');
const level = levelArgIdx !== -1 ? process.argv[levelArgIdx + 1] : 'b1';
if (!['a1', 'a2', 'b1', 'b2'].includes(level)) {
  console.error(`Unknown --level: ${level} (expected a1, a2, b1 or b2)`);
  process.exit(1);
}
const useAll = process.argv.includes('--all');

const sample = JSON.parse(readFileSync(`data/pcic/${level}-sample.json`, 'utf8'));
let en;
try {
  en = JSON.parse(readFileSync(`data/pcic/${level}-en.json`, 'utf8'));
} catch (err) {
  if (err.code === 'ENOENT') en = {};
  else throw err;
}
const all = JSON.parse(readFileSync(`data/pcic/${level}-all.json`, 'utf8'));

const checked = useAll ? all : sample;

let errors = 0;

if (useAll) {
  // 1. minden meglévő b1-en.json érték nem-üres string
  const badValues = Object.entries(en)
    .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
    .map(([id]) => id);
  if (badValues.length) {
    errors += badValues.length;
    console.error(`Üres/nem-string fordítás (${badValues.length}): ${badValues.join(', ')}`);
  }
} else {
  // 1. minden nem-pattern id-nak van nem-üres fordítása
  const missing = [];
  for (const item of checked) {
    if (item.kind === 'pattern') continue;
    const value = en[item.id];
    if (typeof value !== 'string' || value.trim() === '') missing.push(item.id);
  }
  if (missing.length) {
    errors += missing.length;
    console.error(`Hiányzó/üres fordítás (${missing.length}): ${missing.join(', ')}`);
  }
}

// 2. nincs két azonos kisbetűs `es` a checked halmazban
const seen = new Map();
const dupes = [];
for (const item of checked) {
  const key = item.es.toLowerCase();
  if (seen.has(key)) dupes.push(`${item.id} == ${seen.get(key)} ("${item.es}")`);
  else seen.set(key, item.id);
}
if (dupes.length) {
  errors += dupes.length;
  console.error(`Duplikált 'es' a mintában (${dupes.length}): ${dupes.join(', ')}`);
}

// 3. nincs olyan b1-en.json kulcs, ami nem szerepel a korpuszban (all; a minta
//    részhalmaz, az en-fájl pedig a teljes korpuszt fedi a --all adagok óta)
const corpusIds = new Set(all.map((item) => item.id));
const orphans = Object.keys(en).filter((id) => !corpusIds.has(id));
if (orphans.length) {
  errors += orphans.length;
  console.error(`Árva en kulcs, nincs a korpuszban (${orphans.length}): ${orphans.join(', ')}`);
}

// 4. minden id "${level}-" + 8 hex karakter
const idRe = new RegExp(`^${level}-[0-9a-f]{8}$`);
const badIds = all.filter((item) => !idRe.test(item.id)).map((item) => item.id);
if (badIds.length) {
  errors += badIds.length;
  console.error(`Nem stabil-formátumú id (${badIds.length}): ${badIds.join(', ')}`);
}

// 5. `order` egyedi és hézagmentes 0..n-1
const orders = all.map((item) => item.order).sort((a, b) => a - b);
const badOrder = orders.some((o, i) => o !== i);
if (badOrder) {
  errors += 1;
  console.error(`Az 'order' mező nem hézagmentes 0..n-1 (n=${all.length})`);
}

// 6. minden `headword` létező id-ra mutat
const allIds = new Set(all.map((item) => item.id));
const badHeadwords = all.filter((item) => item.headword != null && !allIds.has(item.headword)).map((item) => item.id);
if (badHeadwords.length) {
  errors += badHeadwords.length;
  console.error(`Nem létező id-ra mutató 'headword' (${badHeadwords.length}): ${badHeadwords.join(', ')}`);
}

// 7. FB361-362: ha van kézzel felvitt `pos` mező, csak ismert szófaj-érték
//    engedett; a mező hiánya nem hiba (posOf korpusz/szabály-fallbackje adja).
const KNOWN_POS = new Set([
  'noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'num', 'phrase',
  'conj', 'prefix', 'suffix',
]);
const badPos = all.filter((item) => item.pos != null && !KNOWN_POS.has(item.pos)).map((item) => item.id);
if (badPos.length) {
  errors += badPos.length;
  console.error(`Ismeretlen 'pos' érték (${badPos.length}): ${badPos.join(', ')}`);
}

if (errors) {
  console.error(`pcic:check FAIL, ${errors} hiba`);
  process.exit(1);
}

if (useAll) {
  const translatable = all.filter((item) => item.kind !== 'pattern');
  const translated = translatable.filter((item) => typeof en[item.id] === 'string' && en[item.id].trim() !== '').length;
  console.log(`pcic:check OK, en ${translated}/${translatable.length}, ${all.length} tétel a corpusban`);
} else {
  console.log(`pcic:check OK, ${sample.length} tétel, ${Object.keys(en).length} fordítás, ${all.length} tétel a corpusban`);
}
