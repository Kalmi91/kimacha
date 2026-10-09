// The mistakes-import skill (run on a separate machine) uses this to check the
// batch JSON with the repo's OWN validator (lib/mistakes/format.ts) before
// uploading it to Drive, so the rules are not duplicated in a second copy
// maintained on that machine.
//
// Node 22's built-in TypeScript type stripping imports the .ts file (no build
// step, no ts-node); the validator is therefore import-free and uses only
// erasable TS syntax.
//
// Usage: node scripts/check-mistakes.mjs <file.json>

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
