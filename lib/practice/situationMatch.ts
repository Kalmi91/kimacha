// Checks what the learner said (or typed) in a situation (components/practice/SituationGame.tsx) against the sentences it may
// be: the closest of the expected answers wins, and each word of it is marked heard or missing. The speech recognizer writes
// no accents and often digits ("30"), so both sides are normalized the same way first: lower case, accents stripped,
// ¿?¡!.,;: removed, the digits 0-100 turned into Spanish number words. Any number word 1-100 matches any other (the answer
// "treinta años" is also right as "dos años"), and a leading subject pronoun of the expected sentence may be left out
// (lib/pcicMatch.ts withoutLeadingSubjectPronoun). Pure logic, no I/O.

import { withoutLeadingSubjectPronoun } from '@/lib/pcicMatch';

const UNITS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const TEENS = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve'];
const TWENTIES = ['veinte', 'veintiuno', 'veintidos', 'veintitres', 'veinticuatro', 'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve'];
// the tens word by its digit (index 3 = treinta)
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

const NUMBER_WORDS = new Set([...UNITS.slice(1), ...TEENS, ...TWENTIES, ...TENS.filter(Boolean), 'cien']);
const TENS_WORDS = new Set(TENS.filter(Boolean));
// "treinta y uno", and "treinta y un años" before a noun
const UNITS_AFTER_Y = new Set([...UNITS.slice(1), 'un', 'una']);
// stands for a whole number in the comparison; a normalized word is lower case, so it can never clash with one
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

/** The comparison form of a text: lower case, no accents, no ¿?¡!.,;:, digits 0-100 as number words, single spaces. */
export function normalizeSpoken(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\d+/g, (digits) => (Number(digits) <= 100 ? numberWords(Number(digits)) : digits))
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A normalized word and the index of the whitespace-separated word of the text it came from ("31" is three words, one source). */
interface Piece {
  word: string;
  source: number;
}

function piecesOf(text: string): Piece[] {
  const out: Piece[] = [];
  text.trim().split(/\s+/).forEach((raw, source) => {
    for (const word of normalizeSpoken(raw).split(' ')) if (word) out.push({ word, source });
  });
  return out;
}

/** The comparison units: every number ("treinta y uno" too) is one NUM unit, and keeps the sources it covers. */
interface Unit {
  word: string;
  sources: number[];
}

function unitsOf(pieces: Piece[]): Unit[] {
  const out: Unit[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const { word, source } = pieces[i];
    const y = pieces[i + 1];
    const unit = pieces[i + 2];
    if (TENS_WORDS.has(word) && y?.word === 'y' && unit && UNITS_AFTER_Y.has(unit.word)) {
      out.push({ word: NUM, sources: [source, y.source, unit.source] });
      i += 2;
    } else {
      out.push({ word: NUMBER_WORDS.has(word) ? NUM : word, sources: [source] });
    }
  }
  return out;
}

/** The positions of `expected` that are in the longest common subsequence with `said` (the words said in order). */
function matchedPositions(said: readonly string[], expected: readonly string[]): Set<number> {
  const n = said.length;
  const m = expected.length;
  const len: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      len[i][j] = said[i] === expected[j] ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1]);
    }
  }
  const matched = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (said[i] === expected[j] && len[i][j] === len[i + 1][j + 1] + 1) {
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

const cleanWord = (word: string) => word.replace(/[¿?¡!.,;:]/g, '');

/**
 * The expected sentence closest to what was heard: the one with the fewest missing words (a tie: the first of the list, so
 * the model answer goes first). Extra words that were said are not an error. Right when none is missing.
 */
export function matchSpoken(heard: string, expected: string[]): SpokenMatch {
  const said = unitsOf(piecesOf(heard)).map((u) => u.word);
  let best: { text: string; missing: number; words: SpokenWord[] } | null = null;
  for (const text of expected) {
    const rest = withoutLeadingSubjectPronoun(text);
    // the full sentence, then without its subject pronoun (that word then counts as said)
    const forms = rest === null ? [{ body: text, lead: null }] : [{ body: text, lead: null }, { body: rest, lead: text.trim().split(/\s+/)[0] }];
    for (const { body, lead } of forms) {
      const units = unitsOf(piecesOf(body));
      if (units.length === 0) continue;
      const matched = matchedPositions(said, units.map((u) => u.word));
      const missing = units.length - matched.size;
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
