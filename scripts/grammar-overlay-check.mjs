#!/usr/bin/env node
/**
 * grammar-overlay-check.mjs, how much of the grammar courses the translation sidecars cover:
 *   data/games/grammar-<lang>/<course>/<lesson>.json   { "<exact en text>": "<translation>" }
 * Per course and lesson: coverage = Lang4 objects of the lesson that have a sidecar entry / all Lang4 objects
 * (the Lang4 rule is lib/grammar/overlay.ts), and stale keys = sidecar keys no lesson text has any more.
 * Lessons without any sidecar file are only counted (listed with --all). Informational: exit 0, so a later lesson edit does not break CI (the jest tests guard a broken copy).
 * With --strict the exit code is 1 when a course that must be complete (--lang de: es and en) is not at 100%.
 *
 * Run: node scripts/grammar-overlay-check.mjs --lang hu|de            (summary + the lessons that are not at 100% / have stale keys)
 *      node scripts/grammar-overlay-check.mjs --lang de --all         (every lesson)
 *      node scripts/grammar-overlay-check.mjs --lang de --strict      (exit 1 unless es and en are complete)
 * Entry points: scripts/grammar-hu-check.mjs, scripts/grammar-de-check.mjs.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { importTs } from './lib/importTs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { lang4Keys } = await importTs(join(root, 'lib', 'grammar', 'overlay.ts'));
const args = process.argv.slice(2);
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'hu';
const all = args.includes('--all');
const strict = args.includes('--strict');

// Which courses get the sidecar (nobody learns Hungarian from Hungarian text), and which of them must be complete.
const COURSES = { hu: ['es', 'en'], de: ['es', 'en', 'hu'] };
const COMPLETE = { hu: [], de: ['es', 'en'] };
if (!COURSES[lang]) {
  console.error(`unknown --lang "${lang}", use hu or de`);
  process.exit(2);
}

let totalCovered = 0;
let totalAll = 0;
let totalStale = 0;
let totalLessons = 0;
let incomplete = 0;
for (const course of COURSES[lang]) {
  const dir = join(root, 'data', 'games', 'grammar', course);
  let covered = 0;
  let count = 0;
  let stale = 0;
  let missing = 0;
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  for (const f of files) {
    const keys = lang4Keys(JSON.parse(readFileSync(join(dir, f), 'utf8')));
    const sidecar = join(root, 'data', 'games', `grammar-${lang}`, course, f);
    const map = existsSync(sidecar) ? JSON.parse(readFileSync(sidecar, 'utf8')) : {};
    const have = keys.filter((k) => Object.prototype.hasOwnProperty.call(map, k)).length;
    const present = new Set(keys);
    const staleKeys = Object.keys(map).filter((k) => !present.has(k));
    covered += have;
    count += keys.length;
    stale += staleKeys.length;
    if (have < keys.length && COMPLETE[lang].includes(course)) incomplete += 1;
    if (!existsSync(sidecar)) missing += 1;
    if (all || (existsSync(sidecar) && have < keys.length) || staleKeys.length > 0) {
      const pct = keys.length ? ((100 * have) / keys.length).toFixed(1) : '100.0';
      console.log(`${course}/${f}: ${have}/${keys.length} (${pct}%), stale ${staleKeys.length}${existsSync(sidecar) ? '' : ', NO SIDECAR'}`);
    }
  }
  const pct = count ? ((100 * covered) / count).toFixed(2) : '100.00';
  console.log(`${course}: ${files.length} lessons, ${covered}/${count} Lang4 covered (${pct}%), ${stale} stale${missing ? `, ${missing} without a sidecar yet` : ''}`);
  totalCovered += covered;
  totalAll += count;
  totalStale += stale;
  totalLessons += files.length;
}
const total = totalAll ? ((100 * totalCovered) / totalAll).toFixed(2) : '100.00';
console.log(`TOTAL: ${totalLessons} lessons, ${totalCovered}/${totalAll} Lang4 covered (${total}%), ${totalStale} stale`);
if (strict && incomplete > 0) {
  console.error(`${incomplete} lesson(s) of ${COMPLETE[lang].join(' and ')} are not at 100%`);
  process.exit(1);
}
