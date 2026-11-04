#!/usr/bin/env node
/**
 * build-web-content.mjs, writes the web content packs next to the Expo web export:
 *   <dist>/content/<pack>.json   = { "<topic id>": <lesson JSON or sidecar JSON>, ... }, compact
 * for every pack in lib/games/content/webPacks.generated.ts (written by scripts/gen-content-index.mjs). The web build does not
 * bundle the lesson JSON (the `<x>.index.web.ts` twins read these packs, lib/games/content/webPacks.ts fetches them at start).
 * The topic id is the lesson's `topic` field (file name if it has none); a sidecar takes the id of the lesson with the same file name.
 * A pack over 24 MiB fails the build (Cloudflare Workers assets stop at 25 MiB per file).
 *
 * Run: npm run build:web-content            (writes into ./dist, after `npx expo export -p web`)
 *      node scripts/build-web-content.mjs <dist dir>
 */

import { mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { basename, dirname, join, resolve } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIMIT = 24 * 1024 * 1024;
const outDir = join(resolve(process.argv[2] ?? 'dist'), 'content');

const list = readFileSync(join(root, 'lib', 'games', 'content', 'webPacks.generated.ts'), 'utf8');
const packs = [...list.matchAll(/\{ name: '([^']+)', dir: '([^']+)' \}/g)].map((m) => ({ name: m[1], dir: join(root, ...m[2].split('/')) }));
if (packs.length === 0) throw new Error('no packs in webPacks.generated.ts, run: npm run gen:content');

mkdirSync(outDir, { recursive: true });
for (const { name, dir } of packs) {
  // the lessons of the same course (data/games/grammar/<course>) give the ids, for the lesson pack and for its sidecars alike
  const lessons = join(root, 'data', 'games', 'grammar', basename(dir));
  const pack = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    if (!existsSync(join(lessons, f))) continue;
    const id = JSON.parse(readFileSync(join(lessons, f), 'utf8')).topic ?? f.slice(0, -5);
    pack[id] = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  }
  const text = JSON.stringify(pack);
  const bytes = Buffer.byteLength(text);
  if (bytes > LIMIT) {
    console.error(`${name}.json is ${(bytes / 1048576).toFixed(1)} MiB, over the 24 MiB limit`);
    process.exit(1);
  }
  writeFileSync(join(outDir, `${name}.json`), text);
  console.log(`wrote content/${name}.json (${Object.keys(pack).length} entries, ${(bytes / 1048576).toFixed(2)} MiB)`);
}
