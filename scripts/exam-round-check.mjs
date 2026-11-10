// Gate for the gap texts of the Grammar tab's exam round (data/grammar/exam-round/<lang>-<level>.json), the content of
// lib/grammar/examRound.ts. The schema is ExamRoundFile there:
//   { lang, level, skip?: [{ topic, why }], texts: [{ id, title, text with {{1}}..{{6}}, gaps: [{ options[3], correct, topic }] }] }
//
// Usage:
//   node scripts/exam-round-check.mjs [--strict] [file ...]   check the given files (default: every file under data/grammar/exam-round);
//                                                             a `*` in a path is expanded here (PowerShell does not)
// An empty `texts` list is a warning ("not written yet"), an error with --strict. The last line is the summary, exit 1 on errors.
//
// Rules (every violation is an error):
//   R1  file name = <lang>-<level lower-case>.json and the header matches it; text ids unique, of the form <lang>-<level>-NN
//   R2  text: the markers {{1}}..{{6}} each exactly once and in order, exactly 6 gaps, a word between two markers, the word count
//       (markers not counted) inside the band of the level (WORD_BANDS; a level without a band is an error)
//   R3  gap: exactly 3 non-empty options, all different (trimmed, lower-cased), `correct` 0..2, `topic` = a topic of that level in
//       that language's syllabus that has a written lesson
//   R4  a text has at least 4 different topics, no topic more than twice
//   R5  file: at least 10 texts; every topic of the level with a written lesson has at least 2 gaps or is named in `skip` with a
//       reason (at most 3 skipped, a skipped topic has no gap)
//   R6  each option position (0, 1, 2) is the correct one in 20-47% of the file's gaps; within one text the same position is
//       correct at most 3 times
//   R7  no em dash anywhere; es: no vosotros form and no Spain-only word (the blacklist of scripts/mock-exam-check.mjs, rule M6)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'data', 'grammar', 'exam-round');

const GAPS = 6;
const OPTIONS = 3;
const MIN_TEXTS = 10;
const MAX_PER_TOPIC_IN_TEXT = 2;
const MIN_TOPICS_IN_TEXT = 4;
const MIN_GAPS_PER_TOPIC = 2;
const MAX_SKIP = 3;
const POSITION_SHARE = [0.2, 0.47];
const MAX_SAME_POSITION_IN_TEXT = 3;
// words per text (markers not counted), per level; a level without a band is an error
const WORD_BANDS = { a1: [55, 95] };
// the syllabus file of each learned language (the English syllabus is built in code and has no file here)
const SYLLABUS = { es: 'syllabus.json', hu: 'syllabus-hu.json', de: 'syllabus-de.json' };

// es norm (same patterns as scripts/mock-exam-check.mjs ES_BLACKLIST): Mexican usage, no vosotros, no Spain-only words
const ES_BLACKLIST = [/vosotr/iu, /(?<!\p{L})coche/iu, /(?<!\p{L})ordenador/iu, /(?<!\p{L})zumo(?!\p{L})/iu, /(?<!\p{L})móvil(?!\p{L})/iu, /(?<!\p{L})os(?!\p{L})/iu];
const EM_DASH = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`);

const args = process.argv.slice(2);
const strict = args.includes('--strict');

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
/** The topics of a level in the language's syllabus that have a written lesson, or null when there is no syllabus. */
function writtenTopics(lang, level) {
  const file = SYLLABUS[lang];
  if (!file) return null;
  if (!syllabusCache.has(lang)) syllabusCache.set(lang, JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'grammar', file), 'utf8')).topics);
  return syllabusCache.get(lang)
    .filter((tp) => tp.level === level.toUpperCase() && fs.existsSync(path.join(ROOT, 'data', 'games', 'grammar', lang, `${tp.id}.json`)))
    .map((tp) => tp.id);
}

function* strings(v, at = '') {
  if (typeof v === 'string') yield [at, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* strings(v[i], `${at}[${i}]`);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* strings(x, at ? `${at}.${k}` : k);
}

const wordCount = (s) => (s.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;

function checkFile(file) {
  const errors = [];
  const warnings = [];
  const name = path.basename(file);
  const err = (rule, msg) => errors.push(`${rule}: ${name}: ${msg}`);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    err('R1', `not valid JSON (${String(e.message).slice(0, 80)})`);
    return { errors, warnings };
  }

  // R1
  const m = /^([a-z]{2})-([a-z0-9]+)\.json$/.exec(name);
  if (!m) err('R1', 'file name must be <lang>-<level lower-case>.json');
  const lang = m?.[1];
  const level = m?.[2];
  if (m && (data.lang !== lang || typeof data.level !== 'string' || data.level.toLowerCase() !== level || data.level !== data.level.toUpperCase())) {
    err('R1', `header ${JSON.stringify(data.lang)} / ${JSON.stringify(data.level)} does not match the file name`);
  }
  if (!Array.isArray(data.texts)) {
    err('R1', '`texts` must be a list');
    return { errors, warnings };
  }

  // R7: every string of the file
  for (const [at, text] of strings(data)) {
    if (EM_DASH.test(text)) err('R7', `${at}: em dash (use a comma, a colon or a new sentence)`);
    if (lang === 'es') for (const re of ES_BLACKLIST) if (re.test(text)) err('R7', `${at}: "${text.match(re)[0]}" is not Mexican usage (${re})`);
  }

  const topics = m ? writtenTopics(lang, level) : null;
  if (m && topics === null) err('R3', `no syllabus file for the language "${lang}"`);
  const topicSet = new Set(topics ?? []);

  if (data.texts.length === 0) {
    const msg = `${name}: no texts yet (not written yet)`;
    if (strict) errors.push(`R5: ${msg}`);
    else warnings.push(msg);
    return { errors, warnings };
  }

  const band = level ? WORD_BANDS[level] : undefined;
  if (m && !band) err('R2', `no word band for the level "${level}" (add it to WORD_BANDS)`);

  const ids = new Set();
  const gapsPerTopic = new Map();
  const position = [0, 0, 0];
  let gapTotal = 0;
  data.texts.forEach((tx, ti) => {
    const at = `texts[${ti}]${typeof tx?.id === 'string' ? ` (${tx.id})` : ''}`;
    if (!tx || typeof tx !== 'object') return err('R2', `${at}: not an object`);
    // R1: ids
    if (typeof tx.id !== 'string' || !new RegExp(`^${lang}-${level}-\\d{2}$`).test(tx.id)) err('R1', `${at}: id must look like ${lang}-${level}-NN`);
    else if (ids.has(tx.id)) err('R1', `${at}: duplicate id`);
    else ids.add(tx.id);
    if (typeof tx.title !== 'string' || tx.title.trim() === '') err('R2', `${at}: title is empty`);

    // R2: the markers
    const body = typeof tx.text === 'string' ? tx.text : '';
    if (body === '') err('R2', `${at}: text is empty`);
    const marks = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((x) => Number(x[1]));
    const inOrder = marks.length === GAPS && marks.every((n, i) => n === i + 1);
    if (!inOrder) err('R2', `${at}: the markers {{1}}..{{${GAPS}}} must each stand exactly once and in order (found ${marks.map((n) => `{{${n}}}`).join(' ') || 'none'})`);
    const pieces = body.split(/\{\{\d+\}\}/);
    for (let i = 1; i < pieces.length - 1; i++) {
      if (wordCount(pieces[i]) === 0) err('R2', `${at}: no word between two markers (around gap ${i} and ${i + 1})`);
    }
    if (band) {
      const words = wordCount(body.replace(/\{\{\d+\}\}/g, ' '));
      if (words < band[0] || words > band[1]) err('R2', `${at}: ${words} words, the band of ${level.toUpperCase()} is ${band[0]}-${band[1]}`);
    }
    if (!Array.isArray(tx.gaps) || tx.gaps.length !== GAPS) {
      err('R2', `${at}: exactly ${GAPS} gaps needed (found ${Array.isArray(tx.gaps) ? tx.gaps.length : 'none'})`);
      return;
    }

    // R3: the gaps
    const inText = new Map();
    const samePosition = [0, 0, 0];
    tx.gaps.forEach((g, gi) => {
      const gat = `${at} gap ${gi + 1}`;
      if (!g || typeof g !== 'object') return err('R3', `${gat}: not an object`);
      const opts = Array.isArray(g.options) ? g.options : [];
      if (opts.length !== OPTIONS || !opts.every((o) => typeof o === 'string' && o.trim() !== '')) err('R3', `${gat}: exactly ${OPTIONS} non-empty options needed`);
      else if (new Set(opts.map((o) => o.trim().toLowerCase())).size !== OPTIONS) err('R3', `${gat}: the options must all differ`);
      const okCorrect = Number.isInteger(g.correct) && g.correct >= 0 && g.correct < OPTIONS;
      if (!okCorrect) err('R3', `${gat}: correct must be 0..${OPTIONS - 1}`);
      if (typeof g.topic !== 'string' || !topicSet.has(g.topic)) err('R3', `${gat}: topic ${JSON.stringify(g.topic)} is not a topic of ${level?.toUpperCase()} with a written lesson`);
      if (typeof g.topic === 'string') {
        inText.set(g.topic, (inText.get(g.topic) ?? 0) + 1);
        gapsPerTopic.set(g.topic, (gapsPerTopic.get(g.topic) ?? 0) + 1);
      }
      if (okCorrect) {
        position[g.correct]++;
        samePosition[g.correct]++;
      }
      gapTotal++;
    });

    // R4
    if (inText.size < MIN_TOPICS_IN_TEXT) err('R4', `${at}: ${inText.size} different topics, at least ${MIN_TOPICS_IN_TEXT} needed`);
    for (const [topic, n] of inText) if (n > MAX_PER_TOPIC_IN_TEXT) err('R4', `${at}: topic ${topic} has ${n} gaps, at most ${MAX_PER_TOPIC_IN_TEXT}`);
    // R6 (inside a text)
    samePosition.forEach((n, p) => {
      if (n > MAX_SAME_POSITION_IN_TEXT) err('R6', `${at}: option ${p} is the correct one ${n} times, at most ${MAX_SAME_POSITION_IN_TEXT}`);
    });
  });

  // R5
  if (data.texts.length < MIN_TEXTS) err('R5', `${data.texts.length} texts, at least ${MIN_TEXTS} needed`);
  const skip = Array.isArray(data.skip) ? data.skip : [];
  if (skip.length > MAX_SKIP) err('R5', `${skip.length} skipped topics, at most ${MAX_SKIP}`);
  const skipped = new Set();
  for (const sk of skip) {
    if (!sk || typeof sk.topic !== 'string' || !topicSet.has(sk.topic)) err('R5', `skip: ${JSON.stringify(sk?.topic)} is not a topic of the level with a written lesson`);
    else if (typeof sk.why !== 'string' || sk.why.trim() === '') err('R5', `skip: ${sk.topic} has no reason`);
    else if (gapsPerTopic.has(sk.topic)) err('R5', `skip: ${sk.topic} is skipped but has ${gapsPerTopic.get(sk.topic)} gaps`);
    else skipped.add(sk.topic);
  }
  for (const id of topics ?? []) {
    if (!skipped.has(id) && (gapsPerTopic.get(id) ?? 0) < MIN_GAPS_PER_TOPIC) {
      err('R5', `topic ${id} has ${gapsPerTopic.get(id) ?? 0} gaps, at least ${MIN_GAPS_PER_TOPIC} needed (or name it in skip with a reason)`);
    }
  }

  // R6 (whole file)
  if (gapTotal > 0) {
    position.forEach((n, p) => {
      const share = n / gapTotal;
      if (share < POSITION_SHARE[0] || share > POSITION_SHARE[1]) {
        err('R6', `option ${p} is the correct one in ${Math.round(share * 100)}% of the gaps, ${Math.round(POSITION_SHARE[0] * 100)}-${Math.round(POSITION_SHARE[1] * 100)}% needed`);
      }
    });
  }
  return { errors, warnings };
}

let errorCount = 0;
let warningCount = 0;
if (files.length === 0) {
  console.log('exam-round-check: no files to check');
  errorCount = 1;
}
for (const file of files) {
  const { errors, warnings } = checkFile(file);
  errors.forEach((e) => console.log(`ERROR ${e}`));
  warnings.forEach((w) => console.log(`warning ${w}`));
  errorCount += errors.length;
  warningCount += warnings.length;
}
console.log(`exam-round-check: ${errorCount === 0 ? 'OK' : 'FAIL'} (${files.length} files, ${errorCount} errors, ${warningCount} warnings)`);
process.exit(errorCount === 0 ? 0 : 1);
