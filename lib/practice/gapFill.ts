// "Missing word" practice (Practice tab, spec HAROM-JATEK.md 5): a sentence of an already learned word with
// that word blanked out. Pure logic, no I/O: the screen supplies the cards and the lookups.
//
// Sentence source: the word's own example sentence (words-open sentence_es / sentence_en). For the Spanish
// target the blank is found through the data's own `sentence_lemmas` (one lemma per word of the sentence,
// verified 1:1 with the sentence's words), so an inflected form works: for estar in "Yo estoy bien." the
// blank is "estoy". A word with no such sentence is left out. The English target deck has no lemma data,
// there the headword itself has to stand in the sentence.

import type { PcicItem, PcicTarget } from '@/data/pcic';
import openA1 from '@/data/words-open/a1.json';
import openA2 from '@/data/words-open/a2.json';
import openB1 from '@/data/words-open/b1.json';
import openB2 from '@/data/words-open/b2.json';
import openC1 from '@/data/words-open/c1.json';
import { strictAnswerMatch } from '@/lib/answerMatch';
import { addDays, type Sm2Card } from '@/lib/sm2';

/** One round: the due words first, then the freshly learned ones, up to this many. */
export const PRACTICE_SESSION_SIZE = 20;
/** A word counts as freshly learned (Words tab) when it was first asked within this many days. */
export const PRACTICE_RECENT_DAYS = 7;

export interface GapTask {
  itemId: string;
  /** The sentence up to the blank / after it (the blank is where the word stood). */
  before: string;
  after: string;
  /** The word as written in the sentence (the inflected form), what has to be typed. */
  answer: string;
  /** The same sentence in the other language, shown under the blank. */
  translation: string;
  /** The word's meaning, the tip. */
  meaning: string;
}

/** What words-open knows beyond the PcicItem: the card's lemma and the lemma of each word of its sentence. */
export interface GapSourceInfo {
  lemma: string;
  sentenceLemmas: string[];
}

type OpenCard = { order: number; lemma: string; sentence_lemmas?: string[] };

let openInfo: Map<string, GapSourceInfo> | null = null;

// o<order> is the id space of the en→es deck (data/pcic.ts itemsFromOpen).
export function openGapInfo(itemId: string): GapSourceInfo | undefined {
  if (!openInfo) {
    openInfo = new Map();
    for (const file of [openA1, openA2, openB1, openB2, openC1] as OpenCard[][]) {
      for (const c of file) {
        if (c.lemma && c.sentence_lemmas?.length) openInfo.set(`o${c.order}`, { lemma: c.lemma, sentenceLemmas: c.sentence_lemmas });
      }
    }
  }
  return openInfo.get(itemId);
}

const WORD = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g;

interface Gap {
  before: string;
  answer: string;
  after: string;
}

function cut(sentence: string, start: number, end: number): Gap {
  return { before: sentence.slice(0, start), answer: sentence.slice(start, end), after: sentence.slice(end) };
}

/** The blank by lemma: the sentence's word whose lemma is the card's lemma; null if the two lists do not line up. */
export function gapByLemma(sentence: string, info: GapSourceInfo): Gap | null {
  const words = [...sentence.matchAll(WORD)];
  if (words.length !== info.sentenceLemmas.length) return null;
  const at = info.sentenceLemmas.indexOf(info.lemma);
  if (at === -1) return null;
  const word = words[at];
  return cut(sentence, word.index!, word.index! + word[0].length);
}

/** The blank by the headword itself (no lemma data): the first sentence word equal to it, case-insensitive. */
export function gapByWord(sentence: string, headword: string): Gap | null {
  const want = headword.trim().toLowerCase();
  if (!want) return null;
  const word = [...sentence.matchAll(WORD)].find((w) => w[0].toLowerCase() === want);
  return word ? cut(sentence, word.index!, word.index! + word[0].length) : null;
}

/** The task of one word, or null when it has no usable sentence. */
export function gapTaskFor(
  item: PcicItem,
  target: PcicTarget,
  info: (itemId: string) => GapSourceInfo | undefined = openGapInfo,
): GapTask | null {
  const sentence = (target === 'es' ? item.exampleEs : item.exampleEn)?.trim();
  const translation = (target === 'es' ? item.exampleEn : item.exampleEs)?.trim();
  if (!sentence || !translation) return null;
  const known = info(item.id);
  const gap = target === 'es'
    ? (known ? gapByLemma(sentence, known) : null)
    : gapByWord(sentence, item.en.replace(/^to\s+/i, ''));
  if (!gap) return null;
  return {
    itemId: item.id,
    before: gap.before,
    after: gap.after,
    answer: gap.answer,
    translation,
    meaning: target === 'es' ? item.en : item.es,
  };
}

export interface QueueDeps {
  target: PcicTarget;
  findItem: (id: string) => PcicItem | undefined;
  today: string;
  size?: number;
  info?: (itemId: string) => GapSourceInfo | undefined;
}

/**
 * The round: the learned words with a usable sentence that are due (the longest overdue first), then the ones
 * first learned in the Words tab within the last PRACTICE_RECENT_DAYS days (the newest first), up to `size`
 * tasks. A word marked known by hand ("Don't learn this") was never learned, so it is left out; an older
 * word that is not due is left out too.
 */
export function buildGapQueue(cards: Iterable<Sm2Card>, deps: QueueDeps): GapTask[] {
  const learned = [...cards].filter((c) => c.state !== 'new' && !c.known);
  const isDue = (c: Sm2Card) => c.due !== '' && c.due <= deps.today;
  const due = learned.filter(isDue).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  const since = addDays(deps.today, -PRACTICE_RECENT_DAYS);
  const fresh = (c: Sm2Card) => !isDue(c) && !!c.introducedAt && c.introducedAt >= since;
  const recent = learned.filter(fresh).sort((a, b) => (a.introducedAt! > b.introducedAt! ? -1 : a.introducedAt! < b.introducedAt! ? 1 : 0));
  const out: GapTask[] = [];
  for (const card of [...due, ...recent]) {
    const item = deps.findItem(card.itemId);
    const task = item ? gapTaskFor(item, deps.target, deps.info) : null;
    if (task) out.push(task);
    if (out.length >= (deps.size ?? PRACTICE_SESSION_SIZE)) break;
  }
  return out;
}

/** Whether the typed text is the blanked word; the accent rule is the Settings switch (strictAccents), like the other typing cards. */
export function checkGap(typed: string, task: GapTask, strictAccents: boolean): boolean {
  return strictAnswerMatch(typed, task.answer, { strictAccents });
}
