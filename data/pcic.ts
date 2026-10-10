// The decks of the Anki tab: for en→es the data/words-open cards (o<order> id space), for
// es→en the data/words/en cards (e<id> id space). The PCIC corpus
// and the old Spanish word list (w<id>) are gone; the module name and API stayed because of
// their consumers (lib/pcicLevels.ts, lib/pcicSession.ts, lib/grammar/tableDeck.ts, app/(tabs)/index.tsx,
// app/onboarding.tsx, components/LevelPickerSheet.tsx, ...).

import type { Pos } from '@/lib/pcicPos';
import type { WordEntry } from '@/data/words';
// The finished, verified cards (~0 tokens) of the old English-target
// branch. Only this module imports them, with the e<id>
// id space (see itemsFromWords). A1 = a0 + a1, A2 = a2.
import enA0 from '@/data/words/en/a0.json';
import enA1 from '@/data/words/en/a1.json';
import enA2 from '@/data/words/en/a2.json';
import enB1 from '@/data/words/en/b1.json';
// the source of the en→es deck is the new 600-card
// data/words-open (o<order> id space, see itemsFromOpen).
import openA1 from '@/data/words-open/a1.json';
import openA2 from '@/data/words-open/a2.json';
import openB1 from '@/data/words-open/b1.json';
import openB2 from '@/data/words-open/b2.json';
import openC1 from '@/data/words-open/c1.json';
// hand-written (i) explanation for some cards, keyed by `o<order>`,
// in English; opened by the small (i) button of the Learn card (PcicItem.note).
import openNotes from '@/data/words-open/notes.json';
// image for some cards (Wikimedia Commons), shown under the (i) next to the explanation.
import { wordImageFor, type WordImage } from '@/data/wordImages';

export type PcicKind = 'word' | 'phrase' | 'sentence';
export type PcicLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export const PCIC_LEVELS: PcicLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

// B2 and C1 are selectable too (en→es: 763 and 259 items); in the
// es→en direction they are empty, and the level pickers skip them with the
// "0 items = not offered" filter.
export const PCIC_VIEW_LEVELS: PcicLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export interface PcicItem {
  id: string;
  es: string;
  en: string;
  kind: PcicKind;
  section: string;
  order: number;
  pos?: Pos;
  // example sentence from the corpus, only when there is a match;
  // shown in the reveal after Check.
  exampleEs?: string;
  exampleEn?: string;
  // short sentence under the question word when the question
  // has several meanings (words-open hint_en / English track hint_es); the word being
  // asked is wrapped in `*asterisks*`.
  hint?: string;
  // (i) explanation (English, short), only on the cards with a hand-written note.
  note?: string;
  // the card's image (with author and licence), only on the cards that have one.
  image?: WordImage;
}

const LEADING_ARTICLE_RE = /^(el|la|los|las|un|una)\s+/i;

// `kind`: 'phrase' if more than one word is left after stripping the article, otherwise 'word'.
// For a slash form " / " every alternative is checked
// separately ("el carro / el coche" counts as the one-word noun 'word', not 'phrase').
export function kindOfEs(es: string): PcicKind {
  const isPhrase = es.split(' / ').some((alt) => {
    const stripped = alt.trim().replace(LEADING_ARTICLE_RE, '');
    return stripped.split(/\s+/).filter(Boolean).length > 1;
  });
  return isPhrase ? 'phrase' : 'word';
}

function noteField(word: WordEntry, key: 'hint_es'): string | undefined {
  const value = word[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

// A card marked vosotros (vosotros: true) is left out, as in the grammar lessons.
// The 'e' prefix tells the id spaces of the two directions apart
// in the SHARED pcic_cards table (no pair column): en→es 'o<order>' (itemsFromOpen), es→en 'e<id>'.
function itemsFromWords(entries: WordEntry[]): PcicItem[] {
  return entries
    .filter((w) => !w.vosotros)
    .map((w, index) => ({
      id: `e${w.id}`,
      es: w.es,
      en: w.en,
      kind: kindOfEs(w.es),
      section: '',
      order: index,
      pos: w.pos,
      exampleEs: w.sentence_es,
      exampleEn: w.sentence_en,
      hint: noteField(w, 'hint_es'),
    }));
}

// from the cards of data/words-open (a1/a2/b1/b2/c1.json, A1 =
// a1.json only, there is no separate A0). Id space: o<order> (the `order` field of the file,
// 1-600), so it does not clash with the old w<id> and the es→en e<id> ids. From the
// words-open pos every part of speech passes into the app's Pos (det and interj get a chip too).
type OpenCard = { order: number; pos: string; es: string; en: string; sentence_es: string; sentence_en: string; hint_en?: string };

const OPEN_POS_TO_PCIC: Partial<Record<string, Pos>> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adj',
  adv: 'adv',
  pron: 'pron',
  prep: 'prep',
  num: 'num',
  conj: 'conj',
  det: 'det',
  interj: 'interj',
};

function itemsFromOpen(cards: OpenCard[]): PcicItem[] {
  return cards.map((c) => ({
    id: `o${c.order}`,
    es: c.es,
    en: c.en,
    kind: kindOfEs(c.es),
    section: '',
    order: c.order,
    pos: OPEN_POS_TO_PCIC[c.pos],
    exampleEs: c.sentence_es || undefined,
    exampleEn: c.sentence_en || undefined,
    hint: c.hint_en || undefined,
    note: (openNotes as Record<string, string>)[`o${c.order}`],
    image: wordImageFor(`o${c.order}`),
  }));
}

const ITEMS_BY_LEVEL_ES: Record<PcicLevel, PcicItem[]> = {
  A1: itemsFromOpen(openA1 as OpenCard[]),
  A2: itemsFromOpen(openA2 as OpenCard[]),
  B1: itemsFromOpen(openB1 as OpenCard[]),
  B2: itemsFromOpen(openB2 as OpenCard[]),
  C1: itemsFromOpen(openC1 as OpenCard[]),
};

// the es→en deck for A1 = data/words/en/a0.json +
// a1.json (there is no separate A0), A2 = a2.json (e<id> id space, the ids of the old first 50
// do not change). The same English word stays only once, at its first occurrence
// (on the lower level). B1 = en/b1.json (CEFR-J word list,
// from e10000); B2 and C1 are empty (no content for them), and the level pickers skip them with the
// "0 items = not offered" rule.
function dedupeByEn(levels: WordEntry[][]): WordEntry[][] {
  const seen = new Set<string>();
  return levels.map((entries) =>
    entries.filter((w) => {
      const key = w.en.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
}

const [EN_A1_WORDS, EN_A2_WORDS, EN_B1_WORDS] = dedupeByEn([
  [...(enA0 as WordEntry[]), ...(enA1 as WordEntry[])],
  enA2 as WordEntry[],
  enB1 as WordEntry[],
]);

const ITEMS_BY_LEVEL_EN: Record<PcicLevel, PcicItem[]> = {
  A1: itemsFromWords(EN_A1_WORDS),
  A2: itemsFromWords(EN_A2_WORDS),
  B1: itemsFromWords(EN_B1_WORDS),
  B2: [],
  C1: [],
};

// which direction's deck is active (set by app/_layout.tsx at
// startup, by app/onboarding.tsx on selection and by the direction switch row of Settings
// on switching, with the onboarding.target code: 'es' = en→es, 'en' =
// es→en). Module-level state, like activePair in lib/database.ts.
export type PcicTarget = 'es' | 'en';

let activeTarget: PcicTarget = 'es';

export function setPcicTarget(target: PcicTarget) {
  activeTarget = target;
}

export function getPcicTarget(): PcicTarget {
  return activeTarget;
}

function itemsByTarget(target: PcicTarget): Record<PcicLevel, PcicItem[]> {
  return target === 'en' ? ITEMS_BY_LEVEL_EN : ITEMS_BY_LEVEL_ES;
}

function buildIndexes(byLevel: Record<PcicLevel, PcicItem[]>) {
  const itemById = new Map<string, PcicItem>();
  const levelById = new Map<string, PcicLevel>();
  for (const level of PCIC_LEVELS) {
    for (const item of byLevel[level]) {
      itemById.set(item.id, item);
      levelById.set(item.id, level);
    }
  }
  return { itemById, levelById };
}

const INDEXES_ES = buildIndexes(ITEMS_BY_LEVEL_ES);
const INDEXES_EN = buildIndexes(ITEMS_BY_LEVEL_EN);

function indexesByTarget(target: PcicTarget) {
  return target === 'en' ? INDEXES_EN : INDEXES_ES;
}

export function pcicItemsForLevel(level: PcicLevel): PcicItem[] {
  return itemsByTarget(activeTarget)[level];
}

export function findPcicItem(id: string): PcicItem | undefined {
  return indexesByTarget(activeTarget).itemById.get(id);
}

/** The ACTUAL level of the item living in the loaded corpus, or undefined if the
 *  id is not in the corpus (e.g. an orphaned SRS row of the old PCIC corpus). */
export function levelOfItem(id: string): PcicLevel | undefined {
  return indexesByTarget(activeTarget).levelById.get(id);
}
