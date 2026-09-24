// PLAN-hibaim.md 2. lépés (Kálmán kiegészítése, 2026-09-23): a /hibaim skill
// (laptop) ezzel ellenőrzi a batch JSON-t a repo SAJÁT validátorával
// (lib/mistakes/format.ts), mielőtt a Drive-ra tenné, hogy ne duplikálja a
// szabályokat egy második, laptopon karbantartott másolatban.
//
// Node 22 beépített TypeScript type-strippel importálja a .ts fájlt (nincs
// build lépés, nincs ts-node); a validátor emiatt import-mentes és csak
// törölhető TS-szintaxist használ.
//
// Usage: node scripts/check-mistakes.mjs <fájl.json>

import { readFileSync } from 'node:fs';
import { validateMistakesPayload } from '../lib/mistakes/format.ts';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/check-mistakes.mjs <fájl.json>');
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`Could not read/parse ${file}: ${err.message}`);
  process.exit(1);
}

const result = validateMistakesPayload(raw);
if (!result.ok) {
  console.error(result.error);
  process.exit(1);
}

const { batch } = result;
const drillCount = batch.patterns.reduce((n, p) => n + p.drills.length, 0);
console.log(`OK: ${batch.sentences.length} sentences, ${batch.words.length} words, ${drillCount} drills, ${batch.wrongWords.length} wrongWords`);
process.exit(0);
