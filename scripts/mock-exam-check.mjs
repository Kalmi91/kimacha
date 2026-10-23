// Gate for the authored B1-C1 practice-exam papers and the speaking papers of every level (data/exams/mock/<target>-<level>-<paper>.json),
// the content of lib/exam/mock/authored.ts. The schema is AuthoredPaperFile in lib/exam/mock/types.ts; the task order, counts and text
// lengths per paper are PLAN-vizsga-b1c1.md "Feladatrend" (the SPEC tables below), those of the speaking papers
// PLAN-vizsga-szobeli.md "Szintenkénti feladatrend".
//
// Usage:
//   node scripts/mock-exam-check.mjs [--strict] [--photos <registry.json>] [file ...]
//                                                             check the given files (default: all 28 under data/exams/mock);
//                                                             a `*` in a path is expanded here (PowerShell does not);
//                                                             --photos replaces data/exams/mock/photos.json (S5; its photo files then sit next to it)
//   node scripts/mock-exam-check.mjs --blind <file> <out>      write a copy without the answer key (correct / answer / answers;
//                                                             speaking: the content points and the model answers)
//   node scripts/mock-exam-check.mjs --grade <file> <answers>  compare a filled-in copy of the blind export with the key (speaking: the
//                                                             answers file has `{ choice, <turn id>: text }` per task, as an array of the first
//                                                             form's tasks or `{ <form id>: [...] }`; it lists the content points each turn got)
// An empty `forms` list is a warning ("not written yet"), an error with --strict, except in a speaking file (the app keeps its
// placeholder then): a warning always. The last line is the summary, exit 1 on errors.
//
// Rules (every violation is an error):
//   M1  file shape: target / level / paper / forms; in the default run all 18 files exist and their header matches the name
//   M2  form shape: unique id, a task list of exactly the paper's SPEC length
//   M3  task schema per kind (ids unique, `{{n}}` markers once and in order, `correct` in range, answer keys on existing
//       ids, `unique` kept, fragments = gaps + extra, pick = correct.length, audio lines well-formed) and the SPEC of the
//       task (kind, skill, marks, item and option counts, text lengths in the band with 15% tolerance, essay min / max
//       words exactly the official ones)
//   M6  es norm: no vosotros / Spain-only words (blacklist below)
//   M7  no em dash anywhere
//   M8  writing / speaking keywords: no single word under 4 letters (they match as a word start)
// Speaking papers (every rule is an error):
//   S1  a *-speaking.json holds speaking tasks only (kind and skill `speaking`); a speaking task is nowhere else
//   S2  1-3 choices with unique ids; `follows` is the ordinal of an earlier speaking task with the same choice ids
//   S3  turns: at least one, unique ids; ask / model non-empty; minWords > 0; 0-4 content points per turn, 4-12 keywords per point
//       (an open question, "what did you do", needs room for the many verbs a good answer may use)
//   S4  the model answer reaches minWords and gets EVERY point (same scoring as lib/exam/mock/score.ts: folded words, keyword at a word start)
//   S5  every photo key is in photos.json and its file exists
//   S6  choices, prepSeconds, talkMinutes, follows, turns per task and photos per choice are those of the SPEC table
//   S7  word budget: the minWords of the turns (longest choice per task) add up to at most 20 x the paper's minutes
//   S8  no keyword echoes the examiner's question (it would match a word of `ask`): repeating the question must not earn a point

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'data', 'exams', 'mock');

// ---------------------------------------------------------------- SPEC (PLAN "Feladatrend")
// Constructors: one entry per task, in the order of the paper. `words` = [min, max] of the main text (of the audio for a
// recording); the check allows 15% either way. Option counts are per question (`options`) or per pool (`poolOptions`).

const passage = (skill, media, words, questions, options, extra = {}) => ({ kind: 'passage_mc', skill, media, words, questions, options, ...extra });
const clips = (skill, media, count, perClip, options, extra = {}) => ({ kind: 'clips_mc', skill, media, clips: count, perClip, options, ...extra });
const pool = (skill, prompts, poolOptions, unique, extra = {}) => ({ kind: 'match_pool', skill, prompts, poolOptions, unique, ...extra });
const gapped = (skill, words, gaps, fragments, extra = {}) => ({ kind: 'gapped_text', skill, words, gaps, fragments, ...extra });
const cloze = (skill, words, gaps, gapKind, extra = {}) => ({ kind: 'cloze', skill, words, gaps, gapKind, ...extra });
const pick = (skill, words, statements, pickCount) => ({ kind: 'pick_statements', skill, media: 'audio', words, statements, pick: pickCount });
const transform = (skill, items, marks) => ({ kind: 'transform', skill, items, marks });
// `input`: 'text' (a written prompt is needed) or 'audio' (a heard one); `inputWords` the band, `inputMaxWords` an upper limit.
const essay = (choices, minWords, maxWords, extra = {}) => ({ kind: 'essay', skill: 'writing', choices, minWords, maxWords, ...extra });
// Speaking (PLAN-vizsga-szobeli.md "Szintenkénti feladatrend"): `choices`, `prep` (prepSeconds), `talk` (talkMinutes), `turns` (examiner turns
// per choice), `photos` per choice (0 = none), `follows` (ordinal of the task whose choice it continues), `samePhotos` (the photos are the followed choice's).
const speaking = (choices, prep, talk, turns, extra = {}) => ({ kind: 'speaking', skill: 'speaking', choices, prep, talk, turns, photos: 0, ...extra });

const MWF = { speakers: ['m', 'f'], fixedOptions: ['hombre', 'mujer', 'ninguno'] };

const SPEC = {
  'es-b1-reading': [
    pool('reading', 6, 10, true, { promptWords: [20, 30], optionWords: [40, 60] }),
    passage('reading', 'text', [400, 450], 6, 3),
    pool('reading', 6, 3, false, { optionWords: [100, 120] }),
    gapped('reading', [400, 450], 6, 8),
    cloze('reading', [150, 200], 6, 'mc', { options: 3 }),
  ],
  'es-b1-listening': [
    clips('listening', 'audio', 6, 1, 3, { clipWords: [40, 60] }),
    passage('listening', 'audio', [400, 450], 6, 3),
    clips('listening', 'audio', 6, 1, 3, { totalWords: [350, 400] }),
    pool('listening', 6, 9, true, { promptMedia: 'audio', promptWords: [50, 70] }),
    passage('listening', 'audio', [250, 300], 6, 3, MWF),
  ],
  'es-b1-writing': [
    essay(1, 100, 120, { input: 'text', inputWords: [75, 85] }),
    essay(2, 130, 150, { input: 'text', inputWords: [40, 50] }),
  ],
  'es-b2-reading': [
    passage('reading', 'text', [400, 450], 6, 3),
    pool('reading', 10, 4, false, { optionWords: [130, 150] }),
    gapped('reading', [400, 450], 6, 8, { fragmentWords: [15, 20] }),
    cloze('reading', [400, 450], 14, 'mc', { options: 3 }),
  ],
  'es-b2-listening': [
    clips('listening', 'audio', 6, 1, 3, { clipWords: [40, 60] }),
    passage('listening', 'audio', [250, 300], 6, 3, MWF),
    passage('listening', 'audio', [400, 450], 6, 3),
    pool('listening', 6, 9, true, { promptMedia: 'audio', promptWords: [50, 70] }),
    passage('listening', 'audio', [400, 450], 6, 3),
  ],
  'es-b2-writing': [
    essay(1, 150, 180, { input: 'audio', inputWords: [200, 250] }),
    essay(2, 150, 180, { input: 'text', inputWords: [200, 250] }),
  ],
  'es-c1-reading': [
    passage('reading', 'text', [650, 750], 6, 3),
    gapped('reading', [550, 650], 6, 7),
    passage('reading', 'text', [550, 650], 6, 3),
    pool('reading', 8, 6, false, { optionWords: [100, 150] }),
    cloze('reading', [375, 425], 14, 'mc', { options: 3 }),
  ],
  'es-c1-listening': [
    pick('listening', [700, 750], 12, 6),
    clips('listening', 'audio', 4, 2, 3, { clipWords: [220, 300] }),
    passage('listening', 'audio', [750, 900], 6, 3),
    clips('listening', 'audio', 10, 1, 3, { clipWords: [38, 45] }),
  ],
  'es-c1-writing': [
    essay(1, 220, 250, { input: 'audio', inputWords: [700, 800] }),
    essay(2, 180, 220, { input: 'text', inputWords: [100, 200] }),
  ],
  'en-b1-reading': [
    clips('reading', 'text', 5, 1, 3, { clipMaxWords: 40 }),
    pool('reading', 5, 8, true, { optionWords: [40, 60] }),
    passage('reading', 'text', [350, 400], 5, 4),
    gapped('reading', [350, 400], 5, 8),
    cloze('reading', [120, 160], 6, 'mc', { options: 4 }),
    cloze('reading', [120, 160], 6, 'open', { answerWords: [1, 1] }),
  ],
  'en-b1-writing': [essay(1, 80, 120, { input: 'text' }), essay(2, 80, 120)],
  'en-b1-listening': [
    clips('listening', 'audio', 7, 1, 3),
    clips('listening', 'audio', 6, 1, 3),
    cloze('listening', null, 6, 'open', { audioWords: [350, 400], answerWords: [1, 3] }),
    passage('listening', 'audio', [450, 550], 6, 3),
  ],
  'en-b2-readinguse': [
    cloze('use', [150, 180], 8, 'mc', { options: 4 }),
    cloze('use', [150, 180], 8, 'open'),
    cloze('use', [150, 180], 8, 'stem'),
    transform('use', 6, 2),
    passage('reading', 'text', [550, 650], 6, 4, { marks: 2 }),
    gapped('reading', [500, 600], 6, 7, { marks: 2 }),
    pool('reading', 10, [4, 6], false, { totalOptionWords: [500, 650] }),
  ],
  'en-b2-writing': [essay(1, 140, 190, { input: 'text', inputMaxWords: 120 }), essay(3, 140, 190, { input: 'text', inputMaxWords: 70 })],
  'en-b2-listening': [
    clips('listening', 'audio', 8, 1, 3, { clipWords: [70, 90] }),
    cloze('listening', null, 10, 'open', { audioWords: [500, 600] }),
    pool('listening', 5, 8, true, { promptMedia: 'audio', promptWords: [70, 90] }),
    passage('listening', 'audio', [500, 600], 7, 3),
  ],
  'en-c1-readinguse': [
    cloze('use', [150, 180], 8, 'mc', { options: 4 }),
    cloze('use', [150, 180], 8, 'open'),
    cloze('use', [150, 180], 8, 'stem'),
    transform('use', 6, 2),
    passage('reading', 'text', [650, 800], 6, 4, { marks: 2 }),
    // The plan says "4 short texts, 150-180 words": read either per text or as the total of the four.
    pool('reading', 4, 4, false, { marks: 2, optionWordsOrTotal: [150, 180] }),
    gapped('reading', [650, 800], 6, 7, { marks: 2 }),
    pool('reading', 10, [4, 6], false, { totalOptionWords: [550, 700] }),
  ],
  'en-c1-writing': [essay(1, 220, 260, { input: 'text' }), essay(3, 220, 260)],
  'en-c1-listening': [
    clips('listening', 'audio', 3, 2, 3),
    cloze('listening', null, 8, 'open', { audioWords: [450, 550] }),
    passage('listening', 'audio', [550, 650], 6, 4),
    pool('listening', 5, 8, true, { promptMedia: 'audio' }),
    // The same five recordings as the previous task (two tasks on one set of monologues).
    pool('listening', 5, 8, true, { promptMedia: 'audio', sameAudioAs: 4 }),
  ],
  // es speaking: the DELE-like individual oral (⚠ A1 / A2: from a search summary, the guide was not available on 2026-10-22).
  'es-a1-speaking': [
    speaking(1, 0, [1, 2], 1),
    speaking(2, 600, [2, 3], 1),
    speaking(2, 0, [3, 4], 5, { follows: 2 }),
  ],
  'es-a2-speaking': [
    speaking(2, 360, [2, 3], 1),
    speaking(2, 360, [2, 3], 3, { photos: 1 }),
    speaking(2, 0, [3, 4], 5, { follows: 2, photos: 1, samePhotos: true }),
  ],
  'es-b1-speaking': [
    speaking(2, 900, [2, 3], 1),
    speaking(2, 0, [3, 4], 5, { follows: 1 }),
    speaking(2, 0, [2, 3], 2, { photos: 1 }),
    speaking(2, 0, [2, 3], 4, { follows: 3, photos: 1, samePhotos: true }),
  ],
  'es-b2-speaking': [
    speaking(2, 600, [6, 7], 3),
    speaking(2, 600, [5, 6], 3, { photos: 1 }),
    speaking(2, 0, [3, 4], 4),
  ],
  'es-c1-speaking': [
    speaking(2, 1200, [3, 5], 1),
    speaking(2, 0, [4, 6], 4, { follows: 1 }),
    speaking(2, 0, [4, 6], 4),
  ],
  // en speaking: Cambridge-like; the paired parts are led by the examiner (the app) for one learner.
  'en-a1-speaking': [
    speaking(2, 0, [2, 2], 4, { photos: 1 }),
    speaking(2, 15, [1, 2], 4),
  ],
  'en-a2-speaking': [
    speaking(1, 0, [3, 4], 5),
    speaking(1, 0, [5, 6], 5),
  ],
  'en-b1-speaking': [
    speaking(1, 0, [2, 2], 4),
    speaking(2, 0, [1, 1], 1, { photos: 1 }),
    speaking(1, 0, [3, 4], 2),
    speaking(1, 0, [3, 3], 4),
  ],
  'en-b2-speaking': [
    speaking(1, 0, [2, 2], 3),
    speaking(1, 0, [1, 1], 2, { photos: 2 }),
    speaking(1, 0, [3, 4], 2),
    speaking(1, 0, [4, 4], 3),
  ],
  'en-c1-speaking': [
    speaking(1, 0, [2, 2], 2),
    speaking(1, 0, [1, 1], 2, { photos: 3 }),
    speaking(1, 0, [3, 4], 2),
    speaking(1, 0, [5, 5], 3),
  ],
};

// S7: the minutes of the speaking papers (lib/exam/mock/blueprint.ts) and the words a learner can type / dictate per minute.
const SPEAKING_MINUTES = { 'es-a1': 10, 'es-a2': 12, 'es-b1': 15, 'es-b2': 20, 'es-c1': 20, 'en-a1': 3.5, 'en-a2': 9, 'en-b1': 12, 'en-b2': 14, 'en-c1': 15 };
const WORDS_PER_MINUTE = 20;

const EXPECTED_FILES = Object.keys(SPEC).map((name) => `${name}.json`);

// es norm (PLAN "Norma (es)"): Mexican usage, no vosotros, no Spain-only words. Patterns as in the plan.
// JS \b treats accented letters as non-word characters ("años" would hit `os`), so the edges are Unicode-aware.
const ES_BLACKLIST = [/vosotr/iu, /(?<!\p{L})coche/iu, /(?<!\p{L})ordenador/iu, /(?<!\p{L})zumo(?!\p{L})/iu, /(?<!\p{L})móvil(?!\p{L})/iu, /(?<!\p{L})os(?!\p{L})/iu];
const EM_DASH = /[\u2014\u2013]/;

const TOLERANCE = 0.15;
const SKILLS = ['reading', 'use', 'listening', 'writing', 'speaking'];
const SPEAKERS = ['m', 'f', 'n'];
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

// S5: the photo registry (PLAN-vizsga-szobeli.md "Fotók") and the folder of the photo files.
const PHOTOS_JSON = path.join(DIR, 'photos.json');
const PHOTO_DIR = path.join(ROOT, 'assets', 'exam-photos');

// ---------------------------------------------------------------- helpers

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isInt = (v) => Number.isInteger(v);
const countWords = (s) => (typeof s === 'string' && s.trim() !== '' ? s.trim().split(/\s+/).length : 0);
const inBand = (n, [lo, hi]) => n >= lo * (1 - TOLERANCE) && n <= hi * (1 + TOLERANCE);
const bandText = ([lo, hi]) => `${lo}-${hi} (+-15%)`;
const audioWords = (lines) => (Array.isArray(lines) ? lines.reduce((n, l) => n + countWords(l && l.text), 0) : 0);
const unique = (list) => new Set(list).size === list.length;
const markersOf = (text) => [...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
const loose = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Mirrors of the app's scoring of a written / dictated text, so that S4 and --grade give the points the app gives: fold, foldedTokens,
// isNonsenseToken and assessMessage (without the dictionary) of lib/exam/mock/writing.ts, keywordHit of lib/exam/mock/score.ts. Keep them in step.
const fold = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
const foldedTokens = (text) => fold(text).replace(/[^a-z'\s]/g, ' ').split(/\s+/).map((t) => t.replace(/^'+|'+$/g, '')).filter(Boolean);
const COPY_RUN = 5;
const MIN_DISTINCT_RATIO = 0.5;
const KEY_RUNS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].flatMap((row) => {
  const out = [];
  for (let i = 0; i + 4 <= row.length; i++) {
    const run = row.slice(i, i + 4);
    out.push(run, [...run].reverse().join(''));
  }
  return out;
});
const isNonsenseToken = (tok) => (tok.length >= 3 && !/[aeiouy]/.test(tok)) || /([a-z])\1{3,}/.test(tok) || /[^aeiouy']{6,}/.test(tok) || KEY_RUNS.some((run) => tok.includes(run));

function assessText(text, reference) {
  const tokens = foldedTokens(text);
  const ref = foldedTokens(reference.join(' '));
  const refRuns = new Set();
  for (let i = 0; i + COPY_RUN <= ref.length; i++) refRuns.add(ref.slice(i, i + COPY_RUN).join(' '));
  const copied = new Array(tokens.length).fill(false);
  for (let i = 0; i + COPY_RUN <= tokens.length; i++) {
    if (refRuns.has(tokens.slice(i, i + COPY_RUN).join(' '))) for (let k = i; k < i + COPY_RUN; k++) copied[k] = true;
  }
  const kept = tokens.filter((tok, i) => !copied[i] && !isNonsenseToken(tok));
  const distinctOk = kept.length < 6 || new Set(kept).size / kept.length >= MIN_DISTINCT_RATIO;
  return { words: kept.length, valid: kept.length > 0 && distinctOk, text: kept.join(' ') };
}

// English contractions match their full form both ways ("i'm" = "i am", "don't" = "do not"), as in score.ts.
const CONTRACTIONS = [
  [/\bwon't\b/g, 'will not'],
  [/\bcan't\b/g, 'can not'],
  [/\bcannot\b/g, 'can not'],
  [/n't\b/g, ' not'],
  [/'m\b/g, ' am'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will'],
  [/'d\b/g, ' would'],
];
const expandContractions = (text) => CONTRACTIONS.reduce((s, [re, full]) => s.replace(re, full), text);

function keywordHit(kw, words, raw) {
  const k = expandContractions(fold(kw));
  return /[a-z0-9]/.test(k) ? ` ${expandContractions(words)}`.includes(` ${k}`) : raw.includes(k);
}

/** One speaking turn scored like lib/exam/mock/score.ts: { words, hits (per content point), countOk (the word-count mark) }. */
function scoreTurn(task, choice, turn, text) {
  const a = assessText(text, [task.instruction, choice.prompt, ...(choice.bullets ?? []), choice.input ?? '', turn.ask]);
  const enough = a.valid && a.words >= Math.ceil(turn.minWords / 2);
  const raw = fold(text);
  return { words: a.valid ? a.words : 0, hits: turn.points.map((p) => enough && p.keywords.some((kw) => keywordHit(kw, a.text, raw))), countOk: a.valid && a.words >= turn.minWords };
}

/** All string values of a value, with their JSON path. */
function* strings(value, at = '') {
  if (typeof value === 'string') yield [at, value];
  else if (Array.isArray(value)) for (let i = 0; i < value.length; i++) yield* strings(value[i], `${at}[${i}]`);
  else if (isObj(value)) for (const [k, v] of Object.entries(value)) yield* strings(v, at ? `${at}.${k}` : k);
}

// ---------------------------------------------------------------- schema + SPEC per kind
// Each checker gets the task, its SPEC entry (or null if the kind is wrong or there is no SPEC) and `err(message)`.

function checkAudio(lines, err, at) {
  if (!Array.isArray(lines) || lines.length === 0) return err(`${at}: a non-empty list of { speaker?, text } lines is needed`);
  lines.forEach((l, i) => {
    if (!isObj(l) || !isStr(l.text)) err(`${at}[${i}]: text must be a non-empty string`);
    else if (l.speaker !== undefined && !SPEAKERS.includes(l.speaker)) err(`${at}[${i}]: speaker "${l.speaker}" is not m, f or n`);
  });
}

function checkMc(q, err, at, options) {
  if (!isObj(q)) return err(`${at}: not an object`);
  if (!isStr(q.stem)) err(`${at}: stem must be a non-empty string`);
  if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every(isStr)) return err(`${at}: options must be a list of at least 2 non-empty strings`);
  if (!unique(q.options.map((o) => o.trim().toLowerCase()))) err(`${at}: two options are the same`);
  if (!isInt(q.correct) || q.correct < 0 || q.correct >= q.options.length) err(`${at}: correct (${q.correct}) is not an index of the ${q.options.length} options`);
  if (options !== undefined && q.options.length !== options) err(`${at}: ${q.options.length} options, the format wants ${options}`);
}

/** Exactly one of `text` / `audio` (the source of a passage or a clip); `media` from the SPEC says which one. */
function checkSource(obj, err, at, media) {
  const hasText = obj.text !== undefined;
  const hasAudio = obj.audio !== undefined;
  if (hasText === hasAudio) return err(`${at}: exactly one of text / audio is needed`);
  if (hasText && !isStr(obj.text)) err(`${at}: text must be a non-empty string`);
  if (hasAudio) checkAudio(obj.audio, err, `${at}.audio`);
  if (media === 'text' && !hasText) err(`${at}: a written text is needed here, not a recording`);
  if (media === 'audio' && !hasAudio) err(`${at}: a recording is needed here, not a written text`);
}

const sourceWords = (obj) => (obj.text !== undefined ? countWords(obj.text) : audioWords(obj.audio));

function checkMarkers(text, err, at, gaps) {
  if (!isStr(text)) return err(`${at}: text must be a non-empty string`);
  const found = markersOf(text);
  const want = Array.from({ length: found.length }, (_, i) => i + 1);
  if (found.length === 0 || found.some((n, i) => n !== want[i])) err(`${at}: the {{n}} markers must be {{1}}..{{n}} once each and in order (found ${found.map((n) => `{{${n}}}`).join(' ') || 'none'})`);
  else if (gaps !== undefined && found.length !== gaps) err(`${at}: ${found.length} markers but ${gaps} gaps/answers`);
  return found.length;
}

function checkBand(n, band, err, at, what) {
  if (band && !inBand(n, band)) err(`${at}: ${what} is ${n} words, the format wants ${bandText(band)}`);
}

// M8: the keyword matches as a word start (lib/exam/mock/score.ts keywordHit), so a short single word ("es", "bus",
// "hi") starts many unrelated words and gives the point for free. Phrases and punctuation-only keywords are fine.
function checkM8(keywords, err, at) {
  for (const kw of keywords.filter(isStr)) {
    const letters = kw.trim().replace(/[^\p{L}\p{N}]/gu, '');
    if (!/\s/.test(kw.trim()) && letters.length > 0 && letters.length < 4) err(`M8: ${at}: keyword "${kw}" is a single word under 4 letters (use a longer word or a phrase)`);
  }
}

const KINDS = {
  passage_mc(t, s, err) {
    checkSource(t, err, 'passage', s && s.media);
    if (t.title !== undefined && !isStr(t.title)) err('title must be a non-empty string');
    if (!Array.isArray(t.questions) || t.questions.length === 0) return err('questions must be a non-empty list');
    t.questions.forEach((q, i) => checkMc(q, err, `questions[${i}]`, s && s.options));
    if (!s) return;
    if (t.questions.length !== s.questions) err(`${t.questions.length} questions, the format wants ${s.questions}`);
    checkBand(sourceWords(t), s.words, err, 'passage', 'the passage');
    if (s.speakers && Array.isArray(t.audio)) {
      const said = new Set(t.audio.map((l) => l && l.speaker));
      for (const sp of s.speakers) if (!said.has(sp)) err(`the dialogue needs lines of speaker "${sp}" (m + f)`);
    }
    if (s.fixedOptions) {
      const want = [...s.fixedOptions].sort().join('|');
      t.questions.forEach((q, i) => {
        if (Array.isArray(q.options) && q.options.map((o) => String(o).trim().toLowerCase()).sort().join('|') !== want) err(`questions[${i}]: the options must be ${s.fixedOptions.join(' / ')}`);
      });
    }
  },
  clips_mc(t, s, err) {
    if (!Array.isArray(t.clips) || t.clips.length === 0) return err('clips must be a non-empty list');
    let total = 0;
    t.clips.forEach((c, i) => {
      const at = `clips[${i}]`;
      if (!isObj(c)) return err(`${at}: not an object`);
      checkSource(c, err, at, s && s.media);
      if (!Array.isArray(c.questions) || c.questions.length === 0) return err(`${at}: questions must be a non-empty list`);
      c.questions.forEach((q, k) => checkMc(q, err, `${at}.questions[${k}]`, s && s.options));
      const n = sourceWords(c);
      total += n;
      if (!s) return;
      if (c.questions.length !== s.perClip) err(`${at}: ${c.questions.length} questions, the format wants ${s.perClip} per clip`);
      checkBand(n, s.clipWords, err, at, 'the clip');
      if (s.clipMaxWords && n > s.clipMaxWords * (1 + TOLERANCE)) err(`${at}: the clip is ${n} words, the format wants at most ${s.clipMaxWords} (+15%)`);
    });
    if (!s) return;
    if (t.clips.length !== s.clips) err(`${t.clips.length} clips, the format wants ${s.clips}`);
    checkBand(total, s.totalWords, err, 'clips', 'all the clips together');
  },
  match_pool(t, s, err) {
    if (!Array.isArray(t.prompts) || t.prompts.length === 0) return err('prompts must be a non-empty list');
    if (!Array.isArray(t.options) || t.options.length === 0) return err('options must be a non-empty list');
    if (typeof t.unique !== 'boolean') err('unique must be true or false');
    const promptIds = t.prompts.map((p) => p && p.id);
    const optionIds = t.options.map((o) => o && o.id);
    if (!promptIds.every(isStr) || !unique(promptIds)) err('prompt ids must be unique non-empty strings');
    if (!optionIds.every(isStr) || !unique(optionIds)) err('option ids must be unique non-empty strings');
    t.prompts.forEach((p, i) => {
      const at = `prompts[${i}]`;
      if (!isObj(p)) return err(`${at}: not an object`);
      if (p.text === undefined && p.audio === undefined) err(`${at}: text or audio is needed`);
      if (p.text !== undefined && !isStr(p.text)) err(`${at}: text must be a non-empty string`);
      if (p.audio !== undefined) checkAudio(p.audio, err, `${at}.audio`);
      if (s) {
        const media = s.promptMedia || 'text';
        if (media === 'audio' && p.audio === undefined) err(`${at}: a recording is needed here`);
        if (media === 'text' && p.text === undefined) err(`${at}: a written text is needed here`);
        checkBand(p.audio !== undefined ? audioWords(p.audio) : countWords(p.text), s.promptWords, err, at, 'the prompt');
      }
    });
    t.options.forEach((o, i) => {
      if (!isObj(o) || !isStr(o.text)) err(`options[${i}]: text must be a non-empty string`);
      else if (o.title !== undefined && !isStr(o.title)) err(`options[${i}]: title must be a non-empty string`);
    });
    if (!isObj(t.answer)) err('answer must be an object (prompt id -> option id)');
    else {
      const keys = Object.keys(t.answer);
      if (keys.length !== promptIds.length || !promptIds.every((id) => keys.includes(id))) err('answer must have exactly one entry per prompt id');
      for (const k of keys) if (!optionIds.includes(t.answer[k])) err(`answer["${k}"] = "${t.answer[k]}" is not an option id`);
      if (t.unique === true && !unique(Object.values(t.answer))) err('unique is true but an option is the answer of more than one prompt');
    }
    if (!s) return;
    if (t.unique !== s.unique) err(`unique is ${t.unique}, the format wants ${s.unique}`);
    if (t.prompts.length !== s.prompts) err(`${t.prompts.length} prompts, the format wants ${s.prompts}`);
    const want = s.poolOptions;
    const okCount = Array.isArray(want) ? t.options.length >= want[0] && t.options.length <= want[1] : t.options.length === want;
    if (!okCount) err(`${t.options.length} options, the format wants ${Array.isArray(want) ? want.join('-') : want}`);
    const lens = t.options.map((o) => countWords(o && o.text));
    const sum = lens.reduce((a, b) => a + b, 0);
    if (s.optionWords) lens.forEach((n, i) => checkBand(n, s.optionWords, err, `options[${i}]`, 'the option text'));
    checkBand(sum, s.totalOptionWords, err, 'options', 'all the option texts together');
    if (s.optionWordsOrTotal && !(lens.every((n) => inBand(n, s.optionWordsOrTotal)) || inBand(sum, s.optionWordsOrTotal))) {
      err(`the option texts are ${lens.join('/')} words (${sum} together), the format wants ${bandText(s.optionWordsOrTotal)} each or together`);
    }
  },
  gapped_text(t, s, err) {
    if (t.title !== undefined && !isStr(t.title)) err('title must be a non-empty string');
    const n = checkMarkers(t.text, err, 'text', isObj(t.answer) ? Object.keys(t.answer).length : undefined);
    if (!Array.isArray(t.fragments) || t.fragments.length === 0) return err('fragments must be a non-empty list');
    const ids = t.fragments.map((f) => f && f.id);
    if (!ids.every(isStr) || !unique(ids)) err('fragment ids must be unique non-empty strings');
    t.fragments.forEach((f, i) => {
      if (!isObj(f) || !isStr(f.text)) err(`fragments[${i}]: text must be a non-empty string`);
      else if (s && s.fragmentWords) checkBand(countWords(f.text), s.fragmentWords, err, `fragments[${i}]`, 'the fragment');
    });
    if (!isObj(t.answer)) return err('answer must be an object (gap number -> fragment id)');
    const keys = Object.keys(t.answer);
    if (n && (keys.length !== n || !keys.every((k, i) => keys.includes(String(i + 1))))) err(`answer must have the keys "1".."${n}"`);
    for (const k of keys) if (!ids.includes(t.answer[k])) err(`answer["${k}"] = "${t.answer[k]}" is not a fragment id`);
    if (!unique(Object.values(t.answer))) err('a fragment is the answer of more than one gap');
    if (n && t.fragments.length < n) err(`${t.fragments.length} fragments for ${n} gaps: the fragments are the gaps plus extra ones`);
    if (!s) return;
    if (n !== s.gaps) err(`${n} gaps, the format wants ${s.gaps}`);
    if (t.fragments.length !== s.fragments) err(`${t.fragments.length} fragments, the format wants ${s.fragments}`);
    checkBand(countWords(t.text), s.words, err, 'text', 'the text');
  },
  cloze(t, s, err) {
    if (t.title !== undefined && !isStr(t.title)) err('title must be a non-empty string');
    if (!Array.isArray(t.gaps) || t.gaps.length === 0) return err('gaps must be a non-empty list');
    checkMarkers(t.text, err, 'text', t.gaps.length);
    if (t.audio !== undefined) checkAudio(t.audio, err, 'audio');
    t.gaps.forEach((g, i) => {
      const at = `gaps[${i}]`;
      if (!isObj(g)) return err(`${at}: not an object`);
      if ('options' in g) {
        if ('answers' in g || 'stem' in g) err(`${at}: a multiple-choice gap has options + correct only`);
        checkMc({ stem: 'gap', options: g.options, correct: g.correct }, err, at, s && s.gapKind === 'mc' ? s.options : undefined);
      } else {
        if (!Array.isArray(g.answers) || g.answers.length === 0 || !g.answers.every(isStr)) err(`${at}: answers must be a non-empty list of non-empty strings`);
        else if (s && s.answerWords) {
          for (const a of g.answers) if (countWords(a) < s.answerWords[0] || countWords(a) > s.answerWords[1]) err(`${at}: answer "${a}" is not ${s.answerWords[0] === s.answerWords[1] ? s.answerWords[0] : s.answerWords.join('-')} word(s)`);
        }
        if (g.stem !== undefined && !isStr(g.stem)) err(`${at}: stem must be a non-empty string`);
        if ('correct' in g) err(`${at}: an open gap has answers (+ stem), not correct`);
      }
    });
    if (!s) return;
    if (t.gaps.length !== s.gaps) err(`${t.gaps.length} gaps, the format wants ${s.gaps}`);
    t.gaps.forEach((g, i) => {
      if (!isObj(g)) return;
      const mc = 'options' in g;
      if (s.gapKind === 'mc' && !mc) err(`gaps[${i}]: a multiple-choice gap is needed here`);
      if (s.gapKind !== 'mc' && mc) err(`gaps[${i}]: an open gap is needed here`);
      if (s.gapKind === 'stem' && !mc && g.stem === undefined) err(`gaps[${i}]: a word-formation gap needs a stem`);
      if (s.gapKind === 'open' && !mc && g.stem !== undefined) err(`gaps[${i}]: this open gap has no stem`);
    });
    if (s.audioWords) {
      if (t.audio === undefined) err('a recording is needed here');
      else checkBand(audioWords(t.audio), s.audioWords, err, 'audio', 'the recording');
    } else if (t.audio !== undefined) err('this gap-fill is read, it has no recording');
    if (s.words) checkBand(countWords(t.text), s.words, err, 'text', 'the text');
  },
  pick_statements(t, s, err) {
    checkSource(t, err, 'source', s && s.media);
    if (!Array.isArray(t.statements) || t.statements.length === 0 || !t.statements.every(isStr)) return err('statements must be a non-empty list of non-empty strings');
    if (!Array.isArray(t.correct) || !t.correct.every((i) => isInt(i) && i >= 0 && i < t.statements.length)) err('correct must be a list of statement indices');
    else if (!unique(t.correct)) err('correct has a repeated index');
    if (!isInt(t.pick) || (Array.isArray(t.correct) && t.pick !== t.correct.length)) err(`pick (${t.pick}) must equal correct.length (${Array.isArray(t.correct) ? t.correct.length : '?'})`);
    if (!s) return;
    if (t.statements.length !== s.statements) err(`${t.statements.length} statements, the format wants ${s.statements}`);
    if (t.pick !== s.pick) err(`pick is ${t.pick}, the format wants ${s.pick}`);
    checkBand(sourceWords(t), s.words, err, 'source', 'the recording');
  },
  transform(t, s, err) {
    if (!Array.isArray(t.items) || t.items.length === 0) return err('items must be a non-empty list');
    t.items.forEach((it, i) => {
      const at = `items[${i}]`;
      if (!isObj(it)) return err(`${at}: not an object`);
      if (!isStr(it.first) || !isStr(it.key)) err(`${at}: first and key must be non-empty strings`);
      if (typeof it.before !== 'string' || typeof it.after !== 'string' || (it.before.trim() === '' && it.after.trim() === '')) err(`${at}: before / after must be strings and not both empty`);
      if (!Array.isArray(it.answers) || it.answers.length === 0 || !it.answers.every(isStr)) err(`${at}: answers must be a non-empty list of non-empty strings`);
    });
    if (s && t.items.length !== s.items) err(`${t.items.length} items, the format wants ${s.items}`);
  },
  essay(t, s, err) {
    if (!Array.isArray(t.choices) || t.choices.length === 0 || t.choices.length > 3) return err('choices must be a list of 1-3 choices');
    const ids = t.choices.map((c) => c && c.id);
    if (!ids.every(isStr) || !unique(ids)) err('choice ids must be unique non-empty strings');
    t.choices.forEach((c, i) => {
      const at = `choices[${i}]`;
      if (!isObj(c)) return err(`${at}: not an object`);
      if (!isStr(c.title) || !isStr(c.prompt)) err(`${at}: title and prompt must be non-empty strings`);
      if (c.input !== undefined && !isStr(c.input)) err(`${at}: input must be a non-empty string`);
      if (c.audio !== undefined) checkAudio(c.audio, err, `${at}.audio`);
      if (!isInt(c.minWords) || !isInt(c.maxWords) || c.minWords < 1 || c.minWords >= c.maxWords) err(`${at}: minWords / maxWords must be integers with 1 <= min < max`);
      if (!Array.isArray(c.points) || c.points.length === 0) err(`${at}: points must be a non-empty list of content points`);
      else {
        if (!c.points.every((p) => isObj(p) && isStr(p.id) && isStr(p.label)) || !unique(c.points.map((p) => p.id))) err(`${at}: every point needs a unique id and a label`);
        c.points.forEach((p, k) => {
          if (isObj(p) && (!Array.isArray(p.keywords) || p.keywords.length === 0 || !p.keywords.every(isStr))) err(`${at}.points[${k}]: keywords must be a non-empty list of non-empty strings`);
          if (isObj(p) && Array.isArray(p.keywords)) checkM8(p.keywords, err, `${at}.points[${k}]`);
        });
      }
      if (!s) return;
      if (c.minWords !== s.minWords || c.maxWords !== s.maxWords) err(`${at}: ${c.minWords}-${c.maxWords} words, the official limits are ${s.minWords}-${s.maxWords}`);
      if (s.input === 'text' && c.input === undefined) err(`${at}: a written input is needed here`);
      if (s.input === 'audio' && c.audio === undefined) err(`${at}: a recorded input is needed here`);
      if (s.inputWords) checkBand(c.audio !== undefined && s.input === 'audio' ? audioWords(c.audio) : countWords(c.input), s.inputWords, err, at, 'the input');
      if (s.inputMaxWords && countWords(c.input) > s.inputMaxWords * (1 + TOLERANCE)) err(`${at}: the input is ${countWords(c.input)} words, the format wants at most ${s.inputMaxWords} (+15%)`);
    });
    if (s && t.choices.length !== s.choices) err(`${t.choices.length} choices, the format wants ${s.choices}`);
  },
  // `ctx`: { tasks (the form's), index (of this task), photos (S5 lookup) }.
  speaking(t, s, err, ctx) {
    if (t.prepSeconds !== undefined && (!isInt(t.prepSeconds) || t.prepSeconds < 0)) err('prepSeconds must be a non-negative integer (seconds)');
    if (!Array.isArray(t.talkMinutes) || t.talkMinutes.length !== 2 || !t.talkMinutes.every((n) => typeof n === 'number' && n > 0) || t.talkMinutes[0] > t.talkMinutes[1]) err('talkMinutes must be [min, max] minutes with 0 < min <= max');
    if (!Array.isArray(t.choices) || t.choices.length < 1 || t.choices.length > 3) return err('S2: choices must be a list of 1-3 choices');
    const ids = t.choices.map((c) => c && c.id);
    if (!ids.every(isStr) || !unique(ids)) err('S2: choice ids must be unique non-empty strings');
    let followed = null; // the task whose choice this one continues (S2, S6)
    if (t.follows !== undefined) {
      const own = ctx.index + 1;
      if (!isInt(t.follows) || t.follows < 1 || t.follows >= own) err(`S2: follows (${t.follows}) must be the ordinal of an earlier task (1..${own - 1})`);
      else if (!isObj(ctx.tasks[t.follows - 1]) || ctx.tasks[t.follows - 1].kind !== 'speaking' || !Array.isArray(ctx.tasks[t.follows - 1].choices)) err(`S2: follows ${t.follows} is not a speaking task`);
      else {
        followed = ctx.tasks[t.follows - 1];
        const otherIds = followed.choices.map((c) => c && c.id);
        if (!sameJson([...otherIds].sort(), [...ids].sort())) err(`S2: follows ${t.follows}: the choice ids (${ids.join(', ')}) differ from the followed task's (${otherIds.join(', ')})`);
      }
    }
    t.choices.forEach((c, i) => {
      const at = `choices[${i}]`;
      if (!isObj(c)) return err(`${at}: not an object`);
      if (!isStr(c.title) || !isStr(c.prompt)) err(`${at}: title and prompt must be non-empty strings`);
      if (c.bullets !== undefined && (!Array.isArray(c.bullets) || c.bullets.length === 0 || !c.bullets.every(isStr))) err(`${at}: bullets must be a non-empty list of non-empty strings`);
      if (c.input !== undefined && !isStr(c.input)) err(`${at}: input must be a non-empty string`);
      if (c.photos !== undefined) {
        if (!Array.isArray(c.photos) || c.photos.length === 0 || !c.photos.every(isStr) || !unique(c.photos)) err(`${at}: photos must be a non-empty list of unique photo keys`);
        else {
          for (const key of c.photos) {
            const problem = ctx.photos(key);
            if (problem) err(`S5: ${at}: photo "${key}" ${problem}`);
          }
        }
      }
      if (!Array.isArray(c.turns) || c.turns.length === 0) return err(`S3: ${at}: turns must be a non-empty list`);
      const turnIds = c.turns.map((x) => x && x.id);
      if (!turnIds.every(isStr) || !unique(turnIds)) err(`S3: ${at}: turn ids must be unique non-empty strings`);
      c.turns.forEach((turn, k) => {
        const tat = `${at}.turns[${k}]`;
        if (!isObj(turn)) return err(`S3: ${tat}: not an object`);
        let sound = true; // the turn is well-formed enough to be scored (S4)
        const bad = (msg) => {
          err(msg);
          sound = false;
        };
        if (!isStr(turn.ask) || !isStr(turn.model)) bad(`S3: ${tat}: ask and model must be non-empty strings`);
        if (!isInt(turn.minWords) || turn.minWords < 1) bad(`S3: ${tat}: minWords must be a positive integer`);
        if (!Array.isArray(turn.points) || turn.points.length > 4) bad(`S3: ${tat}: points must be a list of 0-4 content points`);
        else {
          if (!turn.points.every((p) => isObj(p) && isStr(p.id) && isStr(p.label)) || !unique(turn.points.map((p) => p && p.id))) bad(`S3: ${tat}: every point needs a unique id and a label`);
          turn.points.forEach((p, m) => {
            if (!isObj(p)) return;
            if (!Array.isArray(p.keywords) || p.keywords.length < 4 || p.keywords.length > 12 || !p.keywords.every(isStr)) bad(`S3: ${tat}.points[${m}]: keywords must be a list of 4-12 non-empty strings`);
            else {
              checkM8(p.keywords, err, `${tat}.points[${m}]`);
              if (isStr(turn.ask)) {
                const askWords = foldedTokens(turn.ask).join(' ');
                for (const kw of p.keywords.filter((kw) => keywordHit(kw, askWords, fold(turn.ask)))) err(`S8: ${tat}.points[${m}]: keyword "${kw}" is in the question itself`);
              }
            }
          });
        }
        if (!sound) return;
        const r = scoreTurn(t, c, turn, turn.model);
        if (!r.countOk) err(`S4: ${tat}: the model answer has ${r.words} meaningful words, minWords is ${turn.minWords}`);
        r.hits.forEach((hit, m) => {
          if (!hit) err(`S4: ${tat}.points[${m}] "${turn.points[m].id}": the model answer gets no point here (none of its keywords is in it)`);
        });
      });
      if (!s) return;
      if (c.turns.length !== s.turns) err(`S6: ${at}: ${c.turns.length} turns, the format wants ${s.turns}`);
      if ((Array.isArray(c.photos) ? c.photos.length : 0) !== s.photos) err(`S6: ${at}: ${Array.isArray(c.photos) ? c.photos.length : 0} photos, the format wants ${s.photos}`);
      if (s.samePhotos && followed) {
        const other = Array.isArray(followed.choices) ? followed.choices.find((x) => isObj(x) && x.id === c.id) : null;
        if (!other || !sameJson(other.photos, c.photos)) err(`S6: ${at}: the photos must be those of the same choice of task ${t.follows}`);
      }
    });
    if (!s) return;
    if (t.choices.length !== s.choices) err(`S6: ${t.choices.length} choices, the format wants ${s.choices}`);
    if ((t.prepSeconds ?? 0) !== s.prep) err(`S6: prepSeconds ${t.prepSeconds ?? 0}, the format wants ${s.prep}`);
    if (!sameJson(t.talkMinutes, s.talk)) err(`S6: talkMinutes ${JSON.stringify(t.talkMinutes)}, the format wants ${JSON.stringify(s.talk)}`);
    if (t.follows !== s.follows) err(`S6: follows ${t.follows ?? 'nothing'}, the format wants ${s.follows ?? 'nothing'}`);
  },
};

/** `ctx`: { speakingFile, tasks (the form's), index (of the task), photos (S5 lookup) }. */
function checkTask(t, spec, err, ctx) {
  if (!isObj(t)) return err('not an object');
  if (!isStr(t.instruction)) err('instruction must be a non-empty string');
  if (!SKILLS.includes(t.skill)) err(`skill "${t.skill}" must be one of ${SKILLS.join(', ')}`);
  // S1: a speaking file holds speaking tasks only, and a speaking task is nowhere else.
  if (ctx.speakingFile) {
    if (t.kind !== 'speaking') return err(`S1: a speaking file holds kind "speaking" tasks only, not "${t.kind}"`);
    if (t.skill !== 'speaking') err(`S1: skill "${t.skill}", a speaking file holds skill "speaking" tasks only`);
  } else if (t.kind === 'speaking' || t.skill === 'speaking') return err('S1: a speaking task belongs in a *-speaking.json file');
  if (t.marks !== undefined && (!isInt(t.marks) || t.marks < 1)) err('marks must be a positive integer');
  if (t.plays !== undefined && (!isInt(t.plays) || t.plays < 1)) err('plays must be a positive integer');
  const check = KINDS[t.kind];
  if (!check) return err(`unknown kind "${t.kind}"`);
  let s = null;
  if (spec) {
    if (t.kind !== spec.kind) err(`kind "${t.kind}", the format wants "${spec.kind}"`);
    else s = spec;
    if (t.skill !== spec.skill) err(`skill "${t.skill}", the format wants "${spec.skill}"`);
    if ((t.marks ?? 1) !== (spec.marks ?? 1)) err(`marks ${t.marks ?? 1}, the format wants ${spec.marks ?? 1}`);
  }
  check(t, s, err, ctx);
}

// ---------------------------------------------------------------- one file

let defaultPhotos = null;
/** The S5 lookup of the real registry, read once and only when a photo is checked. */
const registryPhotos = (key) => (defaultPhotos ??= photoLookup())(key);

/**
 * S5: key -> a problem text (or null when the photo is fine) from the photo registry (photos.json: { <key>: { file, ... } }); the file is
 * looked up in `assetsDir` (and from the repo root, for a path-like `file`), by its `file` name or as `<key>.jpg`.
 */
function photoLookup(registryFile = PHOTOS_JSON, assetsDir = PHOTO_DIR) {
  let registry = null;
  if (fs.existsSync(registryFile)) {
    try {
      registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
    } catch {
      registry = undefined;
    }
  }
  return (key) => {
    if (registry === null) return `cannot be checked: ${path.basename(registryFile)} does not exist yet`;
    if (!isObj(registry)) return `cannot be checked: ${path.basename(registryFile)} is not a JSON object`;
    const entry = registry[key];
    if (entry === undefined) return `is not in ${path.basename(registryFile)}`;
    const names = [isObj(entry) && isStr(entry.file) ? entry.file : null, `${key}.jpg`].filter(Boolean);
    const found = names.some((n) => [path.join(assetsDir, n), path.join(ROOT, n)].some((p) => fs.existsSync(p)));
    return found ? null : `has no photo file (${names.join(' / ')}) in ${path.relative(ROOT, assetsDir) || assetsDir}`;
  };
}

/** S7: the words of a speaking form: per task the longest choice's turns' minWords, added up. */
function speakingWords(form) {
  return form.tasks.reduce((n, task) => {
    if (!isObj(task) || !Array.isArray(task.choices)) return n;
    const perChoice = task.choices.map((c) => (isObj(c) && Array.isArray(c.turns) ? c.turns.reduce((m, turn) => m + (isObj(turn) && isInt(turn.minWords) ? turn.minWords : 0), 0) : 0));
    return n + Math.max(0, ...perChoice);
  }, 0);
}

/** Checks a parsed file; returns { errors, warnings } (lists of messages). `strict`: an empty forms list is an error (not in a speaking file). `photos`: the S5 lookup. */
function checkData(data, { strict, photos = registryPhotos }) {
  const errors = [];
  const warnings = [];
  if (!isObj(data)) return { errors: ['M1: the file must be an object { target, level, paper, forms }'], warnings };
  if (!['es', 'en'].includes(data.target)) errors.push(`M1: target "${data.target}" must be es or en`);
  if (!LEVELS.includes(data.level)) errors.push(`M1: level "${data.level}" must be ${LEVELS.join(', ')}`);
  if (!isStr(data.paper)) errors.push('M1: paper must be a non-empty string');
  if (!Array.isArray(data.forms)) errors.push('M1: forms must be a list');
  if (errors.length) return { errors, warnings };

  const key = `${data.target}-${String(data.level).toLowerCase()}-${data.paper}`;
  const spec = SPEC[key];
  if (!spec) {
    errors.push(`M1: there is no paper "${data.paper}" in the ${data.target} ${data.level} format (${Object.keys(SPEC).filter((k) => k.startsWith(key.slice(0, 5))).map((k) => k.slice(6)).join(', ')})`);
    return { errors, warnings };
  }

  // M6, M7: the text norms hold for every string of the file, forms or not.
  for (const [at, text] of strings(data)) {
    if (EM_DASH.test(text)) errors.push(`M7: ${at}: em dash (use a comma, a colon or a new sentence)`);
    if (data.target === 'es') for (const re of ES_BLACKLIST) if (re.test(text)) errors.push(`M6: ${at}: "${text.match(re)[0]}" is not Mexican usage (${re})`);
  }

  // A speaking file is written after the engine; the app keeps its placeholder while it is empty, so it is only a warning, also with --strict.
  const speakingFile = data.paper === 'speaking';
  if (data.forms.length === 0) {
    if (speakingFile) warnings.push('forms is empty: not written yet (speaking placeholder, only a warning also with --strict)');
    else (strict ? errors : warnings).push('forms is empty: not written yet');
    return { errors, warnings };
  }

  const formIds = [];
  data.forms.forEach((form, fi) => {
    const fid = isObj(form) && isStr(form.id) ? form.id : `#${fi + 1}`;
    const ferr = (msg) => errors.push(`M2: form ${fid}: ${msg}`);
    if (!isObj(form) || !isStr(form.id)) return ferr('needs an id and a task list');
    formIds.push(form.id);
    if (!Array.isArray(form.tasks)) return ferr('tasks must be a list');
    if (form.tasks.length !== spec.length) ferr(`${form.tasks.length} tasks, the ${key} format has ${spec.length}`);
    form.tasks.forEach((task, ti) => {
      const s = ti < spec.length ? spec[ti] : null;
      const kind = isObj(task) ? task.kind : '?';
      checkTask(task, s, (msg) => errors.push(`M3: form ${fid} task ${ti + 1} (${kind}): ${msg}`), { speakingFile, tasks: form.tasks, index: ti, photos });
      if (s && s.sameAudioAs && isObj(task) && Array.isArray(task.prompts)) {
        const other = form.tasks[s.sameAudioAs - 1];
        const a = JSON.stringify(task.prompts.map((p) => p && p.audio));
        const b = isObj(other) && Array.isArray(other.prompts) ? JSON.stringify(other.prompts.map((p) => p && p.audio)) : null;
        if (a !== b) errors.push(`M3: form ${fid} task ${ti + 1} (${kind}): the recordings must be the same as in task ${s.sameAudioAs}`);
      }
    });
    if (speakingFile) {
      const words = speakingWords(form);
      const budget = WORDS_PER_MINUTE * SPEAKING_MINUTES[key.slice(0, 5)];
      if (words > budget) errors.push(`S7: form ${fid}: the turns' minWords add up to ${words}, the ${SPEAKING_MINUTES[key.slice(0, 5)]} minute paper allows ${budget} (${WORDS_PER_MINUTE} words a minute)`);
    }
  });
  if (!unique(formIds)) errors.push('M2: form ids are not unique');
  return { errors, warnings };
}

// ---------------------------------------------------------------- blind export and grading

const KEY_FIELDS = ['correct', 'answer', 'answers'];
// A speaking paper has no such key: what gives the answer away is the content points (keywords) and the model answers.
const SPEAKING_KEY_FIELDS = ['points', 'model'];

function stripKey(value, fields = KEY_FIELDS) {
  if (Array.isArray(value)) return value.map((v) => stripKey(v, fields));
  if (!isObj(value)) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) if (!fields.includes(k)) out[k] = stripKey(v, fields);
  return out;
}

/** Compares the keyed fields of `key` with the reviewer's `given` copy; returns { total, deviations }. */
function grade(key, given) {
  let total = 0;
  const deviations = [];
  const walk = (k, g, at) => {
    if (Array.isArray(k)) return k.forEach((v, i) => walk(v, Array.isArray(g) ? g[i] : undefined, `${at}[${i}]`));
    if (!isObj(k)) return;
    for (const [name, v] of Object.entries(k)) {
      const here = at ? `${at}.${name}` : name;
      const gv = isObj(g) ? g[name] : undefined;
      if (name === 'correct') {
        total += Array.isArray(v) ? v.length : 1;
        const same = Array.isArray(v) ? Array.isArray(gv) && sameJson([...v].sort((x, y) => x - y), [...gv].sort((x, y) => x - y)) : gv === v;
        if (!same) deviations.push(`${here}: key ${JSON.stringify(v)}, given ${gv === undefined ? 'nothing' : JSON.stringify(gv)}`);
      } else if (name === 'answer') {
        for (const id of Object.keys(v)) {
          total += 1;
          const got = isObj(gv) ? gv[id] : undefined;
          if (got !== v[id]) deviations.push(`${here}.${id}: key ${JSON.stringify(v[id])}, given ${got === undefined ? 'nothing' : JSON.stringify(got)}`);
        }
      } else if (name === 'answers') {
        total += 1;
        const given = (Array.isArray(gv) ? gv : gv === undefined ? [] : [gv]).map(loose).filter(Boolean);
        if (!v.some((a) => given.includes(loose(a)))) deviations.push(`${here}: key ${JSON.stringify(v)}, given ${gv === undefined ? 'nothing' : JSON.stringify(gv)}`);
      } else walk(v, gv, here);
    }
  };
  walk(key, given, '');
  return { total, deviations };
}

/**
 * Speaking: scores the reviewer's answers like the app does (choice: own pick, else the followed task's, else the first) and lists, per
 * turn, which content points came. The keyed items are the content points and the word-count mark of every turn; a missing one is a
 * deviation (a good blind answer should get it: widen the keywords or justify). `given`: the first form's tasks as an array, or
 * `{ <form id>: [...] }`; a task's answer is `{ choice, <turn id>: text }` (an object keyed by the task's ordinal also does).
 */
function gradeSpeaking(key, given) {
  let total = 0;
  const deviations = [];
  const lines = [];
  (Array.isArray(key.forms) ? key.forms : []).forEach((form, fi) => {
    const list = Array.isArray(given) ? (fi === 0 ? given : undefined) : isObj(given) ? given[form.id] : undefined;
    const answerOf = (ti) => {
      const a = Array.isArray(list) ? list[ti] : isObj(list) ? (list[String(ti + 1)] ?? list[`speaking-${ti + 1}`]) : undefined;
      return isObj(a) ? a : {};
    };
    const tasks = Array.isArray(form.tasks) ? form.tasks : [];
    // The choice a task continues (score.ts followedChoice).
    const followedChoice = (ti) => {
      const t = tasks[ti];
      if (!isObj(t) || t.follows === undefined || t.follows - 1 >= ti || !isObj(tasks[t.follows - 1])) return undefined;
      const own = answerOf(t.follows - 1).choice;
      return typeof own === 'string' ? own : followedChoice(t.follows - 1);
    };
    tasks.forEach((task, ti) => {
      if (!isObj(task) || !Array.isArray(task.choices)) return;
      const ans = answerOf(ti);
      const inherited = followedChoice(ti);
      const choice = task.choices.find((c) => c.id === ans.choice) ?? task.choices.find((c) => c.id === inherited) ?? task.choices[0];
      if (!isObj(choice) || !Array.isArray(choice.turns)) return;
      for (const turn of choice.turns) {
        const at = `forms[${fi}].tasks[${ti}].${turn.id}`;
        const r = scoreTurn(task, choice, turn, String(ans[turn.id] ?? ''));
        total += turn.points.length + 1;
        const marks = turn.points.map((p, m) => `${r.hits[m] ? 'got' : 'MISSED'} ${p.id}`);
        lines.push(`TURN ${at} (choice ${choice.id}): ${[...marks, `${r.countOk ? 'got' : 'MISSED'} ${r.words}/${turn.minWords} words`].join(', ')}`);
        turn.points.forEach((p, m) => {
          if (!r.hits[m]) deviations.push(`${at}.${p.id}: "${p.label}" not given, keywords ${JSON.stringify(p.keywords)}`);
        });
        if (!r.countOk) deviations.push(`${at}.words: ${r.words} meaningful words, minWords ${turn.minWords}`);
      }
    });
  });
  return { total, deviations, lines };
}

// ---------------------------------------------------------------- CLI

function expand(arg) {
  if (!arg.includes('*')) return [arg];
  const dir = path.dirname(arg);
  const pattern = path.basename(arg).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const re = new RegExp(`^${pattern}$`);
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => re.test(n)).sort() : [];
  return names.length ? names.map((n) => path.join(dir, n)) : [arg];
}

function readJson(file) {
  try {
    return { data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) {
    return { error: `${file}: cannot be read as JSON (${e.message})` };
  }
}

function main(argv) {
  let strict = false;
  let photos;
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--strict') strict = true;
    else if (a === '--photos') {
      const registry = argv[++i];
      if (!registry) return fail('usage: --photos <registry.json>');
      photos = photoLookup(registry, path.dirname(registry));
    } else if (a === '--blind') {
      const [file, out] = [argv[i + 1], argv[i + 2]];
      if (!file || !out) return fail('usage: --blind <file> <out>');
      const r = readJson(file);
      if (r.error) return fail(r.error);
      const speakingFile = isObj(r.data) && r.data.paper === 'speaking';
      fs.writeFileSync(out, `${JSON.stringify(stripKey(r.data, speakingFile ? SPEAKING_KEY_FIELDS : KEY_FIELDS), null, 2)}\n`);
      console.log(`blind: ${out} written without ${(speakingFile ? SPEAKING_KEY_FIELDS : KEY_FIELDS).join(' / ')}`);
      return 0;
    } else if (a === '--grade') {
      const [file, answers] = [argv[i + 1], argv[i + 2]];
      if (!file || !answers) return fail('usage: --grade <file> <answers>');
      const [k, g] = [readJson(file), readJson(answers)];
      if (k.error || g.error) return fail(k.error || g.error);
      const { total, deviations, lines = [] } = isObj(k.data) && k.data.paper === 'speaking' ? gradeSpeaking(k.data, g.data) : grade(k.data, g.data);
      for (const l of lines) console.log(l);
      for (const d of deviations) console.log(`DEVIATION ${d}`);
      console.log(`grade: ${total - deviations.length}/${total} keyed items agree, ${deviations.length} deviations`);
      return deviations.length ? 1 : 0;
    } else if (a.startsWith('--')) return fail(`unknown option ${a}`);
    else files.push(...expand(a));
  }

  const defaultRun = files.length === 0;
  const targets = defaultRun ? EXPECTED_FILES.map((n) => path.join(DIR, n)) : files;
  let errorCount = 0;
  let warningCount = 0;
  for (const file of targets) {
    const label = path.relative(ROOT, file) || file;
    const r = fs.existsSync(file) ? readJson(file) : { error: `${label}: the file does not exist` };
    if (r.error) {
      console.log(`ERROR M1: ${r.error}`);
      errorCount++;
      continue;
    }
    const { errors, warnings } = checkData(r.data, { strict, photos });
    if (defaultRun && isObj(r.data) && `${r.data.target}-${String(r.data.level).toLowerCase()}-${r.data.paper}.json` !== path.basename(file)) {
      errors.unshift(`M1: the header (${r.data.target} ${r.data.level} ${r.data.paper}) does not match the file name`);
    }
    for (const m of errors) console.log(`ERROR ${label}: ${m}`);
    for (const m of warnings) console.log(`WARN ${label}: ${m}`);
    errorCount += errors.length;
    warningCount += warnings.length;
  }
  console.log(`mock-exam-check: ${errorCount ? 'FAIL' : 'OK'} (${targets.length} files, ${errorCount} errors, ${warningCount} warnings)`);
  return errorCount ? 1 : 0;
}

function fail(message) {
  console.error(`mock-exam-check: ${message}`);
  return 1;
}

// Run as a script; imported (a generator of test fixtures reads SPEC) it only exposes the pieces.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));

export { SPEC, checkData };
