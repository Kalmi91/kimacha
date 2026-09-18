// PCIC B1 fordítás- es id-ellenorzo (PLAN-pcic.md 3. lepes + 2. lepes 3. kor).
//
// Ellenőrzi:
// 1. minden nem-pattern b1-sample.json id-nak van nem-üres `en`-je b1-en.json-ban
// 2. nincs két azonos kisbetűs `es` a mintában
// 3. nincs olyan b1-en.json kulcs, ami nem szerepel a mintában
// 4. minden b1-all.json id "b1-" + 8 hex karakter
// 5. az `order` mezo egyedi es hezagmentes 0..n-1 a b1-all.json-ban
// 6. minden `headword` letezo id-ra mutat
//
// Usage: node scripts/pcic-check.mjs

import { readFileSync } from 'node:fs';

const sample = JSON.parse(readFileSync('data/pcic/b1-sample.json', 'utf8'));
const en = JSON.parse(readFileSync('data/pcic/b1-en.json', 'utf8'));
const all = JSON.parse(readFileSync('data/pcic/b1-all.json', 'utf8'));

let errors = 0;

// 1. minden nem-pattern id-nak van nem-üres fordítása
const missing = [];
for (const item of sample) {
  if (item.kind === 'pattern') continue;
  const value = en[item.id];
  if (typeof value !== 'string' || value.trim() === '') missing.push(item.id);
}
if (missing.length) {
  errors += missing.length;
  console.error(`Hiányzó/üres fordítás (${missing.length}): ${missing.join(', ')}`);
}

// 2. nincs két azonos kisbetűs `es` a mintában
const seen = new Map();
const dupes = [];
for (const item of sample) {
  const key = item.es.toLowerCase();
  if (seen.has(key)) dupes.push(`${item.id} == ${seen.get(key)} ("${item.es}")`);
  else seen.set(key, item.id);
}
if (dupes.length) {
  errors += dupes.length;
  console.error(`Duplikált 'es' a mintában (${dupes.length}): ${dupes.join(', ')}`);
}

// 3. nincs olyan b1-en.json kulcs, ami nem szerepel a mintában
const sampleIds = new Set(sample.map((item) => item.id));
const orphans = Object.keys(en).filter((id) => !sampleIds.has(id));
if (orphans.length) {
  errors += orphans.length;
  console.error(`Árva b1-en.json kulcs, nincs a mintában (${orphans.length}): ${orphans.join(', ')}`);
}

// 4. minden id "b1-" + 8 hex karakter
const idRe = /^b1-[0-9a-f]{8}$/;
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

if (errors) {
  console.error(`pcic:check FAIL, ${errors} hiba`);
  process.exit(1);
}

console.log(`pcic:check OK, ${sample.length} tétel, ${Object.keys(en).length} fordítás, ${all.length} tétel a corpusban`);
