export type Level = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const LEVELS: Level[] = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// F-1 (K6 DECISION, 2026-08-26): word-class metadata for the game
// modules (bubble-pop, odd-one-out, ...). Both fields are optional so
// unannotated entries (e.g. the words-open conj/det/interj cards) keep type-checking.
export type WordPos = 'noun' | 'verb' | 'adj' | 'adv' | 'pron' | 'prep' | 'num' | 'phrase';
export type WordGender = 'm' | 'f' | 'mf' | 'n' | '-';

// a word that lives only in Mexico (ahorita, chido...) is
// marked on the card with a flag emoji showing which country uses it. No field =
// from Spain, no flag (the default).
export type WordRegion = 'mx' | 'es';

// a word gets a separate card only if its
// plural is irregular (el lápiz -> los lápices) or the word exists only in the plural (las gafas).
// In that case a pictogram label on the card shows why it is asked separately.
export type WordPlural = 'irregular' | 'only';

// Issue #3, section 4: the fields are REQUIRED, but every word file comes in with an
// `as WordEntry[]` cast, so the compiler does not see when an entry lacks
// one of them. An incomplete band entry would then show up only at runtime, as an empty
// card. The cast cannot be removed (the structure of the JSON modules is wider than
// the hand-written type), so the promise is kept by a TEST: the
// `lib/__tests__/corpusIntegrity.test.ts` case "every corpus entry carries…" checks
// it for every corpus. A new language band takes on the same: today's
// Spanish and English sets both carry both surface languages.
export interface WordEntry {
  id: number;
  level: Level;
  es: string;
  en: string;
  sentence_es: string;
  sentence_en: string;
  pos?: WordPos;
  gender?: WordGender;
  region?: WordRegion;
  plural?: WordPlural;
  // indefinido-10-verbos drill: the lesson filters the word out of the
  // focus mode/lessonWordIds(), the card itself stays, no progress is lost.
  vosotros?: boolean;
  [key: string]: string | number | boolean | undefined;
}

import { findOpenWordByForm, openWords } from './openWords';

// User feedback (`sentence:El calabacín es una verdura verde.`), translated from Hungarian:
// "if I tap ... on calabacín or on courset ... put it among the
// words where I can practise their spelling".
// A tap lands on a token of running text, the spelling list stores word ids, so
// the token has to find its card. Matching forgives what running text adds
// (case, punctuation) and what a headword carries (its article), but never the
// accents: those ARE the spelling being practised.
const TOKEN_PUNCTUATION = /[¿?¡!.,;:«»"'“”‘’()…\-–—]/g;
const LEADING_ARTICLE = /^(el|la|los|las|un|una|unos|unas|the|a|an|to|der|die|das|ein|eine|az|egy)\s+/;

export function normalizeWordToken(raw: string): string {
  return raw.toLowerCase().replace(TOKEN_PUNCTUATION, '').replace(/\s+/g, ' ').trim();
}

// the lookup by text (glossary, mixed read-aloud)
// runs on the words-open cards (data/openWords.ts), not on the old word list.
function allWordsFor(): WordEntry[] {
  return openWords;
}

// A headword field can carry several glosses ("the lorry / the truck"), and each
// of them is a legitimate tap target, with and without its article.
function textKeysOf(value: string): string[] {
  const keys: string[] = [];
  for (const part of value.split(' / ')) {
    const norm = normalizeWordToken(part);
    if (!norm) continue;
    keys.push(norm);
    const bare = norm.replace(LEADING_ARTICLE, '');
    if (bare && bare !== norm) keys.push(bare);
    // the card head of an inflected form is "hagan (hacer)", the sentence has "hagan",
    // so the form before the parenthesis is a key on its own too.
    if (part.includes('(')) {
      const head = normalizeWordToken(part.replace(/\([^)]*\)/g, ' '));
      if (head && head !== norm) keys.push(head);
    }
  }
  return keys;
}

const textIndex: Record<string, Map<string, WordEntry>> = {};

function textIndexFor(lang: string, field: string): Map<string, WordEntry> {
  const cacheKey = `${lang}|${field}`;
  if (!textIndex[cacheKey]) {
    const map = new Map<string, WordEntry>();
    for (const w of allWordsFor()) {
      const value = w[field];
      if (typeof value !== 'string') continue;
      // First card wins, so the lowest level owns a word shared by several cards.
      for (const key of textKeysOf(value)) if (!map.has(key)) map.set(key, w);
    }
    textIndex[cacheKey] = map;
  }
  return textIndex[cacheKey];
}

// `field` is the language the tapped text is written in ('es', 'en'),
// `lang` the branch being learned (kept so the call sites need no change; the words-open deck is the only source).
export function findWordByText(token: string, field: string, lang: string = 'es'): WordEntry | undefined {
  const norm = normalizeWordToken(token);
  if (!norm) return undefined;
  const map = textIndexFor(lang, field);
  const direct = map.get(norm) ?? map.get(norm.replace(LEADING_ARTICLE, ''));
  if (direct) return direct;
  // A sentence writes "hablas", the card is headed "tú hablas": a token that is
  // the last word of a multi-word headword still belongs to that card.
  for (const [key, entry] of map) {
    if (key.endsWith(` ${norm}`)) return entry;
  }
  // An inflected/plural/gendered form belongs to the base-form words-open card (Spanish only).
  if (field === 'es') return findOpenWordByForm(norm);
  return undefined;
}
