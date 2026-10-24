#!/usr/bin/env node
/**
 * grammar-hu-check.mjs, how much of the grammar courses the Hungarian sidecars cover:
 *   data/games/grammar-hu/<lang>/<lesson>.json   { "<exact en text>": "<Hungarian text>" }
 * Per course and lesson: coverage = Lang4 objects of the lesson that have a sidecar entry / all Lang4 objects
 * (the Lang4 rule is lib/grammar/huOverlay.ts), and stale keys = sidecar keys no lesson text has any more.
 * Informational: always exit 0, so a later lesson edit does not break CI (the jest test guards a broken copy).
 *
 * Run: node scripts/grammar-hu-check.mjs            (summary + the lessons that are not at 100% / have stale keys)
 *      node scripts/grammar-hu-check.mjs --all      (every lesson)
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { importTs } from './lib/importTs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { lang4Keys } = await importTs(join(root, 'lib', 'grammar', 'huOverlay.ts'));
const all = process.argv.includes('--all');

let totalCovered = 0;
let totalAll = 0;
let totalStale = 0;
let totalLessons = 0;
for (const lang of ['es', 'en']) {
  const dir = join(root, 'data', 'games', 'grammar', lang);
  let covered = 0;
  let count = 0;
  let stale = 0;
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  for (const f of files) {
    const keys = lang4Keys(JSON.parse(readFileSync(join(dir, f), 'utf8')));
    const sidecar = join(root, 'data', 'games', 'grammar-hu', lang, f);
    const map = existsSync(sidecar) ? JSON.parse(readFileSync(sidecar, 'utf8')) : {};
    const have = keys.filter((k) => Object.prototype.hasOwnProperty.call(map, k)).length;
    const present = new Set(keys);
    const staleKeys = Object.keys(map).filter((k) => !present.has(k));
    covered += have;
    count += keys.length;
    stale += staleKeys.length;
    if (all || have < keys.length || staleKeys.length > 0 || !existsSync(sidecar)) {
      const pct = keys.length ? ((100 * have) / keys.length).toFixed(1) : '100.0';
      console.log(`${lang}/${f}: ${have}/${keys.length} (${pct}%), stale ${staleKeys.length}${existsSync(sidecar) ? '' : ', NO SIDECAR'}`);
    }
  }
  const pct = count ? ((100 * covered) / count).toFixed(2) : '100.00';
  console.log(`${lang}: ${files.length} lessons, ${covered}/${count} Lang4 covered (${pct}%), ${stale} stale`);
  totalCovered += covered;
  totalAll += count;
  totalStale += stale;
  totalLessons += files.length;
}
const total = totalAll ? ((100 * totalCovered) / totalAll).toFixed(2) : '100.00';
console.log(`TOTAL: ${totalLessons} lessons, ${totalCovered}/${totalAll} Lang4 covered (${total}%), ${totalStale} stale`);
