// FB724: the words the practice tasks show, so the lesson page can list the ones its worked examples do not cover.
import { normalizeWordToken } from '@/data/words';

// Only the fields read here; the lesson's item union is wider (and schema-1 lessons only have gap/mark items).
interface LooseItem {
  kind?: string;
  sentence?: string;
  options?: unknown[];
  correct?: number;
  examples?: string[];
  pairs?: Record<string, string>[];
  verb?: string;
  person?: string;
  answer?: string;
  answers?: string[];
  prompt?: Record<string, string>;
  es?: string;
  wrongIndex?: number;
  correctIndex?: number;
  text?: string;
  bank?: string[];
  base?: string;
}

interface LessonLike {
  items: readonly object[];
}

export interface ExerciseWord {
  key: string;
  display: string;
}

const items = (lesson: LessonLike): LooseItem[] => lesson.items as LooseItem[];

/** The sentences the lesson page shows as worked examples (the same 3 as app/grammar/[topic].tsx). */
export function workedSentences(lesson: LessonLike): string[] {
  return items(lesson)
    .filter((item) => item.kind === undefined || item.kind === 'gap')
    .slice(0, 3)
    .map((item) => (item.sentence ?? '').replace('___', String((item.options ?? [])[item.correct ?? 0] ?? '')));
}

const withoutIndex = (es: string, index: number | undefined): string =>
  es
    .split(' ')
    .filter((_, i) => i !== index)
    .join(' ');

const isSingleToken = (s: string | undefined): s is string => !!s && s.trim().length > 0 && !/\s/.test(s.trim());

/** The learned-language texts the tasks show. */
export function exerciseTexts(lesson: LessonLike, learnedLang: string): string[] {
  const out: string[] = [];
  const add = (v: string | undefined | null) => {
    if (typeof v === 'string' && v) out.push(v);
  };
  for (const item of items(lesson)) {
    switch (item.kind) {
      case undefined:
      case 'gap':
        add(item.sentence);
        add(String((item.options ?? [])[item.correct ?? 0] ?? ''));
        (item.examples ?? []).forEach(add);
        break;
      case 'mark':
        add(item.sentence);
        (item.examples ?? []).forEach(add);
        break;
      case 'match':
        for (const pair of item.pairs ?? []) add(pair[learnedLang] ?? pair.es);
        break;
      case 'form':
        add(item.answer);
        if (isSingleToken(item.verb)) add(item.verb);
        if (isSingleToken(item.person)) add(item.person);
        break;
      case 'why':
        add(item.es);
        break;
      case 'transform':
        add(item.prompt?.[learnedLang]);
        add(item.answer);
        break;
      case 'spot': {
        add(withoutIndex(item.es ?? '', item.wrongIndex));
        const fix = (item.options ?? [])[item.correctIndex ?? 0];
        if (typeof fix === 'string' && fix) add(fix);
        break;
      }
      case 'fix':
        add(withoutIndex(item.es ?? '', item.wrongIndex));
        add(item.answer);
        break;
      case 'order':
      case 'dictation':
      case 'write':
        add(item.es);
        break;
      case 'opencloze':
        add(item.text);
        (item.answers ?? []).forEach(add);
        break;
      case 'bank':
        (item.bank ?? []).forEach(add);
        add(item.es);
        add(item.answer);
        break;
      case 'noun':
        add(item.base);
        add(item.answer);
        break;
      default:
        break;
    }
  }
  return out;
}

const EDGE_PUNCT = /^[^\p{L}\p{N}_-]+|[^\p{L}\p{N}_]+$/gu;

interface Token {
  key: string;
  surface: string;
  upper: boolean;
}

// A word of plain letters with common punctuation at its edges: for it the strip, the normalize and the letter test
// below give exactly the letters, lowercased, so they are skipped. 6223 of articulos-genero's 6225 distinct pieces are such words.
const PLAIN_PIECE = /^[¿¡"«(]*([a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+)[.,;:!?)»"…]*$/;

/** A piece of text split on whitespace and "/": edge punctuation stripped, normalized; null when it is not a word. */
function pieceToken(piece: string): Token | null {
  const plain = PLAIN_PIECE.exec(piece);
  if (plain) {
    const surface = plain[1];
    return { key: surface.toLowerCase(), surface, upper: surface.charAt(0) !== surface.charAt(0).toLowerCase() };
  }
  if (!piece || piece.includes('_')) return null;
  const surface = piece.replace(EDGE_PUNCT, '');
  if (!surface || surface.startsWith('-') || piece.startsWith('-')) return null;
  const key = normalizeWordToken(surface);
  if (!key || !/\p{L}/u.test(key)) return null;
  return { key, surface, upper: surface.charAt(0) !== surface.charAt(0).toLowerCase() };
}

/** The pieces of a text, «...» hints removed. */
const piecesOf = (text: string): string[] => (text.includes('«') ? text.replace(/«[^»]*»/g, ' ') : text).split(/[\s/]+/);

// One collator per language, built once: on Hermes (Android) `localeCompare(b, lang, options)` builds a new
// collator on every call (about 2.7 ms each on the emulator), so sorting a lesson's words with it took 4-6 s
// on every render of the lesson screen. The order is the same: localeCompare with these arguments IS this compare.
const collators = new Map<string, Intl.Collator>();
function collatorFor(lang: string): Intl.Collator {
  let c = collators.get(lang);
  if (!c) {
    c = new Intl.Collator(lang, { sensitivity: 'base' });
    collators.set(lang, c);
  }
  return c;
}

// Spanish and English have no digraph among a-z, so for a word of only these letters the code-point order of a
// folded lowercase key IS the collator's order (base sensitivity: case and accents do not count; in Spanish ñ is its
// own letter after n, so it folds to "n{", "{" being the code point after "z"). The keys sort natively, without a
// comparator: on Hermes every comparator call comes back from native code into JS, and articulos-genero's 4K words
// took 310-390 ms to sort that way on the emulator, even with cheap compares.
const PLAIN_WORD: Record<string, RegExp> = { es: /^[a-záéíóúüñ]+$/, en: /^[a-záéíóúü]+$/ };
const plainKey = (lower: string): string =>
  /[áéíóúüñ]/.test(lower)
    ? lower.replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/[úü]/g, 'u').replace(/ñ/g, 'n{')
    : lower;

/** Sorted as `Intl.Collator(learnedLang, { sensitivity: 'base' })` sorts them, in a stable sort: equal words keep their first order. */
function sortWords(words: ExerciseWord[], learnedLang: string): ExerciseWord[] {
  const collator = collatorFor(learnedLang);
  const byCollator = (a: ExerciseWord, b: ExerciseWord) => collator.compare(a.display, b.display);
  const plainWord = PLAIN_WORD[learnedLang];
  if (!plainWord) return words.sort(byCollator);
  const groups = new Map<string, ExerciseWord[]>(); // plain words by key, in their first order
  const rest: ExerciseWord[] = [];
  const firstIndex = new Map<ExerciseWord, number>();
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    firstIndex.set(word, i);
    const lower = word.display.toLowerCase();
    if (!plainWord.test(lower)) {
      rest.push(word);
      continue;
    }
    const key = plainKey(lower);
    const group = groups.get(key);
    if (group) group.push(word);
    else groups.set(key, [word]);
  }
  const plain: ExerciseWord[] = [];
  for (const key of [...groups.keys()].sort()) plain.push(...groups.get(key)!);
  if (rest.length === 0) return plain;
  // the few others (another letter, a hyphen, a digit) on the collator, then merged in; a tie goes to the earlier word
  rest.sort(byCollator);
  const out: ExerciseWord[] = [];
  let i = 0;
  let j = 0;
  while (i < plain.length && j < rest.length) {
    const c = byCollator(plain[i], rest[j]);
    out.push(c < 0 || (c === 0 && firstIndex.get(plain[i])! < firstIndex.get(rest[j])!) ? plain[i++] : rest[j++]);
  }
  return out.concat(plain.slice(i), rest.slice(j));
}

// Lessons are cached app-wide (lib/games/content.ts), so the list is computed once per lesson, language and shown texts:
// the lesson screen asks for it on every render, and articulos-genero (every noun of the app) took 1-4 s each time on the emulator.
// The count is all the closed section shows; the sorted list is made only when it is opened.
interface Entry {
  unsorted: ExerciseWord[];
  sorted?: readonly ExerciseWord[];
}
const cache = new WeakMap<LessonLike, Map<string, Entry>>();

function entryFor(lesson: LessonLike, learnedLang: string, shownTexts: string[]): Entry {
  let byArgs = cache.get(lesson);
  if (!byArgs) {
    byArgs = new Map();
    cache.set(lesson, byArgs);
  }
  const argsKey = [learnedLang, ...shownTexts].join('\u0000');
  let entry = byArgs.get(argsKey);
  if (!entry) {
    entry = { unsorted: collectExerciseWords(lesson, learnedLang, shownTexts) };
    byArgs.set(argsKey, entry);
  }
  return entry;
}

/** How many words `exerciseWords` gives, without sorting them. */
export function exerciseWordCount(lesson: LessonLike, learnedLang: string, shownTexts: string[]): number {
  return entryFor(lesson, learnedLang, shownTexts).unsorted.length;
}

/** The words of the tasks that are not in `shownTexts`, one per normalized key, sorted. Shared between calls: do not mutate. */
export function exerciseWords(lesson: LessonLike, learnedLang: string, shownTexts: string[]): readonly ExerciseWord[] {
  const entry = entryFor(lesson, learnedLang, shownTexts);
  if (!entry.sorted) {
    entry.sorted = sortWords(entry.unsorted, learnedLang);
  }
  return entry.sorted;
}

/** The words in first-seen order. */
function collectExerciseWords(lesson: LessonLike, learnedLang: string, shownTexts: string[]): ExerciseWord[] {
  const shown = new Set<string>();
  for (const text of shownTexts) {
    for (const piece of piecesOf(text)) {
      const token = pieceToken(piece);
      if (token) shown.add(token.key);
    }
  }
  // per key: the first surface form, and whether every form is capitalized (then the word keeps its capital)
  const seen = new Map<string, { first: string; allUpper: boolean }>();
  // a repeated piece changes nothing (same key, surface and case): articulos-genero has 32K pieces, 6K distinct
  const done = new Set<string>();
  for (const text of new Set(exerciseTexts(lesson, learnedLang))) {
    for (const piece of piecesOf(text)) {
      if (done.has(piece)) continue;
      done.add(piece);
      const token = pieceToken(piece);
      if (!token || shown.has(token.key)) continue;
      const entry = seen.get(token.key);
      if (!entry) seen.set(token.key, { first: token.surface, allUpper: token.upper });
      else if (!token.upper) entry.allUpper = false;
    }
  }
  const result: ExerciseWord[] = [];
  for (const [key, { first, allUpper }] of seen) result.push({ key, display: allUpper ? first : first.toLowerCase() });
  return result;
}
