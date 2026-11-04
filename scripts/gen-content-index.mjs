#!/usr/bin/env node
/**
 * gen-content-index.mjs, writes the lazy grammar-lesson registry of each language lane:
 *   lib/games/content/<lang>.index.ts   from   data/games/grammar/<lang>/*.json
 *   lib/games/content/<lang>.hu.index.ts   topic id -> lazy Hungarian sidecar data/games/grammar-hu/<lang>/<file>.json
 *                                          (only for lessons that have one; the hu lane has none, the de lane has this one only)
 *   lib/games/content/<lang>.de.index.ts   topic id -> lazy German sidecar data/games/grammar-de/<lang>/<file>.json
 *                                          (only for lessons that have one; es, en and hu lanes, the de lane has none:
 *                                          a German speaker never takes the German course)
 *
 * Every entry is `{ id, load: () => require('<static path>') }`, so Metro still
 * bundles the JSON but nothing is parsed until the lesson is first asked for.
 * `id` is the JSON's `topic` field (what getGrammarTopic matches on), not the file name.
 *
 * Each of these also gets a web twin `<x>.index.web.ts` (Metro picks it on web): the same ids in the same order, but
 * `load: () => packEntry('<pack>', '<id>')` reads the lesson from a content pack (lib/games/content/webPacks.ts) that the web gate
 * fetches at start (dist/content/<pack>.json, written by scripts/build-web-content.mjs), so the JSON is not in the web bundle.
 * lib/games/content/webPacks.generated.ts lists the packs (name + source folder).
 *
 * Order = the learning order (it is the order getGrammarTopics returns). It is kept from the
 * existing index file; JSON files that are not in it yet are appended alphabetically,
 * files that are gone are dropped. Re-order by moving a line in the generated file, then re-run.
 * The German course (lang de) is the exception: its order is the syllabus order (data/grammar/syllabus-de.json),
 * so a lesson file added later lands at its place in the course, whatever order the files arrive in.
 *
 * Run: npm run gen:content            (rewrites the index files)
 *      node scripts/gen-content-index.mjs --check   (exit 1 if an index file is out of date)
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { basename, dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['es', 'en', 'hu', 'de'];
// The overlay languages: their sidecar folder, and the lanes that take them (nobody learns Hungarian from Hungarian text).
const OVERLAYS = [
  { code: 'hu', dir: join(root, 'data', 'games', 'grammar-hu'), lanes: ['es', 'en', 'de'], name: 'Hungarian' },
  { code: 'de', dir: join(root, 'data', 'games', 'grammar-de'), lanes: ['es', 'en', 'hu'], name: 'German' },
];
// Languages whose lesson order follows a syllabus file (topic ids in teaching order) instead of the previous index.
const SYLLABUS_ORDER = { de: join(root, 'data', 'grammar', 'syllabus-de.json') };
const check = process.argv.includes('--check');

function render(lang, dir, previous) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  const known = new Set(files);
  const prevOrder = previous
    ? [...previous.matchAll(new RegExp(`grammar/${lang}/([^']+)\\.json'`, 'g'))].map((m) => m[1])
    : [];
  const syllabusFile = SYLLABUS_ORDER[lang];
  const syllabusIds = syllabusFile && existsSync(syllabusFile) ? JSON.parse(readFileSync(syllabusFile, 'utf8')).topics.map((t) => t.id) : [];
  const fromSyllabus = syllabusIds.filter((id) => known.has(id));
  const ordered = [...new Set([...fromSyllabus, ...prevOrder.filter((f) => known.has(f))])];
  const placed = new Set(ordered);
  for (const f of files.sort()) if (!placed.has(f)) ordered.push(f);

  const ids = new Set();
  const overlayLines = Object.fromEntries(OVERLAYS.map((o) => [o.code, []]));
  const overlayWebLines = Object.fromEntries(OVERLAYS.map((o) => [o.code, []]));
  const webLines = [];
  const pack = `grammar-${lang}`;
  const lines = ordered.map((file) => {
    const id = JSON.parse(readFileSync(join(dir, `${file}.json`), 'utf8')).topic ?? file;
    if (ids.has(id)) throw new Error(`${lang}: duplicate topic id "${id}" (${file}.json)`);
    ids.add(id);
    for (const o of OVERLAYS) {
      if (existsSync(join(o.dir, lang, `${file}.json`))) {
        overlayLines[o.code].push(`  '${id}': () => require('@/data/games/grammar-${o.code}/${lang}/${file}.json'),`);
        overlayWebLines[o.code].push(`  '${id}': () => packEntry('grammar-${o.code}-${lang}', '${id}'),`);
      }
    }
    webLines.push(`  { id: '${id}', load: () => packEntry('${pack}', '${id}') },`);
    return `  { id: '${id}', load: () => require('@/data/games/grammar/${lang}/${file}.json') },`;
  });
  const packs = [{ name: pack, dir: `data/games/grammar/${lang}` }];
  for (const o of OVERLAYS) {
    if (o.lanes.includes(lang) && overlayLines[o.code].length) packs.push({ name: `grammar-${o.code}-${lang}`, dir: `data/games/grammar-${o.code}/${lang}` });
  }

  const index = [
    `// GENERATED by scripts/gen-content-index.mjs (npm run gen:content), do not edit.`,
    `// One line per data/games/grammar/${lang}/*.json, in learning order (move a line to reorder, then re-run). The JSON is parsed on first use.`,
    ``,
    `import type { GrammarIndexEntry } from '../content';`,
    ``,
    `export const ${lang.toUpperCase()}_GRAMMAR_INDEX: GrammarIndexEntry[] = [`,
    ...lines,
    `];`,
    ``,
  ].join('\n');
  const overlays = Object.fromEntries(
    OVERLAYS.map((o) => [
      o.code,
      [
        `// GENERATED by scripts/gen-content-index.mjs (npm run gen:content), do not edit.`,
        `// Topic id -> the lazy ${o.name} sidecar data/games/grammar-${o.code}/${lang}/<lesson>.json, only for lessons that have one (lib/grammar/overlay.ts lays it over the lesson).`,
        ``,
        `export const ${lang.toUpperCase()}_GRAMMAR_${o.code.toUpperCase()}: Record<string, () => Record<string, string>> = {`,
        ...overlayLines[o.code],
        `};`,
        ``,
      ].join('\n'),
    ]),
  );
  const indexWeb = [
    `// GENERATED by scripts/gen-content-index.mjs (npm run gen:content), do not edit.`,
    `// Web twin of ${lang}.index.ts (Metro picks it on web): the same lessons in the same order, read from the content pack that the web gate fetches at start (webPacks.ts) instead of bundled.`,
    ``,
    `import type { GrammarIndexEntry } from '../content';`,
    `import { packEntry } from './webPacks';`,
    ``,
    `export const ${lang.toUpperCase()}_GRAMMAR_INDEX: GrammarIndexEntry[] = [`,
    ...webLines,
    `];`,
    ``,
  ].join('\n');
  const overlaysWeb = Object.fromEntries(
    OVERLAYS.map((o) => [
      o.code,
      [
        `// GENERATED by scripts/gen-content-index.mjs (npm run gen:content), do not edit.`,
        `// Web twin of ${lang}.${o.code}.index.ts (Metro picks it on web): the ${o.name} sidecars come from the content pack that the web gate fetches at start (webPacks.ts).`,
        ``,
        `import { packEntry } from './webPacks';`,
        ``,
        `export const ${lang.toUpperCase()}_GRAMMAR_${o.code.toUpperCase()}: Record<string, () => Record<string, string>> = {`,
        ...overlayWebLines[o.code],
        `};`,
        ``,
      ].join('\n'),
    ]),
  );
  return { index, overlays, indexWeb, overlaysWeb, packs };
}

let stale = false;
const outputs = [];
const allPacks = [];
const readOr = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');
for (const lang of LANGS) {
  const out = join(root, 'lib', 'games', 'content', `${lang}.index.ts`);
  const previous = existsSync(out) ? readFileSync(out, 'utf8') : '';
  const next = render(lang, join(root, 'data', 'games', 'grammar', lang), previous);
  outputs.push([out, next.index, previous]);
  const outWeb = join(root, 'lib', 'games', 'content', `${lang}.index.web.ts`);
  outputs.push([outWeb, next.indexWeb, readOr(outWeb)]);
  allPacks.push(...next.packs);
  // The Hungarian course (target hu) has no Hungarian sidecar: only the lesson registry (and the German sidecars).
  for (const o of OVERLAYS) {
    if (!o.lanes.includes(lang)) continue;
    const file = join(root, 'lib', 'games', 'content', `${lang}.${o.code}.index.ts`);
    outputs.push([file, next.overlays[o.code], existsSync(file) ? readFileSync(file, 'utf8') : '']);
    const fileWeb = join(root, 'lib', 'games', 'content', `${lang}.${o.code}.index.web.ts`);
    outputs.push([fileWeb, next.overlaysWeb[o.code], readOr(fileWeb)]);
  }
}
// Every web content pack (name = dist/content/<name>.json, dir = its source folder): read by webPacks.ts and scripts/build-web-content.mjs.
const packsFile = join(root, 'lib', 'games', 'content', 'webPacks.generated.ts');
outputs.push([
  packsFile,
  [
    `// GENERATED by scripts/gen-content-index.mjs (npm run gen:content), do not edit.`,
    `// The web content packs: name (dist/content/<name>.json) and the data folder each is built from (scripts/build-web-content.mjs).`,
    ``,
    `export const WEB_PACKS: { name: string; dir: string }[] = [`,
    ...allPacks.map((p) => `  { name: '${p.name}', dir: '${p.dir}' },`),
    `];`,
    ``,
  ].join('\n'),
  readOr(packsFile),
]);
for (const [file, content, before] of outputs) {
  const name = basename(file);
  if (check) {
    if (content !== before) {
      console.error(`${name} is out of date, run: npm run gen:content`);
      stale = true;
    }
  } else if (content !== before) {
    writeFileSync(file, content);
    console.log(`wrote lib/games/content/${name}`);
  }
}
if (stale) process.exit(1);
