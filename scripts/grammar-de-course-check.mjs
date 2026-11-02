#!/usr/bin/env node
/**
 * grammar-de-course-check.mjs, the guard for the German grammar course (target de: en, es and hu learners):
 *   data/grammar/syllabus-de.json                   units + topics A1 to C1
 *   data/games/grammar/de/<topic>.json              the lessons (same schema 2 as the Hungarian course; the German
 *                                                   text sits in the `es`-named fields, `tr` holds en and es)
 *   data/games/grammar-hu/de/<topic>.json           the Hungarian explanations, { "<exact en text>": "<hu>" }
 *
 * P1 = must fix (exit 1): schema, 14 choice + 12 form + 4 why per lesson, 3 options, `correct` in range, exactly one
 *      `___` gap, wrong[] for every wrong option in en and es, speak/table/example rules (as lib/__tests__/lessonSchema.test.ts
 *      for hu), no em dash, NFC text, no ASCII stand-ins for umlaut/ß in German words, no Austrian/Swiss headwords,
 *      a complete Hungarian sidecar (every en text has a hu text, no stale keys).
 * P2 = reported, not blocking (heuristics): self-revealing items, sentence longer than 12 words, gap-at-start casing,
 *      unbalanced correct positions, grammar above the lesson's level (Präteritum, Konjunktiv, passive, subordinate
 *      clauses, genitive, ...), form answers that are not a cell of their table, short `wrong` texts.
 * The word gate (every German word is in the level's deck) waits for data/words/de (build-de-deck); until then the
 * level heuristics are the only vocabulary-level guard.
 *
 * Run: node scripts/grammar-de-course-check.mjs              (everything; P2 grouped)
 *      node scripts/grammar-de-course-check.mjs --lesson artikel-genus   (one lesson)
 *      node scripts/grammar-de-course-check.mjs --quiet       (P1 only plus the summary)
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { importTs } from './lib/importTs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const only = args.includes('--lesson') ? args[args.indexOf('--lesson') + 1] : null;

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const LANGS = ['en', 'es'];
const EM_DASH = String.fromCharCode(0x2014);
const { lang4Keys } = await importTs(join(root, 'lib', 'grammar', 'huOverlay.ts'));

const p1 = [];
const p2 = [];
const err = (path, issue) => p1.push({ path, issue });
const warn = (path, issue) => p2.push({ path, issue });

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const str = (v) => typeof v === 'string' && v.trim().length > 0;
const isLang = (v) => v && typeof v === 'object' && LANGS.every((l) => str(v[l]));

/** Text of every string in a JSON value, for the whole-file text rules. */
function* strings(v, at = '') {
  if (typeof v === 'string') yield [at, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* strings(v[i], `${at}[${i}]`);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* strings(x, `${at}.${k}`);
}

// ---------------------------------------------------------------------------------------------------------------
// Syllabus
// ---------------------------------------------------------------------------------------------------------------
const syllabusFile = join(root, 'data', 'grammar', 'syllabus-de.json');
const syllabus = readJson(syllabusFile);
const unitIds = new Map();
const topicById = new Map();
const perLevel = Object.fromEntries(LEVELS.map((l) => [l, 0]));
for (const u of syllabus.units ?? []) {
  const at = `syllabus-de unit ${u.id}`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(u.id ?? '')) err(at, 'unit id must be kebab-case ASCII');
  if (unitIds.has(u.id)) err(at, 'duplicate unit id');
  if (!LEVELS.includes(u.level)) err(at, `bad level ${u.level}`);
  if (!isLang(u.title) || !str(u.title.hu)) err(at, 'title needs en, es and hu');
  unitIds.set(u.id, u.level);
}
let lastLevel = -1;
for (const t of syllabus.topics ?? []) {
  const at = `syllabus-de topic ${t.id}`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id ?? '')) err(at, 'topic id must be kebab-case ASCII (ae oe ue ss)');
  if (topicById.has(t.id)) err(at, 'duplicate topic id');
  topicById.set(t.id, t);
  if (!LEVELS.includes(t.level)) err(at, `bad level ${t.level}`);
  else perLevel[t.level] += 1;
  if (LEVELS.indexOf(t.level) < lastLevel) err(at, 'topics must be in level order');
  lastLevel = Math.max(lastLevel, LEVELS.indexOf(t.level));
  if (!unitIds.has(t.unit)) err(at, `unknown unit ${t.unit}`);
  else if (unitIds.get(t.unit) !== t.level) err(at, `unit ${t.unit} is level ${unitIds.get(t.unit)}, topic is ${t.level}`);
  if (!isLang(t.title) || !str(t.title.hu)) err(at, 'title needs en, es and hu');
  if (!isLang(t.blurb) || !str(t.blurb.hu)) err(at, 'blurb needs en, es and hu');
}
for (const u of syllabus.units ?? []) {
  if (!(syllabus.topics ?? []).some((t) => t.unit === u.id)) err(`syllabus-de unit ${u.id}`, 'unit has no topic');
}
for (const [at, s] of strings(syllabus)) {
  if (s.includes(EM_DASH)) err(`syllabus-de ${at}`, 'em dash');
  if (s !== s.normalize('NFC')) err(`syllabus-de ${at}`, 'text is not NFC');
}

// ---------------------------------------------------------------------------------------------------------------
// German text rules
// ---------------------------------------------------------------------------------------------------------------
const wordRe = /[\p{L}\p{M}]+/gu;
/** Whole-word search (unicode aware): index of `target` in `text` or -1 (same idea as lib/grammar/whyTarget.ts). */
function wholeWord(text, target) {
  const isW = (ch) => ch !== undefined && /[\p{L}\p{M}\p{N}]/u.test(ch);
  let from = 0;
  for (;;) {
    const i = text.indexOf(target, from);
    if (i < 0) return -1;
    if (!isW(text[i - 1]) && !isW(text[i + target.length])) return i;
    from = i + 1;
  }
}
const words = (s) => (s.match(wordRe) ?? []);

// ASCII stand-ins and ss for ß in words the Germany standard spells with umlaut or ß.
const ASCII_STANDINS = new RegExp(
  '\\b(?:' +
    [
      'Maedchen', 'Maenner', 'Muenchen', 'Tuer(?:en)?', 'fuer', 'ueber', 'koennen?', 'koennte', 'moechte[n]?', 'muessen', 'muesst', 'muesste',
      'waehrend', 'Woerter', 'Aepfel', 'Buecher', 'Haeuser', 'Gruesse', 'Gruess', 'Schuessel', 'gruen', 'frueh', 'Fruehstueck', 'Kuehlschrank',
      'Strasse[n]?', 'gross(?:e[nmrs]?)?', 'Gross(?:e[nmrs]?)?', 'heiss(?:e[nmrs]?)?', 'heissen', 'weiss', 'Fuss', 'Fussball', 'Spass', 'draussen',
      'ausser', 'schliessen', 'Gruss', 'dreissig', 'Kaese', 'Aerzte?', 'Oel',
    ].join('|') +
    ')\\b',
);
const NON_DE_DE = /\b(?:Jänner|Paradeiser|Erdäpfel|Velo|Grüezi|Servus|Marille|Topfen|Obers|Sackerl|Trottoir|Billet|Zvieri)\b/;
// Old spelling (pre-1996) words, only the frequent ones.
const OLD_SPELLING = /\b(?:daß|muß|mußte|Fluß|Kuß|naß|Schloß|Paß|Haß|Kongreß|Mißerfolg|Rad fahren|spazieren gehn)\b/;

function germanTextChecks(text, at, { allowStandIns = false } = {}) {
  if (text !== text.normalize('NFC')) err(at, 'German text is not NFC (decomposed umlaut)');
  if (!allowStandIns) {
    const m = ASCII_STANDINS.exec(text);
    if (m) err(at, `ASCII stand-in or wrong ss for ß: "${m[0]}"`);
  }
  const m2 = NON_DE_DE.exec(text);
  if (m2) err(at, `Austrian/Swiss word "${m2[0]}" outside an accepted-alternative field`);
  const m3 = OLD_SPELLING.exec(text);
  if (m3) err(at, `old spelling "${m3[0]}"`);
}

// Grammar above the level, report only. [name, minLevel, regex]
const LEVEL_PATTERNS = [
  ['subordinate clause (weil/dass/wenn/ob)', 'A2', /\b(?:weil|dass|ob|wenn)\b/i],
  ['subordinate clause (obwohl/damit/bevor/nachdem/falls/sobald/solange/sodass)', 'B1', /\b(?:obwohl|damit|bevor|nachdem|falls|sobald|solange|sodass)\b/i],
  ['indem / ohne dass / als ob', 'B2', /\b(?:indem|ohne dass|als ob|als wenn|sofern)\b/i],
  ['Präteritum of sein/haben/modals', 'A2', /\b(?:war|warst|waren|wart|hatte|hattest|hatten|hattet|konnte|konntest|konnten|musste|musstest|mussten|wollte|wolltest|wollten|durfte|durften|sollte|sollten|mochte)\b/],
  ['Präteritum of other verbs', 'B1', /\b(?:ging|gingen|kam|kamen|sah|sahen|aß|aßen|trank|tranken|fuhr|fuhren|gab|gaben|nahm|nahmen|las|lasen|schrieb|schrieben|sprach|sprachen|fand|fanden|blieb|blieben|lief|liefen|stand|standen|wusste|dachte|brachte|machte|sagte|lernte|spielte|arbeitete|wohnte|kaufte|zeigte|fragte|antwortete|lebte|liebte|hörte|suchte|besuchte|rief|zog|schlief|trug|traf|half|saß|lag)\b/],
  ['Konjunktiv II', 'B1', /\b(?:würde|würdest|würden|würdet|hätte|hättest|hätten|hättet|wäre|wärst|wären|wärt|könnte|könntest|könnten|müsste|müssten|dürfte|ginge|käme|gäbe|wüsste)\b/],
  ['Plusquamperfekt', 'B2', /\b(?:hatte|hattest|hatten|hattet|war|warst|waren|wart)\b[^.?!]*\bge(?!hen\b|ben\b|gen\b|hören\b)\p{L}{2,}(?:t|en)\s*[.?!]*$/u],
  ['passive / Futur I', 'B1', /\b(?:wird|werden|wurde|wurden|werde|wirst|werdet|worden)\b[^.?!]*\b(?:ge|ver|be|er|ent|zer)\p{L}{2,}(?:t|en)\s*[.?!]*$|\b(?:werde|wirst|wird|werden|werdet)\b[^.?!]*\b\p{Ll}{3,}en\s*[.?!]*$/u],
  ['genitive', 'B1', /\b(?:des|eines|meines|deines|seines|unseres|eures|wegen|trotz|statt|anstatt|außerhalb|innerhalb|dessen|deren)\b\s*\p{Lu}?/u],
  ['relative clause', 'B1', /\p{Ll},\s+(?:der|die|das|den|dem|denen)\s+\p{L}+\s+\p{L}+/u],
  ['zu-infinitive', 'B1', /\b(?:\p{L}+zu\p{Ll}+|zu \p{Ll}+en)\s*[.?!]*$/u],
];
const levelIdx = (l) => LEVELS.indexOf(l);
function levelChecks(text, at, level, topicId) {
  for (const [name, minLevel, re] of LEVEL_PATTERNS) {
    if (levelIdx(level) >= levelIdx(minLevel)) continue;
    // the lesson IS the topic of the pattern: its own level already lets the form in
    if (re.test(text)) warn(at, `${name} is ${minLevel}, lesson is ${level}: "${text.length > 70 ? text.slice(0, 70) + '...' : text}"`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// One lesson
// ---------------------------------------------------------------------------------------------------------------
const deDir = join(root, 'data', 'games', 'grammar', 'de');
const huDir = join(root, 'data', 'games', 'grammar-hu', 'de');
const files = existsSync(deDir) ? readdirSync(deDir).filter((f) => f.endsWith('.json')).sort() : [];
const BODY_KINDS = new Set(['text', 'table', 'list', 'usage', 'contrast', 'tip']);
const LESSON_KEYS = new Set(['schema', 'topic', 'level', 'title', 'body', 'speak', 'glossary', 'items']);
const caps = (s) => /^\p{Lu}/u.test(s);

function checkLesson(file) {
  const topicId = file.slice(0, -5);
  if (only && only !== topicId) return;
  const at = `de/${file}`;
  const lesson = readJson(join(deDir, file));
  const level = lesson.level;

  if (lesson.schema !== 2) err(at, 'schema must be 2');
  if (lesson.topic !== topicId) err(at, `topic "${lesson.topic}" must equal the file name`);
  for (const k of Object.keys(lesson)) if (!LESSON_KEYS.has(k)) err(at, `unknown lesson key "${k}"`);
  const syl = topicById.get(topicId);
  if (!syl) err(at, 'topic is not in data/grammar/syllabus-de.json');
  else if (syl.level !== level) err(at, `level ${level} differs from the syllabus (${syl.level})`);
  if (!LEVELS.includes(level)) err(at, `bad level ${level}`);
  if (!isLang(lesson.title)) err(at, 'title needs en and es');

  for (const [p, s] of strings(lesson)) {
    if (s.includes(EM_DASH)) err(`${at}${p}`, 'em dash');
    if (/\s{2,}|^\s|\s$/.test(s)) warn(`${at}${p}`, 'stray whitespace');
    if (s !== s.normalize('NFC')) err(`${at}${p}`, 'text is not NFC');
  }

  // ---- body
  const tables = new Map();
  const bodyDe = []; // [path, German text]
  if (!Array.isArray(lesson.body) || lesson.body.length < 3) err(at, 'body needs at least 3 blocks');
  (lesson.body ?? []).forEach((b, i) => {
    const bp = `${at} body[${i}] ${b?.kind}`;
    if (!BODY_KINDS.has(b?.kind)) return err(bp, 'unknown block kind');
    if (b.kind === 'text' || b.kind === 'tip') {
      if (!isLang(b.text)) err(bp, 'text needs en and es');
    } else if (b.kind === 'table') {
      if (!str(b.id)) err(bp, 'table needs an id');
      else if (tables.has(b.id)) err(bp, `duplicate table id ${b.id}`);
      else tables.set(b.id, b);
      if (!isLang(b.title)) err(bp, 'table title needs en and es');
      if (!Array.isArray(b.header) || b.header.length < 1 || !b.header.every(isLang)) err(bp, 'table header needs en and es cells');
      if (!Array.isArray(b.rows) || b.rows.length < 1) err(bp, 'table needs rows');
      for (const row of b.rows ?? []) {
        if (row.length !== b.header.length) err(bp, `row width ${row.length} differs from the header (${b.header.length}): ${row.join(' | ')}`);
        row.forEach((c, ci) => bodyDe.push([`${bp} row`, c]));
      }
    } else if (b.kind === 'list' || b.kind === 'usage') {
      const points = b.kind === 'list' ? b.items : b.points;
      if (!Array.isArray(points) || points.length < 1) err(bp, 'no points');
      for (const p of points ?? []) {
        if (!isLang(p.text)) err(bp, 'point text needs en and es');
        if (!Array.isArray(p.examples) || p.examples.length < 2) err(bp, 'every point needs at least 2 examples');
        for (const ex of p.examples ?? []) {
          if (!str(ex.es)) err(bp, 'example needs a German sentence in `es`');
          else bodyDe.push([`${bp} example`, ex.es]);
          if (!isLang(ex.tr)) err(bp, 'example tr needs en and es');
          else if (ex.tr.en.trim() === ex.es.trim()) err(bp, `translation equals the sentence: ${ex.es}`);
        }
      }
    } else if (b.kind === 'contrast') {
      if (!Array.isArray(b.pairs) || b.pairs.length < 1) err(bp, 'no pairs');
      for (const p of b.pairs ?? []) {
        if (!str(p.a) || !str(p.b)) err(bp, 'pair needs a and b');
        else bodyDe.push([`${bp} a/b`, p.a], [`${bp} a/b`, p.b]);
        if (!isLang(p.note)) err(bp, 'pair note needs en and es');
        if (!Array.isArray(p.examples) || p.examples.length < 2) err(bp, 'every pair needs at least 2 examples');
        for (const ex of p.examples ?? []) {
          if (!str(ex.es) || !isLang(ex.tr)) err(bp, 'example needs es and tr en/es');
          else bodyDe.push([`${bp} example`, ex.es]);
        }
      }
    }
  });
  if (tables.size < 1) err(at, 'a lesson needs at least one table');
  for (const [p, s] of bodyDe) {
    // the tables of the pronunciation lesson show the ae/oe/ue stand-ins on purpose
    germanTextChecks(s, p, { allowStandIns: topicId === 'aussprache-umlaute' });
    if (!/^[-+*/=<>:,.;!?'"()\d\s]*$/.test(s)) levelChecks(s, p, level, topicId);
  }

  // ---- speak
  for (const lang of LANGS) {
    const text = lesson.speak?.[lang];
    const sp = `${at} speak[${lang}]`;
    if (!str(text)) {
      err(sp, 'missing');
      continue;
    }
    const opens = (text.match(/«/g) ?? []).length;
    if (opens === 0) err(sp, 'needs at least one «...» German snippet');
    if (opens !== (text.match(/»/g) ?? []).length) err(sp, 'unbalanced « »');
    if (/[0-9]/.test(text)) err(sp, 'digits not allowed');
    if (/[()]/.test(text)) err(sp, 'parentheses not allowed');
    for (const m of text.matchAll(/«([^»]*)»/g)) germanTextChecks(m[1], sp, { allowStandIns: topicId === 'aussprache-umlaute' });
  }

  // ---- glossary
  for (const g of lesson.glossary ?? []) {
    if (!str(g.word) || !isLang(g.gloss)) err(`${at} glossary`, `entry needs word and gloss en/es: ${JSON.stringify(g).slice(0, 60)}`);
  }

  // ---- items
  const items = lesson.items ?? [];
  const kindOf = (i) => i.kind ?? 'choice';
  const n = { choice: 0, form: 0, why: 0 };
  const ids = new Set();
  const correctPos = [0, 0, 0];
  for (const item of items) {
    const k = kindOf(item);
    if (!(k in n)) {
      err(`${at} item ${item.id}`, `item kind "${k}" is not part of the course (choice, form, why)`);
      continue;
    }
    n[k] += 1;
    const ip = `${at} item ${item.id ?? '?'}`;
    if (!str(item.id)) err(ip, 'missing id');
    else if (ids.has(item.id)) err(ip, 'duplicate id');
    else ids.add(item.id);
    if (str(item.id) && !item.id.startsWith(`${topicId}-`)) warn(ip, `id should start with "${topicId}-"`);

    if (k === 'choice') checkChoice(item, ip, level, topicId, correctPos);
    else if (k === 'form') checkForm(item, ip, level, tables);
    else checkWhy(item, ip, level);
  }
  if (items.length !== 30) err(at, `needs 30 items, has ${items.length}`);
  if (n.choice !== 14) err(at, `needs 14 choice items, has ${n.choice}`);
  if (n.form !== 12) err(at, `needs 12 form items, has ${n.form}`);
  if (n.why !== 4) err(at, `needs 4 why items, has ${n.why}`);
  if (n.choice >= 6 && (Math.max(...correctPos) > 0.55 * n.choice || Math.min(...correctPos) === 0)) {
    warn(at, `correct options are unevenly placed: positions 0/1/2 = ${correctPos.join('/')}`);
  }

  // ---- Hungarian sidecar
  const sidecar = join(huDir, file);
  if (!existsSync(sidecar)) {
    err(at, 'no Hungarian sidecar data/games/grammar-hu/de/' + file);
    return;
  }
  const map = readJson(sidecar);
  const keys = lang4Keys(lesson);
  const present = new Set(keys);
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(map, k)) err(`${at} sidecar`, `no hu text for "${k.slice(0, 70)}"`);
  }
  for (const k of Object.keys(map)) {
    if (!present.has(k)) err(`${at} sidecar`, `stale key "${k.slice(0, 70)}"`);
    const v = map[k];
    if (!str(v)) err(`${at} sidecar`, `empty hu text for "${k.slice(0, 50)}"`);
    else {
      if (v.includes(EM_DASH)) err(`${at} sidecar`, `em dash in hu text for "${k.slice(0, 50)}"`);
      if (v !== v.normalize('NFC')) err(`${at} sidecar`, `hu text not NFC for "${k.slice(0, 50)}"`);
      if (v === k && k.length > 30) warn(`${at} sidecar`, `hu text equals the en text: "${k.slice(0, 50)}"`);
    }
  }
  const speakEn = lesson.speak?.en;
  if (speakEn && map[speakEn]) {
    const hu = map[speakEn];
    if ((hu.match(/«/g) ?? []).length === 0 || (hu.match(/«/g) ?? []).length !== (hu.match(/»/g) ?? []).length) {
      err(`${at} sidecar`, 'hu speak needs balanced «...» German snippets');
    }
    if (/[0-9()]/.test(hu)) err(`${at} sidecar`, 'hu speak: no digits or parentheses');
  }
}

function checkChoice(item, ip, level, topicId, correctPos) {
  const { sentence, options, correct } = item;
  if (!str(sentence)) return err(ip, 'empty sentence');
  if (sentence.split('___').length !== 2) err(ip, 'sentence needs exactly one "___" gap');
  if (!Array.isArray(options) || options.length !== 3) return err(ip, 'needs exactly 3 options');
  if (new Set(options).size !== 3 || !options.every(str)) err(ip, 'options must be 3 distinct non-empty strings');
  if (!Number.isInteger(correct) || correct < 0 || correct > 2) return err(ip, `correct ${correct} out of range`);
  correctPos[correct] += 1;
  if (!isLang(item.why)) err(ip, 'why needs en and es');
  if (!isLang(item.tr)) err(ip, 'tr needs en and es');
  if (!Array.isArray(item.examples) || item.examples.length !== 2 || !item.examples.every(str)) err(ip, 'examples needs 2 German sentences');
  const wrongKeys = Object.keys(item.wrong ?? {});
  options.forEach((opt, i) => {
    if (i === correct) {
      if (item.wrong?.[opt]) err(ip, `wrong[] must not explain the correct option "${opt}"`);
      return;
    }
    const w = item.wrong?.[opt];
    if (!isLang(w)) return err(ip, `wrong[${opt}] needs en and es`);
    for (const l of LANGS) {
      if (w[l].length <= 20) err(ip, `wrong[${opt}].${l} is too short (${w[l].length})`);
      else if (w[l].length < 40) warn(ip, `wrong[${opt}].${l} is short (${w[l].length}): a real sentence explains why`);
    }
  });
  for (const k of wrongKeys) if (!options.includes(k)) err(ip, `wrong[] key "${k}" is not an option`);

  const correctText = options[correct];
  const filled = sentence.replace('___', correctText);
  const rest = sentence.replace('___', ' ');
  if (words(rest).some((w) => w === correctText)) warn(ip, `self-revealing: "${correctText}" is also in the rest of the sentence`);
  if (words(filled).length > 12) warn(ip, `sentence has ${words(filled).length} words (cap 12)`);
  if (!/[.?!]$/.test(filled.trim())) warn(ip, 'sentence does not end with . ? or !');
  if (/^\s*___/.test(sentence)) {
    if (!options.every((o) => caps(o))) warn(ip, 'gap at the sentence start: every option should be capitalised');
  }
  if (!/^[\p{Lu}¿¡"„]/u.test(sentence.trim()) && !/^___/.test(sentence.trim())) warn(ip, 'sentence should start with a capital');
  for (const o of options) germanTextChecks(o, ip, { allowStandIns: topicId === 'aussprache-umlaute' });
  germanTextChecks(sentence, ip, { allowStandIns: topicId === 'aussprache-umlaute' });
  for (const ex of item.examples ?? []) germanTextChecks(ex, ip, { allowStandIns: topicId === 'aussprache-umlaute' });
  if (item.tr?.en && item.tr.en.trim() === filled.trim()) err(ip, 'tr.en equals the German sentence');
  levelChecks(filled, ip, level, topicId);
  for (const ex of item.examples ?? []) levelChecks(ex, ip, level, topicId);
}

function checkForm(item, ip, level, tables) {
  for (const f of ['verb', 'person', 'answer']) if (!str(item[f])) err(ip, `form item needs ${f}`);
  if (item.accept !== undefined && (!Array.isArray(item.accept) || item.accept.includes(item.answer))) err(ip, 'accept must be an array without the answer');
  const table = tables.get(item.table);
  if (!table) return err(ip, `unknown table "${item.table}"`);
  germanTextChecks(item.answer ?? '', ip, { allowStandIns: item.table.includes('umlaut') || item.table.includes('laute') });
  // lookup: row = person, column = the header cell whose `es` equals the verb (single-verb table: column 1)
  const col = table.header.findIndex((h, ci) => ci > 0 && h.es === item.verb);
  const row = table.rows.find((r) => r[0] === item.person);
  const cell = row ? row[col > 0 ? col : 1] : undefined;
  if (cell === undefined) warn(ip, `form item is not a cell of table "${item.table}" (person "${item.person}", verb "${item.verb}")`);
  else if (cell !== item.answer && !(item.accept ?? []).includes(cell)) warn(ip, `answer "${item.answer}" differs from the table cell "${cell}"`);
  levelChecks(item.answer ?? '', ip, level, '');
}

function checkWhy(item, ip, level) {
  if (!str(item.es)) return err(ip, 'why item needs es (the German sentence)');
  if (!isLang(item.tr)) err(ip, 'tr needs en and es');
  germanTextChecks(item.es, ip);
  levelChecks(item.es, ip, level, '');
  if (!str(item.target)) warn(ip, 'why item has no target');
  else if (wholeWord(item.es, item.target) < 0) err(ip, `target "${item.target}" is not a whole word of the sentence`);
  const options = item.options ?? [];
  if (options.length !== 3) return err(ip, 'why item needs 3 options');
  if (!Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex > 2) return err(ip, 'correctIndex out of range');
  if (new Set(options.map((o) => o.text?.en)).size !== 3) err(ip, 'why option texts (en) must be unique');
  options.forEach((o, i) => {
    if (!isLang(o.text)) err(ip, `option ${i} text needs en and es`);
    if (i !== item.correctIndex && !isLang(o.wrong)) err(ip, `option ${i} needs wrong in en and es`);
    if (i === item.correctIndex && o.wrong) err(ip, 'the correct option has a wrong text');
    if (i !== item.correctIndex && isLang(o.wrong)) for (const l of LANGS) if (o.wrong[l].length <= 20) err(ip, `option ${i} wrong.${l} is too short`);
  });
}

for (const f of files) checkLesson(f);

// orphan sidecars
if (existsSync(huDir) && !only) {
  for (const f of readdirSync(huDir).filter((x) => x.endsWith('.json'))) {
    if (!files.includes(f)) err(`grammar-hu/de/${f}`, 'Hungarian sidecar without a lesson');
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------------------------
const total = (syllabus.topics ?? []).length;
console.log(
  `grammar-de-course-check: syllabus ${total} topics (` +
    LEVELS.map((l) => `${l} ${perLevel[l]}`).join(', ') +
    `), ${files.length} lessons written${only ? ` (checked: ${only})` : ''}, ${p1.length} P1, ${p2.length} P2`,
);
if (p1.length) {
  console.log('\n--- P1 (must fix) ---');
  for (const x of p1) console.log(`  [${x.path}] ${x.issue}`);
}
if (p2.length && !quiet) {
  console.log('\n--- P2 (reported) ---');
  for (const x of p2) console.log(`  [${x.path}] ${x.issue}`);
}
process.exit(p1.length ? 1 : 0);
