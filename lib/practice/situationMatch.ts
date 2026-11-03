// Checks what the learner said (or typed) in a situation (components/practice/SituationGame.tsx) against the sentences it may
// be: the closest of the expected answers wins, and each word of it is marked heard or missing. The speech recognizer writes
// no accents and often digits ("30"), so both sides are normalized the same way first: lower case, accents stripped,
// ¿?¡!.,;: removed, the digits 0-100 turned into number words of the language (Spanish "treinta y uno", "treinta y un" and 31 are
// the same number; German "einunddreißig" and 31 are). German: ä ö ü ß are written ae oe ue ss on both sides, so "für" and
// "fuer" are the same word while "fur" is not, and the capital of a noun does not matter.
// With `anyNumber` any number 1-100 matches any other (the answer "treinta años" is also right as "dos años"), without it the number
// has to be the one of the sentence. A heard "uno" / "eins" (also the digit 1) matches an expected "un" / "una" / "ein" / "eine" ...
// A leading subject pronoun of the expected Spanish sentence may be left out (lib/pcicMatch.ts withoutLeadingSubjectPronoun; German
// never drops it). Extra words that were said do no harm, except a "no" (German: "nicht", "nein", "kein...") the sentence does
// not have: it turns the sentence round. Pure logic, no I/O.

import { withoutLeadingSubjectPronoun } from '@/lib/pcicMatch';

const UNITS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const TEENS = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve'];
const TWENTIES = ['veinte', 'veintiuno', 'veintidos', 'veintitres', 'veinticuatro', 'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve'];
// the tens word by its digit (index 3 = treinta)
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

// the number words 1-100 and their values; "veintiun" is 21 before a noun (veintiún años)
const NUMBER_VALUES = new Map<string, number>([
  ...UNITS.slice(1).map((w, i): [string, number] => [w, i + 1]),
  ...TEENS.map((w, i): [string, number] => [w, 10 + i]),
  ...TWENTIES.map((w, i): [string, number] => [w, 20 + i]),
  ...TENS.flatMap((w, tens): [string, number][] => (w ? [[w, tens * 10]] : [])),
  ['veintiun', 21],
  ['cien', 100],
]);
const TENS_WORDS = new Set(TENS.filter(Boolean));
// "treinta y uno", and "treinta y un años" before a noun
const UNITS_AFTER_Y = new Set([...UNITS.slice(1), 'un', 'una']);
// stands for a whole number in the comparison ("NUM" = any number, "NUM31" = that number); a normalized word is lower case,
// so it can never clash with one
const NUM = 'NUM';

/** A number 0-100 in Spanish words, without accents (31 -> "treinta y uno"). */
export function numberWords(n: number): string {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 30) return TWENTIES[n - 20];
  if (n === 100) return 'cien';
  const tens = TENS[Math.floor(n / 10)];
  return n % 10 === 0 ? tens : `${tens} y ${UNITS[n % 10]}`;
}

export type SpokenLang = 'es' | 'de';

// German number words 0-100 as the comparison form writes them (no umlauts, ß as ss): "einunddreissig" is one word
const DE_UNITS = ['null', 'eins', 'zwei', 'drei', 'vier', 'fuenf', 'sechs', 'sieben', 'acht', 'neun'];
const DE_TEENS = ['zehn', 'elf', 'zwoelf', 'dreizehn', 'vierzehn', 'fuenfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const DE_TENS = ['', '', 'zwanzig', 'dreissig', 'vierzig', 'fuenfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

/** A number 0-100 in German words, written the way the comparison form does (31 -> "einunddreissig"). */
export function germanNumberWords(n: number): string {
  if (n < 10) return DE_UNITS[n];
  if (n < 20) return DE_TEENS[n - 10];
  if (n === 100) return 'hundert';
  const tens = DE_TENS[Math.floor(n / 10)];
  return n % 10 === 0 ? tens : `${n % 10 === 1 ? 'ein' : DE_UNITS[n % 10]}und${tens}`;
}

// the number words 1-100 and their values, German: every number is one word
const DE_NUMBER_VALUES = new Map<string, number>([
  ...Array.from({ length: 100 }, (_, i): [string, number] => [germanNumberWords(i + 1), i + 1]),
  ['einhundert', 100],
]);
// German "ein" / "eine" ... is the article and the number one at once
const DE_ONE = new Set(['ein', 'eine', 'einen', 'einem', 'einer', 'eines']);
const DE_NEGATIONS = new Set(['nicht', 'nein', 'kein', 'keine', 'keinen', 'keinem', 'keiner', 'keines']);

const DE_LETTERS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/**
 * The comparison form of a text: lower case, no accents, no ¿?¡!.,;:, digits 0-100 as number words, single spaces.
 * German also writes ä ö ü ß as ae oe ue ss.
 */
export function normalizeSpoken(text: string, lang: SpokenLang = 'es'): string {
  const lower = text.toLowerCase();
  return (lang === 'de' ? lower.replace(/[äöüß]/g, (c) => DE_LETTERS[c]) : lower)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\d+/g, (digits) => (Number(digits) <= 100 ? (lang === 'de' ? germanNumberWords(Number(digits)) : numberWords(Number(digits))) : digits))
    .replace(/[¿?¡!.,;:„“”"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A normalized word and the index of the whitespace-separated word of the text it came from ("31" is three words, one source). */
interface Piece {
  word: string;
  source: number;
}

function piecesOf(text: string, lang: SpokenLang): Piece[] {
  const out: Piece[] = [];
  text.trim().split(/\s+/).forEach((raw, source) => {
    for (const word of normalizeSpoken(raw, lang).split(' ')) if (word) out.push({ word, source });
  });
  return out;
}

/** The comparison units: every number ("treinta y uno" too) is one unit, and keeps the sources it covers and its value. */
interface Unit {
  word: string;
  sources: number[];
  value: number | null;
}

function unitsOf(pieces: Piece[], anyNumber: boolean, lang: SpokenLang): Unit[] {
  const out: Unit[] = [];
  const values = lang === 'de' ? DE_NUMBER_VALUES : NUMBER_VALUES;
  const number = (value: number, sources: number[]): Unit => ({ word: anyNumber ? NUM : `${NUM}${value}`, sources, value });
  for (let i = 0; i < pieces.length; i++) {
    const { word, source } = pieces[i];
    const y = pieces[i + 1];
    const unit = pieces[i + 2];
    if (lang === 'es' && TENS_WORDS.has(word) && y?.word === 'y' && unit && UNITS_AFTER_Y.has(unit.word)) {
      out.push(number(NUMBER_VALUES.get(word)! + (NUMBER_VALUES.get(unit.word) ?? 1), [source, y.source, unit.source]));
      i += 2;
    } else if (values.has(word)) {
      out.push(number(values.get(word)!, [source]));
    } else {
      out.push({ word, sources: [source], value: null });
    }
  }
  return out;
}

// the same unit, or a said "uno" / "eins" / 1 for an expected article un / una / ein / eine ...
const isOneArticle = (word: string, lang: SpokenLang) => (lang === 'de' ? DE_ONE.has(word) : word === 'un' || word === 'una');
const sameUnit = (said: Unit, want: Unit, lang: SpokenLang) => said.word === want.word || (said.value === 1 && isOneArticle(want.word, lang));

/** The positions of `expected` that are in the longest common subsequence with `said` (the words said in order). */
function matchedPositions(said: readonly Unit[], expected: readonly Unit[], lang: SpokenLang): Set<number> {
  const n = said.length;
  const m = expected.length;
  const len: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      len[i][j] = sameUnit(said[i], expected[j], lang) ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1]);
    }
  }
  const matched = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (sameUnit(said[i], expected[j], lang) && len[i][j] === len[i + 1][j + 1] + 1) {
      matched.add(j);
      i++;
      j++;
    } else if (len[i + 1][j] >= len[i][j + 1]) i++;
    else j++;
  }
  return matched;
}

export interface SpokenWord {
  /** The word as written in the expected sentence (no ¿?¡!.,;:). */
  word: string;
  right: boolean;
}

export interface SpokenMatch {
  /** Every word of the closest expected sentence was said. */
  right: boolean;
  /** The closest expected sentence, as it was given. */
  best: string;
  /** Its words, each heard (right) or missing. */
  words: SpokenWord[];
}

const cleanWord = (word: string) => word.replace(/[¿?¡!.,;:„“”"]/g, '');

export interface SpokenOptions {
  /** Any number 1-100 matches the number of the sentence (the Questions step); otherwise it has to be the same number. */
  anyNumber?: boolean;
  /** The language that is spoken (default Spanish). */
  lang?: SpokenLang;
}

const isNo = (u: Unit, lang: SpokenLang) => (lang === 'de' ? DE_NEGATIONS.has(u.word) : u.word === 'no');

/**
 * The expected sentence closest to what was heard: the one with the fewest missing words (a tie: the first of the list, so
 * the model answer goes first). Extra words that were said are not an error, except a "no" the sentence does not have
 * (it counts as one more missing word). Right when none is missing.
 */
export function matchSpoken(heard: string, expected: string[], { anyNumber = false, lang = 'es' }: SpokenOptions = {}): SpokenMatch {
  const said = unitsOf(piecesOf(heard, lang), anyNumber, lang);
  let best: { text: string; missing: number; words: SpokenWord[] } | null = null;
  for (const text of expected) {
    const rest = lang === 'es' ? withoutLeadingSubjectPronoun(text) : null;
    // the full sentence, then without its subject pronoun (that word then counts as said)
    const forms = rest === null ? [{ body: text, lead: null }] : [{ body: text, lead: null }, { body: rest, lead: text.trim().split(/\s+/)[0] }];
    for (const { body, lead } of forms) {
      const units = unitsOf(piecesOf(body, lang), anyNumber, lang);
      if (units.length === 0) continue;
      const matched = matchedPositions(said, units, lang);
      const missing = units.length - matched.size + Math.max(0, said.filter((u) => isNo(u, lang)).length - units.filter((u) => isNo(u, lang)).length);
      if (best && missing >= best.missing) continue;
      // a word is right when every unit that covers it was matched
      const covered = new Map<number, boolean>();
      units.forEach((u, k) => u.sources.forEach((s) => covered.set(s, (covered.get(s) ?? true) && matched.has(k))));
      const words: SpokenWord[] = [];
      if (lead) words.push({ word: cleanWord(lead), right: true });
      body.trim().split(/\s+/).forEach((raw, source) => {
        if (cleanWord(raw)) words.push({ word: cleanWord(raw), right: covered.get(source) ?? true });
      });
      best = { text, missing, words };
    }
  }
  return best ? { right: best.missing === 0, best: best.text, words: best.words } : { right: false, best: expected[0] ?? '', words: [] };
}
