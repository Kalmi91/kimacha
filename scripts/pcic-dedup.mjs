#!/usr/bin/env node
// PLAN-fb0924 7b. lépés (FB384, D3+D4): egy spanyol szó (7a normalizálásával)
// csak EGY PCIC-tételként létezzen, a legalacsonyabb szinten, word/phrase
// kind-ra. A magasabb szintű ismétlés törlődik a korpuszból; a haladás-
// átvitelt a DB-migráció (lib/db/migrations.ts applyPcicDedup) végzi a
// generált lib/pcicDedupMoves.ts térkép alapján, "erősebb nyer" logikával.
//
// D4: ha a törölt tétel angol jelentése ÉRDEMBEN más, mint a megmaradóé (nem
// csak szóhasználati variáns), a megmaradó kártya jelentés-listát kap
// (data/pcic/senses.json). A heurisztika: a normalizált angol glosszák közös
// tartalmas szava - ha nincs közös szó, "differs" (senses kell), ha van,
// "same" (sima törlés). Ez egy DÖNTÉS-JAVASLAT: a jelentés-fájlban (docs/
// pcic-level-moves.md 7b szakasza) minden "differs" csoport kilistázva, hogy
// átnézhető legyen.
//
// Usage: node scripts/pcic-dedup.mjs [--write]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const WRITE = process.argv.includes('--write');

function normalizeForLevelFit(es) {
  let s = es.toLowerCase();
  s = s.replace(/\([^)]*\)/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^(el|la|los|las)\s+/, '');
  return s.trim();
}

function normalizeEn(en) {
  if (!en) return '';
  let s = en.toLowerCase();
  s = s.replace(/\([^)]*\)/g, '');
  s = s.replace(/\bto\b/g, '');
  s = s.replace(/[^a-z\s]/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function ensMeaningfullyDiffer(winnerEn, loserEn) {
  const wSet = new Set(normalizeEn(winnerEn).split(' ').filter(Boolean));
  const lWords = normalizeEn(loserEn).split(' ').filter(Boolean);
  return !lWords.some((w) => wSet.has(w));
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

// --- Csoportosítás normalizált es szerint, csak word/phrase kind (7b scope).
const groups = new Map();
for (const lvl of PCIC_LEVELS) {
  for (const it of data[lvl].all) {
    if (it.kind !== 'word' && it.kind !== 'phrase') continue;
    const key = normalizeForLevelFit(it.es);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ lvl, item: it });
  }
}
const dupGroups = [...groups.entries()].filter(([, entries]) => entries.length > 1);

function pickWinner(entries) {
  return entries.slice().sort((a, b) => {
    if (pcicRank[a.lvl] !== pcicRank[b.lvl]) return pcicRank[a.lvl] - pcicRank[b.lvl];
    return (a.item.order ?? 0) - (b.item.order ?? 0);
  })[0];
}

const merges = []; // {winnerLvl, winnerId, loserLvl, loserId, loserEs, loserEn}
const senses = {}; // winnerId -> [{en, es}]
const differGroups = []; // for report
const sameGroups = []; // for report

for (const [normEs, entries] of dupGroups) {
  const winner = pickWinner(entries);
  const winnerEn = data[winner.lvl].en[winner.item.id];
  const losers = entries.filter((e) => e !== winner);
  let anyDiffer = false;
  for (const l of losers) {
    const loserEn = data[l.lvl].en[l.item.id];
    merges.push({ winnerLvl: winner.lvl, winnerId: winner.item.id, loserLvl: l.lvl, loserId: l.item.id, loserEs: l.item.es, loserEn });
    if (ensMeaningfullyDiffer(winnerEn, loserEn)) anyDiffer = true;
  }
  if (anyDiffer) {
    senses[winner.item.id] = [
      { en: winnerEn, es: winner.item.es },
      ...losers.map((l) => ({ en: data[l.lvl].en[l.item.id], es: l.item.es })),
    ];
    differGroups.push({ normEs, winner, winnerEn, losers, losersEn: losers.map((l) => data[l.lvl].en[l.item.id]) });
  } else {
    sameGroups.push({ normEs, winner, winnerEn, losers });
  }
}

console.log(`Duplikátum-csoport: ${dupGroups.length} (${sameGroups.length} szinonima/egyező, ${differGroups.length} eltérő jelentés -> senses.json)`);
console.log(`Összesen törlendő tétel: ${merges.length}`);

// --- Jelentés-szakasz, docs/pcic-level-moves.md-hez fűzve (mindig, dry-run is).
const section = [];
section.push('');
section.push('## 7b. lépés: szintek közti/szinten belüli duplikátumok (FB384, D3+D4)');
section.push('');
section.push(`Generálva: node scripts/pcic-dedup.mjs${WRITE ? ' --write' : ' (dry-run)'}`);
section.push('');
section.push(
  `**${dupGroups.length} duplikátum-csoport** (normalizált \`es\` szerint, word/phrase kind): a legalacsonyabb szintű tétel marad, a többi törlődik, a haladás átkerül rá (erősebb nyer: több sikeres ismétlés, aztán nagyobb interval - lib/db/migrations.ts applyPcicDedup). **${sameGroups.length}** csoportnál a jelentés lényegében egyezik (sima törlés), **${differGroups.length}** csoportnál a jelentés érdemben eltér, ezért a megmaradó kártya jelentés-listát kapott (\`data/pcic/senses.json\`).`
);
section.push('');
section.push('### Jelentésben eltérő csoportok (senses.json)');
section.push('');
section.push('| normalizált es | megtartva | törölt jelentések |');
section.push('|---|---|---|');
for (const g of differGroups) {
  const losersStr = g.losers.map((l, i) => `${l.lvl.toUpperCase()} \`${l.item.id}\` "${l.item.es}" = "${g.losersEn[i]}"`).join('; ');
  section.push(`| ${g.normEs} | ${g.winner.lvl.toUpperCase()} \`${g.winner.item.id}\` "${g.winner.item.es}" = "${g.winnerEn}" | ${losersStr} |`);
}
section.push('');
section.push(`### Szinonima-csoportok (${sameGroups.length}, sima törlés, nincs senses.json)`);
section.push('');
section.push('| normalizált es | megtartva | törölt |');
section.push('|---|---|---|');
for (const g of sameGroups) {
  const losersStr = g.losers.map((l) => `${l.lvl.toUpperCase()} \`${l.item.id}\` "${l.item.es}"`).join('; ');
  section.push(`| ${g.normEs} | ${g.winner.lvl.toUpperCase()} \`${g.winner.item.id}\` "${g.winner.item.es}" | ${losersStr} |`);
}
const existing = existsSync('docs/pcic-level-moves.md') ? readFileSync('docs/pcic-level-moves.md', 'utf8') : '';
// Ha korábban már fűztünk hozzá 7b szakaszt (pl. dry-run után újrafuttatva), az
// a PONT cserélődik, nem duplázódik.
const marker = '## 7b. lépés: szintek közti/szinten belüli duplikátumok';
const base = existing.includes(marker) ? existing.slice(0, existing.indexOf(marker)).trimEnd() + '\n' : existing.trimEnd() + '\n';
writeFileSync('docs/pcic-level-moves.md', base + section.join('\n') + '\n');
console.log('Jelentés-szakasz hozzáfűzve: docs/pcic-level-moves.md');

if (!WRITE) {
  console.log('Dry-run, adat nem változott. --write a tényleges egyesítéshez.');
  process.exit(0);
}

// --- Tényleges egyesítés: minden loser eltávolítása a saját szintjéről,
// en/sentences törlése; a winner marad (csak a senses.json-t kapja meg, ha jár).
const loserIdsByLevel = new Map(); // lvl -> Set(ids)
for (const lvl of PCIC_LEVELS) loserIdsByLevel.set(lvl, new Set());
for (const m of merges) loserIdsByLevel.get(m.loserLvl).add(m.loserId);

for (const lvl of PCIC_LEVELS) {
  const removeIds = loserIdsByLevel.get(lvl);
  data[lvl].all = data[lvl].all.filter((it) => !removeIds.has(it.id));
  for (const id of removeIds) {
    delete data[lvl].en[id];
    if (data[lvl].sentences) delete data[lvl].sentences[id];
  }
}

// --- headword-tisztítás (mint 7a-ban): bármelyik megmaradó tétel headword-je,
// ami egy törölt loser id-re mutatott, törlődik (a mező futásidőben úgysem
// használt).
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

// --- order újraszámozás 0..n-1.
for (const lvl of PCIC_LEVELS) {
  data[lvl].all.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  data[lvl].all.forEach((it, i) => {
    it.order = i;
  });
}

for (const lvl of PCIC_LEVELS) {
  writeFileSync(`data/pcic/${lvl}-all.json`, JSON.stringify(data[lvl].all, null, 2) + '\n');
  writeFileSync(`data/pcic/${lvl}-en.json`, JSON.stringify(data[lvl].en, null, 2) + '\n');
  if (data[lvl].sentences) {
    writeFileSync(`data/pcic/${lvl}-sentences.json`, JSON.stringify(data[lvl].sentences, null, 2) + '\n');
  }
}

writeFileSync('data/pcic/senses.json', JSON.stringify(senses, null, 2) + '\n');
console.log(`data/pcic/senses.json írva, ${Object.keys(senses).length} tétel.`);

// --- a1-build.json (lib/pcicChains.ts mondat-lánc adat) tag-referenciáinak
// átvezetése: ez a fájl NEM az -all.json/-en.json/-sentences.json hármas
// része, de a `tags` tömbjei ugyanazokra a PCIC-item-id-kra mutatnak, és
// futásidőben ténylegesen felhasználva vannak (lib/pcicChains.ts
// applyChainOrder), ezért itt a törölt loser id-t a winner id-jére kell
// cserélni (nem törölni, mint a headword-nél), különben egy törölt tag
// sosem lesz 'review', és a lánc-mondat sosem épül fel.
const loserToWinner = new Map(merges.map((m) => [m.loserId, m.winnerId]));
if (existsSync('data/pcic/a1-build.json')) {
  const build = JSON.parse(readFileSync('data/pcic/a1-build.json', 'utf8'));
  let tagsRemapped = 0;
  for (const entry of Object.values(build)) {
    if (!Array.isArray(entry.tags)) continue;
    const remapped = entry.tags.map((id) => loserToWinner.get(id) ?? id);
    const deduped = [...new Set(remapped)];
    if (deduped.length !== entry.tags.length || deduped.some((id, i) => id !== entry.tags[i])) {
      tagsRemapped += entry.tags.filter((id) => loserToWinner.has(id)).length;
      entry.tags = deduped;
    }
  }
  writeFileSync('data/pcic/a1-build.json', JSON.stringify(build, null, 2) + '\n');
  console.log(`data/pcic/a1-build.json tag-referencia átvezetve: ${tagsRemapped}.`);
}

// --- DB-migrációs térkép (loser id -> winner id), a WORD_MERGES mintájára.
const mapLines = [];
mapLines.push('// GENERÁLT FÁJL, ne szerkeszd kézzel: node scripts/pcic-dedup.mjs --write');
mapLines.push('//');
mapLines.push('// PLAN-fb0924 7b. lépés (FB384, D3+D4): törölt (magasabb szintű/szinten-belüli');
mapLines.push('// duplikátum) PCIC-item-id -> a megmaradó (legalacsonyabb szintű) item-id. A DB-');
mapLines.push('// migráció (lib/db/migrations.ts applyPcicDedup) ezen a térképen viszi át a');
mapLines.push('// meglévő pcic_cards SRS-haladást; ha MINDKÉT oldalon van haladás, az erősebb');
mapLines.push('// (több sikeres ismétlés, aztán nagyobb interval) nyer, a gyengébb sor törlődik.');
mapLines.push('');
mapLines.push('export const PCIC_DEDUP_MOVES: Record<string, string> = {');
for (const m of merges) {
  mapLines.push(`  '${m.loserId}': '${m.winnerId}', // ${m.loserEs}: ${m.loserLvl.toUpperCase()} -> ${m.winnerLvl.toUpperCase()}`);
}
mapLines.push('};');
writeFileSync('lib/pcicDedupMoves.ts', mapLines.join('\n') + '\n');
console.log('DB-migrációs térkép írva: lib/pcicDedupMoves.ts');

console.log(`Kész: ${merges.length} tétel törölve/egyesítve, ${headwordCleared} headword törölve.`);
