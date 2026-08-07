// Word-corpus integrity pass for the Spanish track (2026-08-07, Kálmán's call).
//
// Two problems it fixes, in this order:
//
// 1. DUPLICATES. The same Spanish headword was authored on several levels with
//    the same meaning (`el brazo` on A1 and A2, `seis` on A1 and A2, ...), so a
//    level-up made you relearn words you already knew, from zero. Rule: the
//    LOWEST level keeps the word, the higher-level twin is deleted. A twin whose
//    meaning actually differs (`la carta` = menu on A1, letter on A2) is kept,
//    genuine polysemy is not a duplicate.
//
// 2. ID COLLISIONS. `id` is the key of both the SRS row (`cards.word_id`) and of
//    the display lookup (`words.find(w => w.id === row.word_id)` over the flat,
//    all-levels array in data/words.ts), yet 538 ids were reused across level
//    files. First match wins, so an A2 card rendered the A1 word and shared its
//    FSRS history. Rule: the LOWEST level keeps its id (existing progress stays
//    valid), the higher-level occurrence is renumbered above the global maximum.
//
// The emitted lib/wordMerges.ts carries the deleted -> kept id pairs into the DB
// migration, so progress on a deleted card is not lost. A pair is emitted ONLY
// when the deleted id disappears from the corpus entirely; if some other level
// still owns that id, the mapping would be ambiguous and is dropped instead.
//
// Usage: node scripts/dedupe-words.mjs [--write]

import { readFileSync, writeFileSync } from 'node:fs';

const LEVELS = ['a0', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
const WRITE = process.argv.includes('--write');

const files = LEVELS.map((level) => {
  const path = `data/words/${level}.json`;
  const raw = readFileSync(path, 'utf8');
  return { level, path, words: JSON.parse(raw), trailingNewline: raw.endsWith('\n') };
});

const norm = (value) =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/^(the|an|a|az)\s+/, '')
    .replace(/^(el|la|los|las)\s+/, '')
    .replace(/[.\s]+$/, '');

const senses = (value) =>
  new Set(
    String(value ?? '')
      .split(/[/,]/)
      .map((part) => norm(part))
      .filter(Boolean)
  );

const sharesMeaning = (a, b) => {
  const overlap = (field) => {
    const sa = senses(a[field]);
    for (const sense of senses(b[field])) if (sa.has(sense)) return true;
    return false;
  };
  return overlap('en') || overlap('hu');
};

// --- phase 1: drop the higher-level twin of a same-meaning duplicate ----------
const firstByHeadword = new Map(); // es -> { level, word }
const deletions = []; // { level, id, es, keptId, keptLevel }
const keptPolysemy = [];

for (const file of files) {
  const survivors = [];
  for (const word of file.words) {
    const earlier = firstByHeadword.get(word.es);
    if (!earlier) {
      firstByHeadword.set(word.es, { level: file.level, word });
      survivors.push(word);
    } else if (sharesMeaning(earlier.word, word)) {
      deletions.push({
        level: file.level,
        id: word.id,
        es: word.es,
        keptId: earlier.word.id,
        keptLevel: earlier.level,
      });
    } else {
      keptPolysemy.push({ level: file.level, id: word.id, es: word.es });
      survivors.push(word);
    }
  }
  file.words = survivors;
}

// --- phase 2: give every surviving word a globally unique id ------------------
let nextId = 0;
for (const file of files) for (const word of file.words) nextId = Math.max(nextId, word.id);
nextId += 1;

const seenIds = new Map(); // id -> level that owns it
const renumbers = []; // { level, from, to, es }
for (const file of files) {
  for (const word of file.words) {
    if (!seenIds.has(word.id)) {
      seenIds.set(word.id, file.level);
      continue;
    }
    renumbers.push({ level: file.level, from: word.id, to: nextId, es: word.es });
    word.id = nextId;
    seenIds.set(nextId, file.level);
    nextId += 1;
  }
}

// --- phase 3: the merge map the DB migration can trust ------------------------
const liveIds = new Set(seenIds.keys());
const merges = [];
const ambiguous = [];
for (const deletion of deletions) {
  if (liveIds.has(deletion.id)) ambiguous.push(deletion);
  else merges.push(deletion);
}

const report = [
  `duplikátum törölve:      ${deletions.length}`,
  `  ebből migrálható:      ${merges.length}`,
  `  ebből kihagyva (az id-t más szint is használja): ${ambiguous.length}`,
  `többjelentésű, megtartva: ${keptPolysemy.length}  ${keptPolysemy.map((k) => `${k.es} (${k.level})`).join(', ')}`,
  `id újraszámozva:          ${renumbers.length}`,
  ...files.map((f) => `  ${f.level}: ${f.words.length} szó`),
];
console.log(report.join('\n'));

if (!WRITE) {
  console.log('\n(dry run, semmit nem írtam, --write kell hozzá)');
  process.exit(0);
}

for (const file of files) {
  writeFileSync(file.path, JSON.stringify(file.words, null, 2) + (file.trailingNewline ? '\n' : ''));
}

const mergeLines = merges
  .sort((a, b) => a.id - b.id)
  .map((m) => `  ${m.id}: ${m.keptId}, // ${m.es}: ${m.level.toUpperCase()} törölve, marad ${m.keptLevel.toUpperCase()}`);

writeFileSync(
  'lib/wordMerges.ts',
  `// GENERÁLT FÁJL, ne szerkeszd kézzel: node scripts/dedupe-words.mjs --write
//
// Törölt szó-id -> a megmaradt (alacsonyabb szintű) iker id-je. A DB-migráció
// ezen a térképen viszi át a haladást, hogy a duplikátum-takarítás ne dobja el,
// amit a tanuló már megtanult. Csak egyértelmű párok kerülnek ide: ha a törölt
// id-t egy másik szint még használja, a pár kimarad (a migráció nem találgat).

export const WORD_MERGES: Record<number, number> = {
${mergeLines.join('\n')}
};
`
);

console.log('\nkiírva: data/words/*.json + lib/wordMerges.ts');
