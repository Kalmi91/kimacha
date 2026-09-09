export type Level = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const LEVELS: Level[] = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// GAMES.md F-1 (K6 DÖNTÉS, 2026-08-26): word-class metadata for the game
// modules (bubble-pop, odd-one-out, ...). Annotated by scripts/annotate-pos.mjs
// on the shared Spanish set (a0..c1) and the en/hu branches; c2.json is frozen
// and intentionally left without this metadata. Both fields are optional so
// older/unannotated entries (and the frozen c2 set) keep type-checking.
export type WordPos = 'noun' | 'verb' | 'adj' | 'adv' | 'pron' | 'prep' | 'num' | 'phrase';
export type WordGender = 'm' | 'f' | 'mf' | 'n' | '-';

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
  [key: string]: string | number | undefined;
}

import a0 from './words/a0.json';
import a1 from './words/a1.json';
import a2 from './words/a2.json';
import b1 from './words/b1.json';
import b2 from './words/b2.json';
import c1 from './words/c1.json';
import c2 from './words/c2.json';

import en_a0 from './words/en/a0.json';
import en_a1 from './words/en/a1.json';
import en_a2 from './words/en/a2.json';
import hu_a0 from './words/hu/a0.json';
import hu_a1 from './words/hu/a1.json';

export const words: WordEntry[] = [...a0, ...a1, ...a2, ...b1, ...b2, ...c1, ...c2] as WordEntry[];

// Dedicated English-target word sets, keyed by level. Only levels with authored
// English content appear here; every other (level, lang) falls back to the shared
// Spanish-headword set above. So `lang` defaults to 'es' and existing callers are
// unchanged, only an explicit lang==='en' with English content diverges.
const enWordsByLevel: Partial<Record<Level, WordEntry[]>> = {
  A0: en_a0 as WordEntry[],
  A1: en_a1 as WordEntry[],
  A2: en_a2 as WordEntry[],
};
const huWordsByLevel: Partial<Record<Level, WordEntry[]>> = {
  A0: hu_a0 as WordEntry[],
  A1: hu_a1 as WordEntry[],
};

export function getWordsForLevel(level: Level, lang: string = 'es'): WordEntry[] {
  if (lang === 'en' && enWordsByLevel[level]) return enWordsByLevel[level]!;
  if (lang === 'hu' && huWordsByLevel[level]) return huWordsByLevel[level]!;
  return words.filter(w => w.level === level);
}

// Card rows in the DB only carry a word id, and the id spaces of the branches are
// disjoint by construction (shared Spanish set <= 3007, English track from 5001,
// Hungarian track from 6001). Look the id up in the branch that is being learned
// first, then in the shared set. Resolving against the shared set alone dropped
// every card of a non-Spanish course, which left the learner on the Done screen
// with an empty queue (FB129 second cause).
const branchIndex: Partial<Record<string, Map<number, WordEntry>>> = {};

function indexFor(lang: string): Map<number, WordEntry> | undefined {
  const byLevel = lang === 'en' ? enWordsByLevel : lang === 'hu' ? huWordsByLevel : null;
  if (!byLevel) return undefined;
  if (!branchIndex[lang]) {
    const map = new Map<number, WordEntry>();
    for (const list of Object.values(byLevel)) {
      for (const w of list ?? []) map.set(w.id, w);
    }
    branchIndex[lang] = map;
  }
  return branchIndex[lang];
}

export function findWordById(id: number, lang: string = 'es'): WordEntry | undefined {
  return indexFor(lang)?.get(id) ?? words.find(w => w.id === id);
}

export function getWordsForTopic(level: Level, topicId: string, lang: string = 'es'): WordEntry[] {
  return getWordsForLevel(level, lang)
    .filter(w => w['topic'] === topicId)
    .sort((a, b) => (Number(a['topicOrder']) || 0) - (Number(b['topicOrder']) || 0));
}

export function getWordTopic(w: WordEntry): string | undefined {
  const t = w['topic'];
  return typeof t === 'string' ? t : undefined;
}

// The `gender` field annotated by scripts/annotate-pos.mjs is the gender of the
// SPANISH headword ("a só" carries 'f' from "la sal"), so it is simply wrong for
// any other target: German "das Salz" is neuter, and Spanish has no neuter at
// all. German writes the gender on the article the headword already carries, so
// read it from there rather than annotate a second field. Targets with no gender
// to teach (en, hu) return undefined, which starves the games' gender category
// and drops it, exactly as an unannotated word already does.
const DE_ARTICLE_GENDER: Record<string, WordGender> = { der: 'm', die: 'f', das: 'n' };

// "die" is also the plural article for every gender ("die Eltern"), so it only
// means feminine on a SINGULAR headword. The shared set carries the Spanish
// headword next to the German one, and its article says which it is: los/las
// mark the plural, so "die" beside them is a plural, not a feminine.
const ES_PLURAL_ARTICLE = /^(los|las)\s/;

export function genderOf(word: WordEntry | undefined, targetLang: string): WordGender | undefined {
  if (!word) return undefined;
  if (targetLang === 'es') return word.gender;
  if (targetLang === 'de') {
    const head = String(word.de ?? '').trim().toLowerCase();
    const article = head.split(/\s+/)[0];
    const gender = DE_ARTICLE_GENDER[article];
    if (gender === 'f' && ES_PLURAL_ARTICLE.test(String(word.es ?? '').trim().toLowerCase())) {
      return undefined;
    }
    return gender;
  }
  return undefined;
}

// FB150, Kálmán 2026-08-22 (`sentence:El calabacín es una verdura verde.`):
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

function allWordsFor(lang: string): WordEntry[] {
  const byLevel = lang === 'en' ? enWordsByLevel : lang === 'hu' ? huWordsByLevel : null;
  if (!byLevel) return words;
  return Object.values(byLevel).flatMap(list => list ?? []);
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
  }
  return keys;
}

const textIndex: Record<string, Map<string, WordEntry>> = {};

function textIndexFor(lang: string, field: string): Map<string, WordEntry> {
  const cacheKey = `${lang}|${field}`;
  if (!textIndex[cacheKey]) {
    const map = new Map<string, WordEntry>();
    for (const w of allWordsFor(lang)) {
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
// `lang` the branch being learned, the same branch convention findWordById uses.
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
  return undefined;
}
