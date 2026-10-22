// Gate for the authored B1-C1 practice-exam papers (data/exams/mock/<target>-<level>-<paper>.json), the content of
// lib/exam/mock/authored.ts. The schema is AuthoredPaperFile in lib/exam/mock/types.ts; the task order, counts and text
// lengths per paper are PLAN-vizsga-b1c1.md "Feladatrend" (the SPEC tables below).
//
// Usage:
//   node scripts/mock-exam-check.mjs [--strict] [file ...]   check the given files (default: all 18 under data/exams/mock);
//                                                             a `*` in a path is expanded here (PowerShell does not)
//   node scripts/mock-exam-check.mjs --blind <file> <out>      write a copy without the answer key (correct / answer / answers)
//   node scripts/mock-exam-check.mjs --grade <file> <answers>  compare a filled-in copy of the blind export with the key
// An empty `forms` list is a warning ("not written yet"), an error with --strict. The last line is the summary, exit 1 on errors.
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
};

const EXPECTED_FILES = Object.keys(SPEC).map((name) => `${name}.json`);

// es norm (PLAN "Norma (es)"): Mexican usage, no vosotros, no Spain-only words. Patterns as in the plan.
const ES_BLACKLIST = [/vosotr/i, /\bcoche/i, /\bordenador/i, /\bzumo\b/i, /\bmóvil\b/i, /\bos\b/i];
const EM_DASH = ', ';

const TOLERANCE = 0.15;
const SKILLS = ['reading', 'use', 'listening', 'writing'];
const SPEAKERS = ['m', 'f', 'n'];

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
};

function checkTask(t, spec, err) {
  if (!isObj(t)) return err('not an object');
  if (!isStr(t.instruction)) err('instruction must be a non-empty string');
  if (!SKILLS.includes(t.skill)) err(`skill "${t.skill}" must be one of ${SKILLS.join(', ')}`);
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
  check(t, s, err);
}

// ---------------------------------------------------------------- one file

/** Checks a parsed file; returns { errors, warnings } (lists of messages). `strict`: an empty forms list is an error. */
function checkData(data, { strict }) {
  const errors = [];
  const warnings = [];
  if (!isObj(data)) return { errors: ['M1: the file must be an object { target, level, paper, forms }'], warnings };
  if (!['es', 'en'].includes(data.target)) errors.push(`M1: target "${data.target}" must be es or en`);
  if (!['B1', 'B2', 'C1'].includes(data.level)) errors.push(`M1: level "${data.level}" must be B1, B2 or C1`);
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
    if (text.includes(EM_DASH)) errors.push(`M7: ${at}: em dash (use a comma, a colon or a new sentence)`);
    if (data.target === 'es') for (const re of ES_BLACKLIST) if (re.test(text)) errors.push(`M6: ${at}: "${text.match(re)[0]}" is not Mexican usage (${re})`);
  }

  if (data.forms.length === 0) {
    (strict ? errors : warnings).push('forms is empty: not written yet');
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
      checkTask(task, s, (msg) => errors.push(`M3: form ${fid} task ${ti + 1} (${kind}): ${msg}`));
      if (s && s.sameAudioAs && isObj(task) && Array.isArray(task.prompts)) {
        const other = form.tasks[s.sameAudioAs - 1];
        const a = JSON.stringify(task.prompts.map((p) => p && p.audio));
        const b = isObj(other) && Array.isArray(other.prompts) ? JSON.stringify(other.prompts.map((p) => p && p.audio)) : null;
        if (a !== b) errors.push(`M3: form ${fid} task ${ti + 1} (${kind}): the recordings must be the same as in task ${s.sameAudioAs}`);
      }
    });
  });
  if (!unique(formIds)) errors.push('M2: form ids are not unique');
  return { errors, warnings };
}

// ---------------------------------------------------------------- blind export and grading

const KEY_FIELDS = ['correct', 'answer', 'answers'];

function stripKey(value) {
  if (Array.isArray(value)) return value.map(stripKey);
  if (!isObj(value)) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) if (!KEY_FIELDS.includes(k)) out[k] = stripKey(v);
  return out;
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--strict') strict = true;
    else if (a === '--blind') {
      const [file, out] = [argv[i + 1], argv[i + 2]];
      if (!file || !out) return fail('usage: --blind <file> <out>');
      const r = readJson(file);
      if (r.error) return fail(r.error);
      fs.writeFileSync(out, `${JSON.stringify(stripKey(r.data), null, 2)}\n`);
      console.log(`blind: ${out} written without correct / answer / answers`);
      return 0;
    } else if (a === '--grade') {
      const [file, answers] = [argv[i + 1], argv[i + 2]];
      if (!file || !answers) return fail('usage: --grade <file> <answers>');
      const [k, g] = [readJson(file), readJson(answers)];
      if (k.error || g.error) return fail(k.error || g.error);
      const { total, deviations } = grade(k.data, g.data);
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
    const { errors, warnings } = checkData(r.data, { strict });
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
