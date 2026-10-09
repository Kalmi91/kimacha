// Tightening of the writing paper (coordinator's observation, 2026-10-01: the keyword scoring used to be too lax: a pasted task text, a
// much-repeated word or a meaningless jumble of letters also earned points because of the word
// count, and the form accepted any filled-in field).
//
// A message earns points only if it is MEANINGFUL text: long passages pasted from the task text
// do not count, nonsense words (with no vowels, repeated letters) do not count, the text cannot be
// a word repetition, and (if there is a dictionary) its words are mostly known words of the target
// language. A content point requires the text to have at least half the minimum word count,
// so a keyword crammed into a word or two does not earn a point either. A long, good answer still gets everything.

import type { PcicItem } from '@/data/pcic';
import type { MockFormField, MockTarget } from './types';

/** Comparison without case and accents for the keywords. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Lower-case words without accents (letters and apostrophe only; numbers and punctuation drop out). */
export function foldedTokens(text: string): string[] {
  return fold(text)
    .replace(/[^a-z'\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

/** At least this many consecutive words matching the task text make a "pasted" passage (a natural echo is shorter than this). */
const COPY_RUN = 5;
/** At least this share of the words must be different (a much-repeated word is not text). */
const MIN_DISTINCT_RATIO = 0.5;
/** At least this share of the words must be known dictionary words (only if there is a dictionary). */
const MIN_KNOWN_RATIO = 0.4;

const VOWELS = /[aeiouy]/;

// Keyboard rows: 4 adjacent keys ("asdf", "qwer", "zxcv", also reversed) are not a word.
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const KEY_RUNS = ROWS.flatMap((row) => {
  const out: string[] = [];
  for (let i = 0; i + 4 <= row.length; i++) {
    const run = row.slice(i, i + 4);
    out.push(run, [...run].reverse().join(''));
  }
  return out;
});

/** Nonsense word: with no vowels (3+ letters), the same letter 4+ times, 6+ consonants in a row, or 4 adjacent keys. */
export function isNonsenseToken(tok: string): boolean {
  if (tok.length >= 3 && !VOWELS.test(tok)) return true;
  if (/([a-z])\1{3,}/.test(tok)) return true;
  if (/[^aeiouy']{6,}/.test(tok)) return true;
  return KEY_RUNS.some((run) => tok.includes(run));
}

// --- Dictionary: the known words of the target language from the loaded corpus + the most frequent function words.

const FREE: Record<MockTarget, string> = {
  es: 'de la que el en y a los se del las un por con no una su para es al lo como mas pero sus le ya o fue este si porque esta entre cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mi antes algunos unos yo otro otras otra tanto esa estos mucho nada muchos cual poco ella estar estas algo nosotros mis tu te ti tus ellas soy eres somos son estoy estas esta estan tengo tiene tienen vivo vive trabajo quiero puedo voy va vamos hago hace gusta gustan llamo llama hola gracias adios por favor aqui alli hoy manana ayer',
  en: 'the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were am been has had does did said went made got very much more here where why yes hello thanks please today tomorrow yesterday live name',
};

const stripPunct = /[¿?¡!.,;:()"«»/]/g;

/** The target-language dictionary: the target-language forms of the corpus items + their example sentences (the caller supplies the items of the levels). */
export function buildLexicon(items: PcicItem[], target: MockTarget): Set<string> {
  const lex = new Set<string>(FREE[target].split(' '));
  for (const it of items) {
    const forms = target === 'es' ? [it.es, it.exampleEs] : [it.en, it.exampleEn];
    for (const text of forms) {
      if (!text) continue;
      for (const tok of foldedTokens(text.replace(stripPunct, ' '))) lex.add(tok);
    }
  }
  return lex;
}

/** Inflected/plural forms also count as known (the dictionary contains the dictionary forms and the example sentences). */
function isKnown(tok: string, lex: ReadonlySet<string>): boolean {
  if (lex.has(tok)) return true;
  for (const suffix of ['s', 'es', 'ed', 'd', 'ing', 'a', 'as', 'o', 'os']) {
    if (tok.length > suffix.length + 2 && tok.endsWith(suffix) && lex.has(tok.slice(0, -suffix.length))) return true;
  }
  return false;
}

interface MessageAssessment {
  /** The number of meaningful, non-pasted words. */
  words: number;
  /** Whether it counts as text at all (otherwise nothing earns a point). */
  valid: boolean;
  /** The words taken into account, joined with spaces (the keyword matching runs on this). */
  text: string;
}

/**
 * Evaluating a message: it leaves out passages pasted from the task text and the nonsense words,
 * then checks that the remaining text is varied enough and (if there is a dictionary) made of known
 * words.
 */
export function assessMessage(text: string, reference: string[], lexicon?: ReadonlySet<string>): MessageAssessment {
  const tokens = foldedTokens(text);
  const ref = foldedTokens(reference.join(' '));
  const refRuns = new Set<string>();
  for (let i = 0; i + COPY_RUN <= ref.length; i++) refRuns.add(ref.slice(i, i + COPY_RUN).join(' '));
  const copied = new Array<boolean>(tokens.length).fill(false);
  for (let i = 0; i + COPY_RUN <= tokens.length; i++) {
    if (refRuns.has(tokens.slice(i, i + COPY_RUN).join(' '))) for (let k = i; k < i + COPY_RUN; k++) copied[k] = true;
  }
  const kept = tokens.filter((tok, i) => !copied[i] && !isNonsenseToken(tok));
  const distinctOk = kept.length < 6 || new Set(kept).size / kept.length >= MIN_DISTINCT_RATIO;
  const knownOk = !lexicon || kept.length === 0 || kept.filter((tok) => isKnown(tok, lexicon)).length / kept.length >= MIN_KNOWN_RATIO;
  return { words: kept.length, valid: kept.length > 0 && distinctOk && knownOk, text: kept.join(' ') };
}

/** Checking one form field: filled in and a meaningful value matching the field's kind. */
export function checkField(field: MockFormField, raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  const tokens = foldedTokens(value);
  const sensible = tokens.length > 0 && !tokens.every(isNonsenseToken);
  const check = field.check ?? (field.type === 'number' ? 'age' : 'word');
  switch (check) {
    case 'fullname':
      return tokens.length >= 2 && tokens.every((t) => t.length >= 2) && sensible && !/\d/.test(value);
    case 'word':
      return tokens.some((t) => t.length >= 3) && sensible && !/\d/.test(value);
    case 'address':
      return tokens.some((t) => t.length >= 3) && /\d/.test(value) && sensible;
    case 'age': {
      const n = /^\d{1,3}$/.test(value) ? Number(value) : NaN;
      return n >= 5 && n <= 110;
    }
    case 'phone': {
      const digits = value.replace(/[\s+\-().]/g, '');
      return /^\d{7,15}$/.test(digits);
    }
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
    case 'level':
      return /^[abc][12]$/i.test(value);
  }
}
