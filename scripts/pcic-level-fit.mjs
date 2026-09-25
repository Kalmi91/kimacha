#!/usr/bin/env node
// PLAN-fb0924 7a. lépés (FB396, D3): minden PCIC `word` tétel a nehézségének
// megfelelő szinten legyen. Nehézség-forrás: az app saját, gyakoriság-alapú
// szókorpusza (data/words/a0.json..b1.json). Szabály: új szint =
// min(PCIC-szint, korpusz-szint), A0 -> A1 padlóval, csak lefelé mozgat.
// `phrase`/`sentence`/`pattern` nem mozog.
//
// Usage: node scripts/pcic-level-fit.mjs [--write]
// Dry-run alapból (csak docs/pcic-level-moves.md-t írja); --write ténylegesen
// mozgatja az adatot (data/pcic/<szint>-all.json / -en.json / -sentences.json)
// és a DB-migrációs térképet (lib/pcicLevelMoves.ts).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const WRITE = process.argv.includes('--write');

// --- Normalizálás (PLAN-fb0924 7a instrukció): kisbetű, zárójeles rész le
// (gloss, opcionális betű, reflexív/infinitivus jelölés mind ez a minta),
// szótári névelő le, "/" mentén szétválasztott alakok külön nézve.
function normalizeForLevelFit(es) {
  let s = es.toLowerCase();
  s = s.replace(/\([^)]*\)/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^(el|la|los|las)\s+/, '');
  return s.trim();
}
function formsOf(es) {
  return es
    .split('/')
    .map((part) => normalizeForLevelFit(part))
    .filter(Boolean);
}

const CORPUS_LEVELS = ['a0', 'a1', 'a2', 'b1'];
const corpusRank = { a0: 0, a1: 1, a2: 2, b1: 3 };
// A0 nincs PCIC-szinten, a legalacsonyabb PCIC-padló A1.
const clampToPcicFloor = { a0: 'a1', a1: 'a1', a2: 'a2', b1: 'b1' };

const corpusMap = new Map(); // normalizedForm -> legalacsonyabb korpusz-szint
for (const lvl of CORPUS_LEVELS) {
  const arr = JSON.parse(readFileSync(`data/words/${lvl}.json`, 'utf8'));
  for (const w of arr) {
    for (const form of formsOf(w.es)) {
      if (!corpusMap.has(form) || corpusRank[corpusMap.get(form)] > corpusRank[lvl]) {
        corpusMap.set(form, lvl);
      }
    }
  }
}

function corpusLevelFor(es) {
  let best = null;
  for (const form of formsOf(es)) {
    if (corpusMap.has(form)) {
      const cl = corpusMap.get(form);
      if (best === null || corpusRank[cl] < corpusRank[best]) best = cl;
    }
  }
  return best;
}

const PCIC_LEVELS = ['a1', 'a2', 'b1', 'b2'];
const pcicRank = { a1: 1, a2: 2, b1: 3, b2: 4 };

const data = {};
for (const lvl of PCIC_LEVELS) {
  data[lvl] = {
    all: JSON.parse(readFileSync(`data/pcic/${lvl}-all.json`, 'utf8')),
    en: JSON.parse(readFileSync(`data/pcic/${lvl}-en.json`, 'utf8')),
    sentences: existsSync(`data/pcic/${lvl}-sentences.json`)
      ? JSON.parse(readFileSync(`data/pcic/${lvl}-sentences.json`, 'utf8'))
      : null,
  };
}

const allIds = new Set();
for (const lvl of PCIC_LEVELS) for (const it of data[lvl].all) allIds.add(it.id);

function newIdFor(level) {
  let id;
  do {
    id = `${level}-${randomBytes(4).toString('hex')}`;
  } while (allIds.has(id));
  allIds.add(id);
  return id;
}

// Melyik es-ek foglaltak MÁR egy adott célszinten (a duplikátum-ellenőrzéshez,
// pcic-check.mjs 2. szabálya: nincs két azonos kisbetűs es egy szinten). Ha
// egy mozgatás ütközne egy MEGLÉVŐ tétellel a célszinten, a mozgatás kimarad
// (7b dolga a duplikátum-egyesítés, lásd a jelentés "SKIPPED" sorait).
const esInLevel = {};
for (const lvl of PCIC_LEVELS) {
  esInLevel[lvl] = new Set(data[lvl].all.map((it) => it.es.toLowerCase()));
}

const moves = []; // {oldId, newId, es, section, from, to, corpusLevel}
const skipped = []; // {id, es, from, to, corpusLevel, collidesWith}
const idMap = {}; // oldId -> newId

// Determinisztikus sorrend: level majd id szerint, hogy --write ismételt
// futtatása (ha valaha kellene) ugyanazt a döntés-listát adja (az új id-k
// maguk persze mindig frissek, de a MELYIK szó mozog döntés stabil).
for (const lvl of PCIC_LEVELS) {
  const sortedItems = [...data[lvl].all].sort((a, b) => a.id.localeCompare(b.id));
  for (const it of sortedItems) {
    if (it.kind !== 'word') continue;
    const corpusLevel = corpusLevelFor(it.es);
    if (corpusLevel === null) continue; // nincs a korpuszban, marad
    const target = clampToPcicFloor[corpusLevel];
    if (pcicRank[target] >= pcicRank[lvl]) continue; // csak lefelé

    const esKey = it.es.toLowerCase();
    if (esInLevel[target].has(esKey)) {
      skipped.push({ id: it.id, es: it.es, from: lvl, to: target, corpusLevel });
      continue;
    }

    const newId = newIdFor(target);
    moves.push({ oldId: it.id, newId, es: it.es, section: it.section, from: lvl, to: target, corpusLevel });
    idMap[it.id] = newId;
    esInLevel[target].add(esKey);
  }
}

console.log(`PCIC 7a: ${moves.length} szó mozgatásra, ${skipped.length} kihagyva (célszinten már van ilyen es -> 7b dolga)`);
const byPair = {};
for (const m of moves) {
  const key = `${m.from}->${m.to}`;
  byPair[key] = (byPair[key] ?? 0) + 1;
}
console.log('Szint-párok:', byPair);

// --- Tényleges mozgatás (mindig szimulálva, memóriában - a fájlba írás csak
// --write mellett történik lent): eltávolítás a forrásból, hozzáadás a
// célhoz, en/sentences átvitele.
const movesByOldId = new Map(moves.map((m) => [m.oldId, m]));
for (const lvl of PCIC_LEVELS) {
  const kept = [];
  for (const it of data[lvl].all) {
    const m = movesByOldId.get(it.id);
    if (!m) {
      kept.push(it);
      continue;
    }
    const enVal = data[lvl].en[it.id];
    delete data[lvl].en[it.id];
    if (typeof enVal === 'string') data[m.to].en[m.newId] = enVal;
    if (data[lvl].sentences && data[lvl].sentences[it.id]) {
      const sentVal = data[lvl].sentences[it.id];
      delete data[lvl].sentences[it.id];
      if (data[m.to].sentences) data[m.to].sentences[m.newId] = sentVal;
    }
    const moved = { ...it, id: m.newId };
    data[m.to].all.push(moved);
  }
  data[lvl].all = kept;
}

// --- headword-tisztítás: a pcic-check.mjs 6. szabálya SZINTEN BELÜLI
// hivatkozást vár (a headword-öt a saját szint all.json-ja ellen ellenőrzi).
// Egy mozgatott szóra mutató headword ezután MÁS szintre mutatna, ami nem
// engedett - a headword mezőt maga az app sosem olvassa (data/pcic.ts
// buildItems nem másolja át PcicItem-be), ezért az egyetlen helyes lépés a
// már nem szinten-belüli hivatkozás törlése, nem átírása.
let headwordCleared = 0;
for (const lvl of PCIC_LEVELS) {
  const idsHere = new Set(data[lvl].all.map((it) => it.id));
  for (const it of data[lvl].all) {
    if (it.headword && !idsHere.has(it.headword)) {
      delete it.headword;
      headwordCleared++;
    }
  }
}

// --- order újraszámozás 0..n-1 minden szinten (pcic-check.mjs 5. szabálya),
// a MEGLÉVŐ tételek egymáshoz képesti sorrendje megmarad, az újak a végére
// kerülnek (a beszúrás sorrendjében, ami a fenti push() miatt már az eredeti
// order szerinti).
for (const lvl of PCIC_LEVELS) {
  data[lvl].all.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  data[lvl].all.forEach((it, i) => {
    it.order = i;
  });
}

// --- Jelentés-fájl, mindig (dry-run is), hogy Kálmán át tudja nézni a tervet.
const reportLines = [];
reportLines.push('# PCIC szint-igazítás (PLAN-fb0924 7a. lépés, FB396, D3)');
reportLines.push('');
reportLines.push(`Generálva: node scripts/pcic-level-fit.mjs${WRITE ? ' --write' : ' (dry-run)'}`);
reportLines.push('');
reportLines.push(
  `Szabály: egy PCIC \`word\` tétel új szintje = min(PCIC-szint, a szó szintje az app saját, gyakoriság-alapú szókorpuszában \`data/words/a0.json..b1.json\`), A0 -> A1 padlóval, csak lefelé mozog. A normalizálás kisbetűs, zárójel nélküli, szótári névelő nélküli, "/" mentén szétbontott alakokat vet össze.`
);
reportLines.push('');
reportLines.push(`**Összesen mozgatva: ${moves.length}. Kihagyva (célszinten már van azonos szó, 7b dolga): ${skipped.length}.**`);
if (headwordCleared) {
  reportLines.push(
    `Törölt \`headword\` hivatkozás: ${headwordCleared} (a hivatkozott szó másik szintre került; a mező futásidőben nem használt, data/pcic.ts nem másolja PcicItem-be, ezért törlés a helyes lépés, nem átírás - pcic-check.mjs a headwordöt szinten belül ellenőrzi).`
  );
}
reportLines.push('');
reportLines.push('## Mozgatva');
reportLines.push('');
reportLines.push('| régi id | es | régi szint → új szint | korpusz-forrás szint |');
reportLines.push('|---|---|---|---|');
for (const m of moves) {
  reportLines.push(`| \`${m.oldId}\` → \`${m.newId}\` | ${m.es} | ${m.from.toUpperCase()} → ${m.to.toUpperCase()} | ${m.corpusLevel.toUpperCase()} |`);
}
reportLines.push('');
reportLines.push('## Kihagyva (célszinten már van azonos `es`, 7b dönt)');
reportLines.push('');
reportLines.push('| id | es | szint → jelölt cél | korpusz-forrás szint |');
reportLines.push('|---|---|---|---|');
for (const s of skipped) {
  reportLines.push(`| \`${s.id}\` | ${s.es} | ${s.from.toUpperCase()} → ${s.to.toUpperCase()} | ${s.corpusLevel.toUpperCase()} |`);
}
writeFileSync('docs/pcic-level-moves.md', reportLines.join('\n') + '\n');
console.log('Jelentés írva: docs/pcic-level-moves.md');

if (!WRITE) {
  console.log('Dry-run, adat nem változott. --write a tényleges mozgatáshoz.');
  process.exit(0);
}

for (const lvl of PCIC_LEVELS) {
  writeFileSync(`data/pcic/${lvl}-all.json`, JSON.stringify(data[lvl].all, null, 2) + '\n');
  writeFileSync(`data/pcic/${lvl}-en.json`, JSON.stringify(data[lvl].en, null, 2) + '\n');
  if (data[lvl].sentences) {
    writeFileSync(`data/pcic/${lvl}-sentences.json`, JSON.stringify(data[lvl].sentences, null, 2) + '\n');
  }
}

// --- DB-migrációs térkép (a WORD_MERGES mintájára), hogy a meglévő SRS-
// haladás a mozgatott szón ne vesszen el.
const mapLines = [];
mapLines.push('// GENERÁLT FÁJL, ne szerkeszd kézzel: node scripts/pcic-level-fit.mjs --write');
mapLines.push('//');
mapLines.push('// PLAN-fb0924 7a. lépés (FB396, D3): a nehézség-igazítás régi PCIC-item-id ->');
mapLines.push('// új PCIC-item-id térképe (a régi és az új id KÜLÖNBÖZŐ szintet jelöl - lásd');
mapLines.push('// lib/pcicLevels.ts matchesLevel/levelOfItem). A DB-migráció (lib/db/migrations.ts');
mapLines.push('// applyPcicLevelMoves, natív induláskor) ezen a térképen viszi át a meglévő');
mapLines.push('// pcic_cards SRS-haladást, hogy a szint-igazítás ne dobja el, amit a tanuló már');
mapLines.push('// megtanult. A pcic_cards tábla nincs a backup-ban (lib/backup.ts), ezért web-');
mapLines.push('// oldali migráció nem kell. Tiszta átnevezés (nincs "iker", a célszinten mindig');
mapLines.push('// friss id jön).');
mapLines.push('');
mapLines.push('export const PCIC_LEVEL_MOVES: Record<string, string> = {');
for (const m of moves) {
  mapLines.push(`  '${m.oldId}': '${m.newId}', // ${m.es}: ${m.from.toUpperCase()} -> ${m.to.toUpperCase()}`);
}
mapLines.push('};');
writeFileSync('lib/pcicLevelMoves.ts', mapLines.join('\n') + '\n');
console.log('DB-migrációs térkép írva: lib/pcicLevelMoves.ts');

console.log(`Kész: ${moves.length} szó mozgatva, ${headwordCleared} headword törölve.`);
