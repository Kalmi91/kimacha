// Gate for the grammar topics of the mock exam gaps (data/exams/mock/<lang>-<level>-<paper>.json). A `cloze` gap and a
// `transform` item may carry `topic`: a grammar syllabus topic id; a mistake there counts as test evidence of the topic
// (lib/exam/mock/evidence.ts). Every `topic` must be a topic id of that file's language syllabus that has a written lesson.
//
// Usage:
//   node scripts/mock-topic-check.mjs [file ...]   check the given files (default: every file under data/exams/mock);
//                                                  a `*` in a path is expanded here (PowerShell does not)
// Prints `<file>: tagged / gaps` for every file that has a cloze or transform task. Exit 1 on an unknown topic, naming the
// file, the task and the gap; the last line is the summary.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'data', 'exams', 'mock');
// the syllabus file of each language (the English syllabus is built in code and has no file here: no topic can be checked)
const SYLLABUS = { es: 'syllabus.json', hu: 'syllabus-hu.json', de: 'syllabus-de.json' };

const args = process.argv.slice(2);

function expand(arg) {
  if (!arg.includes('*')) return [arg];
  const dir = path.dirname(arg);
  const re = new RegExp('^' + path.basename(arg).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return fs.readdirSync(dir).filter((f) => re.test(f)).map((f) => path.join(dir, f));
}

const files = args.filter((a) => !a.startsWith('--')).flatMap(expand);
if (files.length === 0 && fs.existsSync(DIR)) {
  files.push(...fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(DIR, f)));
}

const syllabusCache = new Map();
/** The ids of the language's syllabus topics that have a written lesson, or null when the language has no syllabus file. */
function writtenTopics(lang) {
  const file = SYLLABUS[lang];
  if (!file) return null;
  if (!syllabusCache.has(lang)) {
    const topics = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'grammar', file), 'utf8')).topics;
    syllabusCache.set(lang, new Set(topics.filter((tp) => fs.existsSync(path.join(ROOT, 'data', 'games', 'grammar', lang, `${tp.id}.json`))).map((tp) => tp.id)));
  }
  return syllabusCache.get(lang);
}

function checkFile(file) {
  const errors = [];
  const name = path.basename(file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return { errors: [`${name}: not valid JSON (${String(e.message).slice(0, 80)})`], tagged: 0, gaps: 0, hasTasks: false };
  }
  const lang = /^([a-z]{2})-/.exec(name)?.[1];
  const topics = lang ? writtenTopics(lang) : null;
  let tagged = 0;
  let gaps = 0;
  let hasTasks = false;
  (Array.isArray(data.forms) ? data.forms : []).forEach((form, fi) => {
    (Array.isArray(form?.tasks) ? form.tasks : []).forEach((task, ti) => {
      const list = task?.kind === 'cloze' ? task.gaps : task?.kind === 'transform' ? task.items : null;
      if (!Array.isArray(list)) return;
      hasTasks = true;
      const label = task.kind === 'cloze' ? 'gap' : 'item';
      list.forEach((g, gi) => {
        gaps++;
        if (g?.topic === undefined) return;
        tagged++;
        const at = `${name}: forms[${fi}] task ${ti + 1} (${task.kind}) ${label} ${gi + 1}`;
        if (typeof g.topic !== 'string' || g.topic === '') errors.push(`${at}: topic must be a non-empty string`);
        else if (topics === null) errors.push(`${at}: topic ${JSON.stringify(g.topic)} but there is no syllabus file for the language "${lang}"`);
        else if (!topics.has(g.topic)) errors.push(`${at}: topic ${JSON.stringify(g.topic)} is not a topic of the "${lang}" syllabus with a written lesson`);
      });
    });
  });
  return { errors, tagged, gaps, hasTasks };
}

let errorCount = 0;
if (files.length === 0) {
  console.log('mock-topic-check: no files to check');
  errorCount = 1;
}
for (const file of files) {
  const { errors, tagged, gaps, hasTasks } = checkFile(file);
  if (hasTasks) console.log(`${path.basename(file)}: ${tagged} / ${gaps}`);
  errors.forEach((e) => console.log(`ERROR ${e}`));
  errorCount += errors.length;
}
console.log(`mock-topic-check: ${errorCount === 0 ? 'OK' : 'FAIL'} (${files.length} files, ${errorCount} errors)`);
process.exit(errorCount === 0 ? 0 : 1);
