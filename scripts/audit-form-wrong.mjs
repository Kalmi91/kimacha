#!/usr/bin/env node
/**
 * audit-form-wrong.mjs: the typed-mistake maps of the grammar form items.
 *   - information: per lane and level, how many form items have a `wrong` map (the E103 work goes level by level);
 *   - P1 (exit 1): a `wrong` key that equals the item's right answer after normalization (as lib/grammar/resultDetail.ts
 *     normalizes the typed text), an empty key, two keys of one item that normalize the same.
 * The level of a lesson is the one of data/grammar/syllabus.json (Spanish course), else the lesson's own `level`.
 * Run: node scripts/audit-form-wrong.mjs
 */
import { createRequire } from 'module';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { wrongKeyViolations, wrongCount } = require('./formWrongAudit.cjs');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gamesDir = join(root, 'data', 'games', 'grammar');

const syllabusLevel = {};
const syllabusPath = join(root, 'data', 'grammar', 'syllabus.json');
if (existsSync(syllabusPath)) {
  for (const t of JSON.parse(readFileSync(syllabusPath, 'utf8')).topics ?? []) syllabusLevel[t.id] = t.level;
}

const problems = [];
const share = {};
for (const lane of readdirSync(gamesDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const dir = join(gamesDir, lane.name);
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const lesson = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    problems.push(...wrongKeyViolations(lesson, `${lane.name}/${f}: `));
    const level = (lane.name === 'es' && syllabusLevel[lesson.topic]) || lesson.level || '?';
    const c = wrongCount(lesson);
    const s = ((share[lane.name] ??= {})[level] ??= { total: 0, withWrong: 0 });
    s.total += c.total;
    s.withWrong += c.withWrong;
  }
}

console.log('audit-form-wrong: form items with a `wrong` map (information)');
for (const [lane, levels] of Object.entries(share)) {
  const line = Object.keys(levels)
    .sort()
    .map((l) => `${l} ${levels[l].withWrong}/${levels[l].total} (${levels[l].total ? Math.round((100 * levels[l].withWrong) / levels[l].total) : 0}%)`)
    .join(', ');
  console.log(`  ${lane}: ${line}`);
}
// items on purpose without a `wrong` map: every typical wrong answer of them is acceptable Spanish in Mexico
const NO_SAFE_KEY = [
  ['es/por-para.json', 'pp-form-04'],
  ['es/por-para.json', 'pp-form-09'],
  ['es/haber-impersonal-tiempos.json', 'hb-form-10'],
];
const left = NO_SAFE_KEY.filter(([f, id]) => {
  const item = JSON.parse(readFileSync(join(gamesDir, f), 'utf8')).items.find((i) => i.id === id);
  return item && !item.wrong;
});
if (left.length) console.log(`  (on purpose without a map, no safe wrong key: ${left.map(([, id]) => id).join(', ')})`);
if (problems.length) {
  console.error(`audit-form-wrong: ${problems.length} P1:`);
  for (const p of problems.slice(0, 30)) console.error('  ' + p);
  process.exit(1);
}
console.log('audit-form-wrong: OK');
