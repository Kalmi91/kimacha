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
import openA1 from '@/data/words-open/a1.json';
import openA2 from '@/data/words-open/a2.json';
import openB1 from '@/data/words-open/b1.json';
import openB2 from '@/data/words-open/b2.json';
import openC1 from '@/data/words-open/c1.json';

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

const FILES: OpenCard[][] = [openA1, openA2, openB1, openB2, openC1] as OpenCard[][];

export const openWords: OpenWord[] = FILES.flatMap((cards) => cards.map(toWord));

/** The level in words-open: A0 → A1, C2 → C1 (A1 is the lower, C1 the upper bound). */
export function openLevelOf(level: Level): Level {
  if (level === 'A0') return 'A1';
  if (level === 'C2') return 'C1';
  return level;
}

export function getOpenWordsForLevel(level: Level): OpenWord[] {
  return openWords.filter((w) => w.level === level);
}

/** Every card from the level (after the clamp) cumulatively back down to A1. */
export function getOpenWordsUpToLevel(level: Level): OpenWord[] {
  const idx = OPEN_LEVELS.indexOf(openLevelOf(level));
  const allowed = new Set(OPEN_LEVELS.slice(0, idx + 1));
  return openWords.filter((w) => allowed.has(w.level));
}

// Inflected form -> words-open lemma (glossary coverage, the fix after retiring
// the old word list): the old list carried the inflected forms too, words-open only the
// base form. The index is built exclusively from words-open cards (lib/esForms: for verbs the forms of the
// conjugation engine, for verbs the engine does not conjugate the broad set of stem variants, the non-finite
// forms, for nouns/adjectives the plural and the gendered form). The pronoun written onto a verb (verlo, ayúdame)
// is split off at lookup time.
const FORM_ARTICLE = /^(el|la|los|las|un|una|unos|unas)\s+/;
const FORM_DEPS = { conjugate, TENSES, esPlural, esFeminine };

let formIndex: Map<string, OpenWord> | null = null;
let foldedIndex: Map<string, OpenWord> | null = null;

const foldAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function buildFormIndex(): Map<string, OpenWord> {
  const index = new Map<string, OpenWord>();
  const folded = new Map<string, OpenWord>();
  const add = (form: string | null, card: OpenWord) => {
    const key = form?.trim().toLowerCase();
    // The first card wins, so the lower level owns a form shared by several cards.
    if (key && !index.has(key)) index.set(key, card);
    if (key && !folded.has(foldAccents(key))) folded.set(foldAccents(key), card);
  };
  for (const card of openWords) {
    for (const f of formsOfCard(card.es, card.openPos, FORM_DEPS)) add(f, card);
    // the pronoun written onto the verb has to be cut off the infinitive too (verlo): the head word also goes into the accent-free index
    if (card.openPos === 'verb') for (const alt of card.es.split(' / ')) add(alt, card);
  }
  foldedIndex = folded;
  return index;
}

/** The words-open card of an inflected, plural or gendered form (the caller has already looked up the base form); Spanish only. */
export function findOpenWordByForm(norm: string): OpenWord | undefined {
  if (!formIndex) formIndex = buildFormIndex();
  const direct = formIndex.get(norm) ?? formIndex.get(norm.replace(FORM_ARTICLE, ''));
  if (direct) return direct;
  // verlo, ayúdame, repetirlo: the base verb form without the pronoun (looked up without accents)
  for (const base of encliticBases(norm)) {
    const hit = foldedIndex?.get(foldAccents(base));
    if (hit && hit.openPos === 'verb') return hit;
  }
  return undefined;
}
