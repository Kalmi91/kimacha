export type Level = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const LEVELS: Level[] = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// GAMES.md F-1 (K6 DÖNTÉS, 2026-08-26): word-class metadata for the game
// modules (bubble-pop, odd-one-out, ...). Annotated by scripts/annotate-pos.mjs
// on the shared Spanish set (a0..c1) and the en/hu branches; c2.json is frozen
// and intentionally left without this metadata. Both fields are optional so
// older/unannotated entries (and the frozen c2 set) keep type-checking.
export type WordPos = 'noun' | 'verb' | 'adj' | 'adv' | 'pron' | 'prep' | 'num' | 'phrase';
export type WordGender = 'm' | 'f' | 'mf' | 'n' | '-';

// PROMPT-POLICY 6: egy szó, ami csak Mexikóban él (ahorita, chido...), a
// kártyán zászló-emojival jelzi, melyik országban használják. Mező nélkül =
// spanyolországi, zászló nélkül (alapértelmezett).
export type WordRegion = 'mx' | 'es';

// PROMPT-POLICY 7: külön kártya csak akkor jár egy szónak, ha rendhagyó a
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
  // FB357 (grammar:indefinido-10-verbos:drill): a lecke szűri ki a szót a
  // fókusz-módból/lessonWordIds()-ból/témakör-szószámból (getWordsForTopic
  // alapból), a kártya maga marad, haladás nem vész el.
  vosotros?: boolean;
  [key: string]: string | number | boolean | undefined;
}

import a0 from './words/a0.json';
import a1 from './words/a1.json';
import a2 from './words/a2.json';
import b1 from './words/b1.json';
import b2 from './words/b2.json';
import c1 from './words/c1.json';
import c2 from './words/c2.json';

export const words: WordEntry[] = [...a0, ...a1, ...a2, ...b1, ...b2, ...c1, ...c2] as WordEntry[];

// Play-vágás 7. lépés (2026-09-23): the app runs a single en-es pair, target
// always 'es', so the dedicated English-target/Hungarian-target word sets
// (the `en` and `hu` subfolders next to these files) are unreachable and
// dropped from this loader. The JSON files stay in the repo. `lang` is kept
// on every function below only so call sites (which pass the active pair's
// target, always 'es' now) don't need to change.
export function getWordsForLevel(level: Level, lang: string = 'es'): WordEntry[] {
  return words.filter(w => w.level === level);
}

// Card rows in the DB only carry a word id, looked up in the shared Spanish
// set (the only one this loader carries any more, see the note above).
export function findWordById(id: number, lang: string = 'es'): WordEntry | undefined {
  return words.find(w => w.id === id);
}

// FB357: `includeVosotros` defaults to false, so every existing caller (the
// grammar lesson's word-halmaz, the Learn tab's tree-tile/mastery counts)
// automatically drops the vosotros-flagged cards without a call-site change.
export function getWordsForTopic(level: Level, topicId: string, lang: string = 'es', includeVosotros: boolean = false): WordEntry[] {
  return getWordsForLevel(level, lang)
    .filter(w => w['topic'] === topicId && (includeVosotros || !w.vosotros))
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
  return words;
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
    // FB273: a ragozott-alak kártya feje „hagan (hacer)", a mondatban „hagan"
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
