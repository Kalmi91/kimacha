// The single source of the Spanish words is
// data/words-open (A1-C1). The cards come in the shape of the old `WordEntry`
// (id = the card's `order`, 1-601), so that the lookups and their callers (glossary,
// mixed read-aloud, part-of-speech index, verb-form map) live on with an unchanged signature.
// words-open has no `id`, `gender` and A0/C2 levels: the gender comes from the article
// (the old annotating script took it from the article too), the edge levels
// fall onto A1 and C1 (see openLevelOf, the same rule as PCIC_LEVEL_CEILING of tableDeck).

import type { Level, WordEntry, WordGender, WordPos } from '@/data/words';
import { encliticBases, formsOfCard } from '@/lib/esForms';
import { esFeminine, esPlural } from '@/lib/esInflect';
import { conjugate, TENSES } from '@/lib/games/conjugate';

interface OpenCard {
  order: number;
  level: string;
  pos: string;
  lemma: string;
  es: string;
  en: string;
  sentence_es: string;
  sentence_en: string;
  hint_en?: string;
}

/** A words-open card in WordEntry shape; `openPos` is the raw part of speech of words-open (conj, det, interj too). */
type OpenWord = WordEntry & { lemma: string; openPos: string };

const OPEN_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

// The parts of speech that fall into WordPos; conj/det/interj cannot be mapped, those cards stay without `pos`.
const OPEN_POS_TO_WORD_POS: Record<string, WordPos> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adj',
  adv: 'adv',
  pron: 'pron',
  prep: 'prep',
  num: 'num',
};

const ARTICLE_GENDER: Record<string, WordGender> = { el: 'm', los: 'm', la: 'f', las: 'f' };

function genderFromArticle(es: string): WordGender | undefined {
  return ARTICLE_GENDER[es.trim().toLowerCase().split(/\s+/)[0]];
}

function toWord(c: OpenCard): OpenWord {
  const pos = OPEN_POS_TO_WORD_POS[c.pos];
  const word: OpenWord = {
    id: c.order,
    level: c.level as Level,
    es: c.es,
    en: c.en,
    sentence_es: c.sentence_es,
    sentence_en: c.sentence_en,
    lemma: c.lemma,
    openPos: c.pos,
  };
  if (pos) word.pos = pos;
  if (c.pos === 'noun') {
    const gender = genderFromArticle(c.es);
    if (gender) word.gender = gender;
  }
  return word;
}

let openWords: OpenWord[] | null = null;

/**
 * Every words-open card in WordEntry shape, A1 to C1. The five JSON files are required on the
 * first call (not at import time), so a module or test that never needs the words never parses them.
 */
export function getOpenWords(): OpenWord[] {
  if (!openWords) {
    const files: OpenCard[][] = [
      require('@/data/words-open/a1.json'),
      require('@/data/words-open/a2.json'),
      require('@/data/words-open/b1.json'),
      require('@/data/words-open/b2.json'),
      require('@/data/words-open/c1.json'),
    ];
    openWords = files.flatMap((cards) => cards.map(toWord));
  }
  return openWords;
}

/** The level in words-open: A0 → A1, C2 → C1 (A1 is the lower, C1 the upper bound). */
export function openLevelOf(level: Level): Level {
  if (level === 'A0') return 'A1';
  if (level === 'C2') return 'C1';
  return level;
}

export function getOpenWordsForLevel(level: Level): OpenWord[] {
  return getOpenWords().filter((w) => w.level === level);
}

/** Every card from the level (after the clamp) cumulatively back down to A1. */
export function getOpenWordsUpToLevel(level: Level): OpenWord[] {
  const idx = OPEN_LEVELS.indexOf(openLevelOf(level));
  const allowed = new Set(OPEN_LEVELS.slice(0, idx + 1));
  return getOpenWords().filter((w) => allowed.has(w.level));
}

// Inflected form -> words-open lemma (glossary coverage, the fix after retiring
// the old word list): the old list carried the inflected forms too, words-open only the
// base form. The index is built exclusively from words-open cards (lib/esForms: for verbs the forms of the
// conjugation engine, for verbs the engine does not conjugate the broad set of stem variants, the non-finite
// forms, for nouns/adjectives the plural and the gendered form). The pronoun written onto a verb (verlo, ayúdame)
// is split off at lookup time.
const FORM_ARTICLE = /^(el|la|los|las|un|una|unos|unas)\s+/;
const FORM_DEPS = { conjugate, TENSES, esPlural, esFeminine };

// Accents dropped (NFD, combining marks removed). On Hermes (Android) `normalize` goes through the platform, about 15 µs a call
// on the emulator, and the index folds every form (141K): that took seconds at the app's first gloss lookup (a grammar lesson
// opening). So the Spanish letters fold from a table, an ASCII string is left as it is, and only another character is normalized.
const FOLD: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ä: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', ö: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u', ñ: 'n', ç: 'c',
};
const NON_ASCII = /[\u0080-\u{10ffff}]/u;
const NON_ASCII_ALL = /[\u0080-\u{10ffff}]/gu;
const foldChar = (c: string) => FOLD[c] ?? c.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const foldAccents = (s: string): string => (NON_ASCII.test(s) ? s.replace(NON_ASCII_ALL, foldChar) : s);

// The index grows a slice of cards at a time, in card order, only as far as a lookup needs, so the first card still wins. The
// worked examples of a lesson mostly hit an A1 card: a lesson opening indexes a few hundred cards, not all 4683 (141K forms, about
// 0.8 s on the emulator). A form no card has, and the pronoun lookup, still index every card.
const SLICE = 256;
const formIndex = new Map<string, OpenWord>();
let indexedCards = 0;
let foldedIndex: Map<string, OpenWord> | null = null;

function indexNextSlice(cards: readonly OpenWord[]): void {
  const add = (form: string | null, card: OpenWord) => {
    const key = form?.trim().toLowerCase();
    // The first card wins, so the lower level owns a form shared by several cards.
    if (key && !formIndex.has(key)) formIndex.set(key, card);
  };
  const end = Math.min(indexedCards + SLICE, cards.length);
  for (let i = indexedCards; i < end; i++) {
    const card = cards[i];
    for (const f of formsOfCard(card.es, card.openPos, FORM_DEPS)) add(f, card);
    // the pronoun written onto the verb has to be cut off the infinitive too (verlo): the head word also goes into the accent-free index
    if (card.openPos === 'verb') for (const alt of card.es.split(' / ')) add(alt, card);
  }
  indexedCards = end;
}

/** The card of an indexed form; indexes further slices until it is found or every card is in. */
function lookupForm(key: string): OpenWord | undefined {
  const cards = getOpenWords();
  for (;;) {
    const hit = formIndex.get(key);
    if (hit || indexedCards >= cards.length) return hit;
    indexNextSlice(cards);
  }
}

// The accent-free index of the pronoun lookup (verlo, ayúdame), built from the form index on the first such lookup: a gloss
// lookup mostly ends before it. Walking the index in insertion order keeps the first card of every folded key, as before.
function getFoldedIndex(index: Map<string, OpenWord>): Map<string, OpenWord> {
  if (!foldedIndex) {
    foldedIndex = new Map();
    for (const [key, card] of index) {
      const fold = foldAccents(key);
      if (!foldedIndex.has(fold)) foldedIndex.set(fold, card);
    }
  }
  return foldedIndex;
}

/** The words-open card of an inflected, plural or gendered form (the caller has already looked up the base form); Spanish only. */
export function findOpenWordByForm(norm: string): OpenWord | undefined {
  // a miss of the first lookup has indexed every card, so the second one and the pronoun lookup see the whole index
  const direct = lookupForm(norm) ?? lookupForm(norm.replace(FORM_ARTICLE, ''));
  if (direct) return direct;
  // verlo, ayúdame, repetirlo: the base verb form without the pronoun (looked up without accents)
  const bases = encliticBases(norm);
  if (bases.length === 0) return undefined;
  const folded = getFoldedIndex(formIndex);
  for (const base of bases) {
    const hit = folded.get(foldAccents(base));
    if (hit && hit.openPos === 'verb') return hit;
  }
  return undefined;
}
