// The German target deck (data/words/de: A1 - C1) in WordEntry shape, and the word lookup of the German course lessons
// (data/words.ts findWordByText, learned language 'de'): tapping a word of a lesson sentence finds its card, an inflected
// form (verb forms, plurals, adjective endings) included, the way the Spanish lookup does through lib/esForms.ts.
// The JSON files are required on the first call, not at import time.
// (Type-only import from words.ts: words.ts imports this module.)

import type { WordEntry } from '@/data/words';
import { germanEntryForms } from '@/lib/deEntryForms';
import { SPECIAL_VERBS } from '@/lib/deIrregularForms';
import { normalizeWordToken } from './wordToken';

let deWords: WordEntry[] | null = null;

/** Every card of the German deck: `de` is the headword, `es` / `en` / `hu` its meaning in the learner's language. */
export function getDeWords(): WordEntry[] {
  if (!deWords) {
    const files: WordEntry[][] = [
      require('@/data/words/de/a1.json'),
      require('@/data/words/de/a2.json'),
      require('@/data/words/de/b1.json'),
      require('@/data/words/de/b2.json'),
      require('@/data/words/de/c1.json'),
    ];
    deWords = files.flat();
  }
  return deWords;
}

// The finite forms of sein, haben, werden, tun, wissen and the modals (ist, hat, kann ...).
const IRREGULAR_FORMS: ReadonlySet<string> = new Set([...SPECIAL_VERBS.values()].flatMap((verb) => [...verb.praes, ...verb.prat]));

// A headword carries an article, a reflexive pronoun or a gloss that a running sentence does not.
const DE_ARTICLE_HEAD = /^(?:der\/die|der|die|das|ein|eine|sich)\s+/;

/** The keys a headword is tapped under: each alternative of "x / y", with and without its article and its bracketed gloss. */
function headKeys(headword: string): string[] {
  const keys: string[] = [];
  for (const part of headword.split(' / ')) {
    const head = normalizeWordToken(part.replace(/\([^)]*\)/g, ' '));
    if (!head) continue;
    keys.push(head);
    const bare = head.replace(DE_ARTICLE_HEAD, '');
    if (bare && bare !== head) keys.push(bare);
  }
  return keys;
}

interface DeLookup {
  /** key -> card, the lowest level first (a card's own headword before an inflected form of another card). */
  all: Map<string, WordEntry>;
  /** The same for the noun cards only, and for every other card: a German noun is capitalised, which tells the two apart. */
  nouns: Map<string, WordEntry>;
  others: Map<string, WordEntry>;
  /** "form>prefix" -> the separable verb ("stehe>auf" -> aufstehen). */
  split: Map<string, WordEntry>;
}

let lookup: DeLookup | null = null;

function deLookup(): DeLookup {
  if (lookup) return lookup;
  const all = new Map<string, WordEntry>();
  const nouns = new Map<string, WordEntry>();
  const others = new Map<string, WordEntry>();
  const split = new Map<string, WordEntry>();
  const put = (key: string, card: WordEntry) => {
    if (!all.has(key)) all.set(key, card);
    const part = card.pos === 'noun' ? nouns : others;
    if (!part.has(key)) part.set(key, card);
  };
  const cards = getDeWords().filter((card) => typeof card.de === 'string');
  // 1. the headwords: a card is found by its own word first ("heiß" is the adjective, not the imperative of "heißen"). A verb or
  //    phrase card that lists a form of sein, haben, werden, a modal ... as a headword ("es gibt / ist") waits for the last
  //    turn: "ist" belongs to "sein".
  const late: [string, WordEntry][] = [];
  for (const card of cards) {
    for (const alt of (card.de as string).split(' / ')) {
      const conjugated = (card.pos === 'verb' || card.pos === 'phrase') && IRREGULAR_FORMS.has(alt.trim());
      for (const key of headKeys(alt)) {
        if (conjugated) late.push([key, card]);
        else put(key, card);
      }
    }
  }
  // 2. the inflected forms. Only the alternatives that are one word give their forms: the forms of a phrase belong to the phrase,
  //    not to its last word ("an der Spitze stehen" is no card for "steht", "müde werden" none for "wird").
  const simpleWord = /^(?:(?:der\/die|der|die|das|ein|eine|sich) )?[^\s()]+$/;
  for (const card of cards) {
    for (const alt of (card.de as string).split(' / ')) {
      if (!simpleWord.test(alt.replace(/\([^)]*\)/g, ' ').trim())) continue;
      const forms = germanEntryForms({ text: alt, pos: card.pos }, 'C1');
      for (const form of forms.plain) put(form, card);
      for (const { form, prefix } of forms.split) if (!split.has(`${form}>${prefix}`)) split.set(`${form}>${prefix}`, card);
    }
  }
  for (const [key, card] of late) put(key, card);
  lookup = { all, nouns, others, split };
  return lookup;
}

/**
 * The card of a tapped German word: its headword (with or without the article) or an inflected form of it. A word that is not
 * in the deck finds nothing. A capital letter means a noun (German capitalises nouns), a small letter never does, so
 * "Essen" is the food and "essen" the verb; the first letter of a sentence is the one doubtful case and falls back to the
 * other reading.
 */
export function findDeWord(token: string): WordEntry | undefined {
  const key = normalizeWordToken(token);
  if (!key) return undefined;
  const { all, nouns, others } = deLookup();
  const first = token.replace(/^[^\p{L}]+/u, '').charAt(0);
  const capital = first !== '' && first !== first.toLowerCase();
  return (capital ? nouns : others).get(key) ?? all.get(key);
}

/** The separable verb whose finite form `form` and detached prefix `prefix` (both normalised) a sentence shows: "stehe" + "auf". */
export function findDeSplitVerb(form: string, prefix: string): WordEntry | undefined {
  return deLookup().split.get(`${form}>${prefix}`);
}
