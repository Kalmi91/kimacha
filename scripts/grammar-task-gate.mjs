// Content gate of the grammar task types (SPEC-grammar-tests.md section 5, "content gate"): in every SWITCHED-ON level
// (data/grammar/task-types.json) each core topic has at least `minPerType` items of every task type the level uses.
// Without it a test built from the level would silently skip a type.
//
// Usage:
//   node scripts/grammar-task-gate.mjs [--all] [--config f] [--syllabus f] [--tiers f.json] [--lessons dir]
//   --all       check every level of the config, whatever its `enabled` switch (shows what a level still lacks)
//   --config    the task-types file (default data/grammar/task-types.json)
//   --syllabus  the syllabus (default data/grammar/syllabus.json; { topics: [{ id, level }] })
//   --tiers     a { topicId: tier } JSON; default: the GRAMMAR_TIER map read from lib/grammar/syllabus.ts (the one marking)
//   --lessons   the lesson JSON folder (default data/games/grammar/es)
// A core topic is a syllabus topic of the level whose tier is one of the config's `coreTiers`. A topic with no lesson
// file counts 0 items. The last line is the summary, exit 1 on any gap.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const configFile = opt('--config', path.join(ROOT, 'data', 'grammar', 'task-types.json'));
const syllabusFile = opt('--syllabus', path.join(ROOT, 'data', 'grammar', 'syllabus.json'));
const lessonsDir = opt('--lessons', path.join(ROOT, 'data', 'games', 'grammar', 'es'));
const tiersFile = opt('--tiers', null);

/** { topicId: tier } from the GRAMMAR_TIER block of lib/grammar/syllabus.ts. */
function tiersFromSource() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'grammar', 'syllabus.ts'), 'utf8');
  const start = src.indexOf('const GRAMMAR_TIER');
  const end = src.indexOf('\n};', start);
  if (start < 0 || end < 0) throw new Error('GRAMMAR_TIER block not found in lib/grammar/syllabus.ts');
  const tiers = {};
  for (const m of src.slice(start, end).matchAll(/^\s*(?:'([^']+)'|([A-Za-z0-9_]+))\s*:\s*'([a-z-]+)'/gm)) tiers[m[1] ?? m[2]] = m[3];
  return tiers;
}

/** The kind an item has for counting: gap items carry no kind (or 'gap' / 'mark') and count as `choice`, article sets do not. */
function kindOf(item) {
  if (item.kind === undefined || item.kind === 'gap' || item.kind === 'mark') return item.set === 'article' ? 'article' : 'choice';
  return item.kind;
}

function main() {
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const syllabus = JSON.parse(fs.readFileSync(syllabusFile, 'utf8')).topics;
  const tiers = tiersFile ? JSON.parse(fs.readFileSync(tiersFile, 'utf8')) : tiersFromSource();
  const errors = [];
  let checked = 0;

  for (const [level, spec] of Object.entries(config.levels)) {
    if (!flag('--all') && !spec.enabled) continue;
    checked++;
    for (const type of spec.types) {
      if (!config.types[type]) errors.push(`${level}: type "${type}" is not defined in "types"`);
    }
    const core = syllabus.filter((t) => t.level === level && config.coreTiers.includes(tiers[t.id] ?? 'full'));
    for (const topic of core) {
      const file = path.join(lessonsDir, `${topic.id}.json`);
      const items = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')).items ?? []) : [];
      const perKind = {};
      for (const it of items) perKind[kindOf(it)] = (perKind[kindOf(it)] ?? 0) + 1;
      for (const type of spec.types) {
        const kinds = config.types[type] ?? [];
        const have = kinds.reduce((n, k) => n + (perKind[k] ?? 0), 0);
        if (have < config.minPerType) errors.push(`${level} ${topic.id} ${type}: ${have}/${config.minPerType}`);
      }
    }
  }

  errors.forEach((e) => console.log(`ERROR ${e}`));
  console.log(`grammar-task-gate: ${errors.length === 0 ? 'OK' : 'FAIL'} (${checked} levels checked, ${errors.length} gaps)`);
  process.exit(errors.length === 0 ? 0 : 1);
}

main();
