export type Level = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const LEVELS: Level[] = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// F-1 (K6 DÖNTÉS, 2026-08-26): word-class metadata for the game
// modules (bubble-pop, odd-one-out, ...). Both fields are optional so
// unannotated entries (e.g. the words-open conj/det/interj cards) keep type-checking.
export type WordPos = 'noun' | 'verb' | 'adj' | 'adv' | 'pron' | 'prep' | 'num' | 'phrase';
export type WordGender = 'm' | 'f' | 'mf' | 'n' | '-';

// egy szó, ami csak Mexikóban él (ahorita, chido...), a
// kártyán zászló-emojival jelzi, melyik országban használják. Mező nélkül =
// spanyolországi, zászló nélkül (alapértelmezett).
export type WordRegion = 'mx' | 'es';

// külön kártya csak akkor jár egy szónak, ha rendhagyó a
// többese (el lápiz -> los lápices) vagy a szó csak többesben él (las gafas).
// Ilyenkor a kártyán egy piktogram-címke jelzi, miért kérdezik külön.
export type WordPlural = 'irregular' | 'only';

// Issue #3, 4. szakasz: a mezők KÖTELEZŐEK, de minden szófájl `as WordEntry[]`
// cast-tal jön be, ezért a fordító nem látja, ha egy bejegyzésből hiányzik
// valamelyik. Egy hiányos sáv-bejegyzés így csak futásidőben bukna ki, üres
// kártyaként. A cast nem tüntethető el (a JSON-modulok szerkezete tágabb, mint
// a kézzel írt típus), ezért az ígéretet TESZT tartja: a
// `lib/__tests__/corpusIntegrity.test.ts` „every corpus entry carries…" esete
// minden korpuszra ellenőrzi. Egy új nyelvi sáv ugyanezt vállalja: a mai
// spanyol, angol és magyar készlet mind a négy felszíni nyelvet hordozza.
export interface WordEntry {
  id: number;
  level: Level;
  es: string;
  hu: string;
  en: string;
  de: string;
  sentence_es: string;
  sentence_hu: string;
  sentence_en: string;
  sentence_de: string;
  pos?: WordPos;
  gender?: WordGender;
  region?: WordRegion;
  plural?: WordPlural;
  // indefinido-10-verbos drill: a lecke szűri ki a szót a
  // fókusz-módból/lessonWordIds()-ból, a kártya maga marad, haladás nem vész el.
  vosotros?: boolean;
  [key: string]: string | number | boolean | undefined;
}

import { findOpenWordByForm, openWords } from './openWords';

// User feedback (`sentence:El calabacín es una verdura verde.`):
// "ha rákattintok ... akár arra hogy calabacín akár arra hogy courset ... bele
// tegye az olyan szavak közé, ahol ezeknek a helyesírását tudom gyakorolni".
// A tap lands on a token of running text, the spelling list stores word ids, so
// the token has to find its card. Matching forgives what running text adds
// (case, punctuation) and what a headword carries (its article), but never the
// accents: those ARE the spelling being practised.
const TOKEN_PUNCTUATION = /[¿?¡!.,;:«»"'“”‘’()…\-–—]/g;
const LEADING_ARTICLE = /^(el|la|los|las|un|una|unos|unas|the|a|an|to|der|die|das|ein|eine|az|egy)\s+/;

export function normalizeWordToken(raw: string): string {
  return raw.toLowerCase().replace(TOKEN_PUNCTUATION, '').replace(/\s+/g, ' ').trim();
}

// a szöveg szerinti keresés (glossza, kevert felolvasás)
// a words-open kártyáin fut (data/openWords.ts), nem a régi szólistán.
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
    // a ragozott-alak kártya feje „hagan (hacer)", a mondatban „hagan"
    // áll, tehát a zárójel előtti alak önmagában is kulcs.
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

// `field` is the language the tapped text is written in ('es', 'en', 'hu', 'de'),
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
  // A ragozott/többes/nemi alak a words-open tőalakú kártyájához tartozik (csak spanyol).
  if (field === 'es') return findOpenWordByForm(norm);
  return undefined;
}
