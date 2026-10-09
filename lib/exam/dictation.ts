// The speaking item works through the keyboard's microphone; the app has no speech recognizer of its own.
// The dictated text goes into a text field; this comparer compares the dictated text with the expected
// sentence and tells which words differ (explicit feedback). A pure function, also used by the speaking
// part of the practice exam and by the later speaking practice.
//
// Rule: case and punctuation do not count (the keyboard itself inserts the period and the
// capital letter). Accents follow the existing "Accents count" setting (lib/pcicMatch.ts): when on,
// an accent error is an error, when off it is not; ñ is a separate letter, not an accent (año ≠ ano). A Spanish
// sentence-initial subject pronoun may be omitted (as with a typed sentence).

import { withoutLeadingSubjectPronoun } from '@/lib/pcicMatch';

export interface DictationWord {
  /** The word as it appears in the sentence (with its attached punctuation, for display). */
  text: string;
  /** True if it has a match on the other side; false = differs (on the expected side: missing, on the dictated side: extra). */
  ok: boolean;
}

export interface DictationResult {
  /** Every word matches (under the configured rule). */
  correct: boolean;
  /** The words of the expected sentence, `ok: false` = that word was not said (or a different word was said instead). */
  expected: DictationWord[];
  /** The words of the dictated text, `ok: false` = an extra or wrong word. */
  heard: DictationWord[];
  /** Words missing from the expected sentence, in sentence order. */
  missing: string[];
  /** Words of the dictated text that do not fit the expected sentence, in the order they were said. */
  extra: string[];
}

interface DictationOptions {
  /** The "Accents count" setting: true = accents count. */
  strictAccents: boolean;
  /** True for a Spanish target language: a sentence-initial subject pronoun may be omitted. */
  subjectDrop?: boolean;
}

// Punctuation that is never an error (the keyboard inserts it, or the learner does not say it). The apostrophe and the
// hyphen stay (in English "don't" and "well-known" are part of the word), as in lib/pcicMatch.ts.
const PUNCT = /[¿?¡!.,;:…"“”«»()[\]{}\u2014\u2013]/g;

function foldAccents(s: string): string {
  // ñ is a separate letter: we protect it before NFD, otherwise "año" and "ano" would count as the same.
  return s.normalize('NFC').replace(/ñ/g, '\uE000').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\uE000/g, 'ñ');
}

/** The comparison key of a word: lower case, no punctuation, and with strict accents OFF, no accents. */
function keyOf(token: string, strictAccents: boolean): string {
  // The curly apostrophe (’) may come from the keyboard; it is the same as the straight one.
  const lower = token.toLowerCase().replace(/[’‘]/g, "'").replace(PUNCT, '').trim();
  return strictAccents ? lower.normalize('NFC') : foldAccents(lower);
}

/** The words of the text: split on spaces, without pieces made only of punctuation (or a lone hyphen or apostrophe). */
function tokens(text: string, strictAccents: boolean): { text: string; key: string }[] {
  return text
    .split(/\s+/)
    .map((raw) => ({ text: raw, key: keyOf(raw, strictAccents) }))
    .filter((t) => /[^-']/.test(t.key));
}

/** The longest common subsequence: which expected and dictated words have a match (keeping the order). */
function alignedPairs(expected: string[], heard: string[]): Set<string> {
  const n = expected.length;
  const m = heard.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = expected[i] === heard[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs = new Set<string>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (expected[i] === heard[j]) {
      pairs.add(`e${i}`);
      pairs.add(`h${j}`);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

function diff(heardText: string, expectedText: string, strictAccents: boolean): DictationResult {
  const exp = tokens(expectedText, strictAccents);
  const heard = tokens(heardText, strictAccents);
  const matched = alignedPairs(
    exp.map((t) => t.key),
    heard.map((t) => t.key),
  );
  const expected = exp.map((t, i) => ({ text: t.text, ok: matched.has(`e${i}`) }));
  const heardWords = heard.map((t, j) => ({ text: t.text, ok: matched.has(`h${j}`) }));
  const missing = expected.filter((w) => !w.ok).map((w) => w.text);
  const extra = heardWords.filter((w) => !w.ok).map((w) => w.text);
  return { correct: missing.length === 0 && extra.length === 0 && exp.length > 0, expected, heard: heardWords, missing, extra };
}

/** Compares the dictated text with the expected sentence; differing words are marked on both sides. */
export function compareDictation(heard: string, expected: string, options: DictationOptions): DictationResult {
  const full = diff(heard, expected, options.strictAccents);
  if (full.correct || !options.subjectDrop) return full;
  const short = withoutLeadingSubjectPronoun(expected);
  if (short && diff(heard, short, options.strictAccents).correct) {
    // A sentence without the pronoun is fine too: the missing pronoun is not an error, every word is matched.
    return { correct: true, expected: full.expected.map((w) => ({ ...w, ok: true })), heard: full.heard.map((w) => ({ ...w, ok: true })), missing: [], extra: [] };
  }
  return full;
}
