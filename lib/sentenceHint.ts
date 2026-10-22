// "Tap a word" hint of the Sentences tab (spec BRIEF-B3, beta sentenceHint): the words of the ENGLISH prompt that are the
// gloss of one of the Spanish sentence's lemmas can be tapped; the tap shows the Spanish form from the sentence (or the
// lemma when the sentence's words do not line up with its lemma list). Pure logic over words-open data, no screen code.
//
// Data (data/words-open): each card has `lemma`, `en` (the English gloss of the lemma) and, for its example sentence,
// `sentence_lemmas` (one lemma per word of `sentence_es`, 1:1 like lib/practice/gapFill.ts relies on). A gloss may list
// alternatives ("well, fine", "to want, to love (someone)"): each alternative is matched on its own. Only the Spanish
// direction (the English deck has no lemma data) and only corpus sentences (a mistake sentence is the learner's own).
//
// A word that was looked at earns no half and no XP in this round (Kálmán 2a): `ids` of a hint are the learned cards
// that own the Spanish word; the screen keeps them in the round (lib/sentenceRound.ts `hinted`).

import openA1 from '@/data/words-open/a1.json';
import openA2 from '@/data/words-open/a2.json';
import openB1 from '@/data/words-open/b1.json';
import openB2 from '@/data/words-open/b2.json';
import openC1 from '@/data/words-open/c1.json';
import { openGapInfo } from '@/lib/practice/gapFill';
import type { SentenceEntry } from '@/lib/sentenceTab';

export interface SentenceHint {
  /** The 0-based place of this word among the words of the English sentence (the tap target's testID). */
  index: number;
  /** What the bubble shows: the Spanish form in the sentence, or the lemma. */
  es: string;
  lemma: string;
  /** The learned cards that own the Spanish word: they get no credit this round once the hint was looked at. */
  ids: string[];
}

/** A piece of the English sentence as drawn: a word that can be tapped (`hint`), or a word / punctuation / space as it is. */
export interface HintPiece {
  text: string;
  hint?: SentenceHint;
}

/** Where the hints get their data from (the words-open files in the app; a fake one in tests). */
export interface HintLookup {
  /** One lemma per word of the entry's Spanish sentence; undefined = no lemma data for it. */
  sentenceLemmas(itemId: string): readonly string[] | undefined;
  /** The English glosses of a lemma (a lemma on several cards has several). */
  glosses(lemma: string): readonly string[];
  /** The lemma of a learned card, when known. */
  cardLemma(cardId: string): string | undefined;
}

type OpenCard = { lemma?: string; en?: string };

let glossIndex: Map<string, string[]> | null = null;

function openGlosses(lemma: string): readonly string[] {
  if (!glossIndex) {
    glossIndex = new Map();
    for (const file of [openA1, openA2, openB1, openB2, openC1] as OpenCard[][]) {
      for (const c of file) {
        if (!c.lemma || !c.en) continue;
        const list = glossIndex.get(c.lemma);
        if (list) list.push(c.en);
        else glossIndex.set(c.lemma, [c.en]);
      }
    }
  }
  return glossIndex.get(lemma) ?? [];
}

export const openHintLookup: HintLookup = {
  sentenceLemmas: (itemId) => openGapInfo(itemId)?.sentenceLemmas,
  glosses: openGlosses,
  cardLemma: (cardId) => openGapInfo(cardId)?.lemma,
};

const EN_WORD = /[A-Za-z0-9À-ɏ’']+/g;
const ES_WORD = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g;
const LEADING_FILLER = new Set(['to', 'the', 'a', 'an']);

/** A word the way the matching compares it: lowercase, curly apostrophe straightened, edge apostrophes cut. */
const norm = (word: string): string => word.toLowerCase().replace(/’/g, "'").replace(/^'+|'+$/g, '');

/**
 * The word sequences a gloss stands for: alternatives split at "," ";" "/", notes in parentheses dropped, lowercase,
 * no punctuation, a leading "to " / "the " / "a " / "an " cut (only when a word is left). "to want, to love (someone)" ->
 * [want], [love]; "thank you" -> [thank, you].
 */
export function glossForms(gloss: string): string[][] {
  const forms: string[][] = [];
  for (const alt of gloss.replace(/\([^)]*\)/g, ' ').split(/[,;/]/)) {
    let words = [...alt.matchAll(EN_WORD)].map((m) => norm(m[0])).filter(Boolean);
    if (words.length > 1 && LEADING_FILLER.has(words[0])) words = words.slice(1);
    if (words.length > 0 && !forms.some((f) => f.join(' ') === words.join(' '))) forms.push(words);
  }
  return forms;
}

/** The sentence cut into pieces: words (with their normalised `token`) and the text between them. */
function sentencePieces(sentence: string): Array<{ text: string; token?: string }> {
  const out: Array<{ text: string; token?: string }> = [];
  let at = 0;
  for (const m of sentence.matchAll(EN_WORD)) {
    const token = norm(m[0]);
    if (!token) continue;
    if (m.index! > at) out.push({ text: sentence.slice(at, m.index) });
    out.push({ text: m[0], token });
    at = m.index! + m[0].length;
  }
  if (at < sentence.length) out.push({ text: sentence.slice(at) });
  return out;
}

/**
 * The English prompt of `entry` as pieces, the tappable words marked; null = nothing to tap (no lemma data, a mistake
 * sentence, no word matches). The Spanish lemmas are taken in sentence order, each one takes the earliest not yet taken
 * place of one of its glosses in the English sentence, so "the book and the table" pairs the first "the" with the first
 * "el" and the second with the second.
 */
export function hintPieces(entry: SentenceEntry, lookup: HintLookup = openHintLookup): HintPiece[] | null {
  if (entry.mistake) return null;
  const lemmas = lookup.sentenceLemmas(entry.itemId);
  if (!lemmas || lemmas.length === 0) return null;
  const pieces = sentencePieces(entry.source);
  const words = pieces.flatMap((p) => (p.token ? [p.token] : []));
  const forms = [...entry.target.matchAll(ES_WORD)].map((m) => m[0]);
  const aligned = forms.length === lemmas.length;
  const taken = new Set<number>();
  const hints = new Map<number, SentenceHint>();

  lemmas.forEach((lemma, i) => {
    let best: { start: number; length: number } | null = null;
    for (const gloss of lookup.glosses(lemma)) {
      for (const form of glossForms(gloss)) {
        for (let start = 0; start + form.length <= words.length; start++) {
          if (!form.every((word, k) => words[start + k] === word && !taken.has(start + k))) continue;
          if (!best || start < best.start || (start === best.start && form.length > best.length)) best = { start, length: form.length };
          break;
        }
      }
    }
    if (!best) return;
    // The form in the sentence (the sentence's first word lowercased, like the tiles), else the lemma.
    const form = aligned ? (i === 0 ? forms[i].charAt(0).toLowerCase() + forms[i].slice(1) : forms[i]) : lemma;
    const token = form.toLowerCase();
    const ids = entry.slots.filter((slot) => slot.words.includes(token) || lookup.cardLemma(slot.id) === lemma).map((slot) => slot.id);
    for (let k = 0; k < best.length; k++) {
      taken.add(best.start + k);
      hints.set(best.start + k, { index: best.start + k, es: form, lemma, ids });
    }
  });
  if (hints.size === 0) return null;

  let word = 0;
  return pieces.map((p) => (p.token ? { text: p.text, hint: hints.get(word++) } : { text: p.text }));
}
