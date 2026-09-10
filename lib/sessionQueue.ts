// The learning session queue: due card rows in, the ordered card list the
// learner sees out. Extracted from app/(tabs)/index.tsx so it can be driven by
// tests without a device, because both halves of FB129 (a pair-blind daily
// budget and an id lookup that only knew the Spanish set) emptied the queue in
// ways no UI-free unit test could see.

import { cardFromRow } from '@/lib/database';
import { capSentencesToCadence } from '@/lib/sentenceMix';
import { wordPhase, phaseShape } from '@/lib/wordPhase';
import { findWordById, type WordEntry } from '@/data/words';
import type { Card } from 'ts-fsrs';

export type TypingDir = 'learned-to-native' | 'native-to-learned';

export interface DueItem {
  wordId: number;
  type: string;
  card: Card;
  word: WordEntry;
  isTyping: boolean;
  isEasySentence?: boolean;
  typingDirection?: TypingDir;
}

// FB26: reorder word cards so no more than `maxRun` of the same kind (flashcard
// vs typing) appear in a row, keeping a balanced flashcard/typing mix.
export function interleaveByType(items: DueItem[], maxRun: number): DueItem[] {
  const flash = items.filter((i) => !i.isTyping);
  const typing = items.filter((i) => i.isTyping);
  const out: DueItem[] = [];
  let fi = 0, ti = 0;
  let last: boolean | null = null;
  let run = 0;
  while (fi < flash.length || ti < typing.length) {
    let pullTyping: boolean;
    if (fi >= flash.length) pullTyping = true;
    else if (ti >= typing.length) pullTyping = false;
    else if (last !== null && run >= maxRun) pullTyping = !last; // force a switch
    else pullTyping = (typing.length - ti) > (flash.length - fi); // pull from the fuller bucket
    const item: DueItem = pullTyping ? typing[ti++] : flash[fi++];
    out.push(item);
    if (item.isTyping === last) run++;
    else { run = 1; last = item.isTyping; }
  }
  return out;
}

// FB225, Kálmán 2026-09-10: „azt szeretném hogy minden szintet ha elkezdek a
// régi szavak ismétlése legyen benne". A sor eddig a JELENLEGI szint (illetve az
// aktív téma) szavaira volt szűkítve, így egy A2-re lépés után az A1-en már
// megkezdett szavak esedékes ismétlései kiesődtek a forgásból: a szint be volt
// fejezve, a szavak nem. `carryRows` az ezen a szűkítésen KÍVÜL esedékes,
// már megkezdett szó-kártyák listája (lásd getDueCarryoverCards).
//
// Az osztás: az ismétlés-helyek CARRY_SHARE része a régi szavaké, de sosem
// több, mint amennyit hoztak, és ha az egyik oldalnak kevesebb jut, a másik
// tölti fel a helyet. Carryover nélkül a sor változatlan.
export const CARRY_SHARE = 0.4;

const isReviewWord = (row: any) => row.type === 'word' && (row.reps ?? 0) > 0;

export function mergeCarryover(levelRows: any[], carryRows: any[], reviewSlots: number): any[] {
  if (carryRows.length === 0) return levelRows;
  const levelReviews = levelRows.filter(isReviewWord);
  const rest = levelRows.filter((row) => !isReviewWord(row));
  const total = Math.min(reviewSlots, levelReviews.length + carryRows.length);
  const carryTake = Math.min(
    carryRows.length,
    Math.max(total - levelReviews.length, Math.round(total * CARRY_SHARE)),
  );
  const merged = [...levelReviews.slice(0, total - carryTake), ...carryRows.slice(0, carryTake)]
    .sort((a, b) => String(a.due).localeCompare(String(b.due)));
  // A sorrend ugyanaz marad, mint a szint-lekérdezésnél: ismétlések elől,
  // mondatok és új szavak utánuk, a többit az applyCadence rendezi.
  return [...merged, ...rest];
}

// Due rows → cards. `lang` is the language being learned: its branch owns the
// word ids (English from 5001, Hungarian from 6001), the shared Spanish set is
// the fallback. A row whose word cannot be resolved is dropped, so a wrong
// `lang` here silently empties the session (FB129).
export function buildQueue(rows: any[], lang: string): DueItem[] {
  return rows
    .map((row: any) => {
      const isWord = row.type === 'word';
      const isSentence = row.type === 'sentence';
      let isTyping = false;
      let typingDirection: TypingDir | undefined;

      if (isWord) {
        // FB105/FB109: the phase ladder (lib/wordPhase.ts) counts SUCCESSFUL
        // reviews, not reviews, and the same rule drives the in-session
        // promotion in handleWordGood.
        const shape = phaseShape(wordPhase(row));
        isTyping = shape.isTyping;
        typingDirection = shape.typingDirection;
      } else {
        // Sentence: easy (tap-to-order) first time, hard (typing) after
        isTyping = row.reps > 0;
      }

      return {
        wordId: row.word_id,
        type: row.type,
        card: cardFromRow(row),
        word: findWordById(row.word_id, lang)!,
        isTyping,
        isEasySentence: isSentence && row.reps === 0,
        typingDirection,
      };
    })
    .filter((item: DueItem) => !!item.word);
}

// FB163, Kálmán 2026-08-28 (`word:the garden`): "legyen úgy, hogy ha ismétlem a
// szavakat akkor is tegyen bele egy új szót azt nyomja végig a 3 típusát, és közben
// menjen a régi szavak ismétlése ... de egyesével". New words arrived in whatever
// order the due query handed them over, so a session either opened with a block of
// new words or hid them behind every review. They are now spread evenly through the
// reviews: one new word, then a stretch of old ones, then the next new word. The
// ladder itself (phase 0/1/2) is walked in-session by index.tsx.
export function dripNewWords(items: DueItem[]): DueItem[] {
  const isNew = (item: DueItem) => item.type === 'word' && (item.card.reps ?? 0) === 0;
  const fresh = items.filter(isNew);
  const rest = items.filter((item) => !isNew(item));
  if (!fresh.length || !rest.length) return items;
  const gap = Math.max(1, Math.floor(rest.length / fresh.length));
  const out: DueItem[] = [];
  let fi = 0;
  for (let i = 0; i < rest.length; i++) {
    if (fi < fresh.length && i % gap === 0) out.push(fresh[fi++]);
    out.push(rest[i]);
  }
  while (fi < fresh.length) out.push(fresh[fi++]);
  return out;
}

export function applyCadence(items: DueItem[], wordsOnly: boolean, lang: string): DueItem[] {
  if (wordsOnly) {
    // FB24/26/27: words only, no sentences. Respect each word's natural phase
    // (flashcard L→N at reps0, flashcard N→L at reps1, typing N→L at reps>=2),
    // so a word becomes a typing card ONLY after it reached Good in BOTH
    // flashcard directions. Interleave so no >4 cards of one kind run, and the
    // first card is always a word flashcard (never a sentence build).
    const wordItems = items.filter((item) => item.type === 'word');
    return interleaveByType(wordItems, 4);
  }
  // FB31/FB36: repeating 4-words + 1-sentence unit (80% word / 20% sentence).
  // Sentence slots cycle easy → easy → typing on a counter that runs across
  // the whole queue, so the 2:1 easy:typing mix survives unit boundaries and
  // two sentence cards are never adjacent while words remain.
  const words: DueItem[] = [];
  const easy: DueItem[] = [];
  const typing: DueItem[] = [];
  // FB99: re-apply the cadence (and its 5-sentence ceiling) to the FINAL list,
  // after capNewWords removed the new words the daily budget cannot afford.
  for (const item of capSentencesToCadence(items, (i) => i.type !== 'word')) {
    if (item.type === 'word') words.push(item);
    else if (item.isEasySentence) easy.push(item);
    else typing.push(item);
  }
  // FB33/FB35: easy sentences come simplest-first (learned-language word
  // count, then character length; stable). Typing sentences are due FSRS
  // reviews, so their order stays untouched.
  const sentOf = (item: DueItem) => String(item.word[`sentence_${lang}`]).trim();
  easy.sort((a, b) => {
    const sa = sentOf(a), sb = sentOf(b);
    const wa = sa.split(/\s+/).filter(Boolean).length;
    const wb = sb.split(/\s+/).filter(Boolean).length;
    return wa - wb || sa.length - sb.length;
  });
  const result: DueItem[] = [];
  let wi = 0, ei = 0, ti = 0, slot = 0;
  while (wi < words.length) {
    const batch = words.slice(wi, wi + 4);
    wi += batch.length;
    result.push(...batch);
    if (ei >= easy.length && ti >= typing.length) continue; // no sentences left, words go on
    const wantTyping = slot % 3 === 2;
    slot++;
    // an empty scheduled bucket falls back to the other, no due sentence dropped
    if (wantTyping ? ti < typing.length : ei >= easy.length) { result.push(typing[ti]); ti++; }
    else { result.push(easy[ei]); ei++; }
  }
  // words exhausted: alternate remaining easy/typing so neither kind dumps
  // in one long run (FB31)
  let takeEasy = true;
  while (ei < easy.length || ti < typing.length) {
    if (takeEasy ? ei < easy.length : ti >= typing.length) { result.push(easy[ei]); ei++; }
    else { result.push(typing[ti]); ti++; }
    takeEasy = !takeEasy;
  }
  return result;
}

// FB174/FB180: what the 🔁 header badge counts. The batch is the REVIEW WORDS of
// this queue — a word can hold three cards, so words are counted, not cards —
// and `left` is how many more batches of that size the day still owes.
//
// FB180, Kálmán 2026-09-07 (word:"the bedroom"): „5 szót írt de valójában 8 szó
// volt benne". New-ness belongs to the WORD, not to one of its cards: a brand-new
// word arrives with a word card at reps 0 plus sentence/easy cards, and counting
// only the word card as new left the other two on the review side, inflating the
// batch against the counter that shrinks as the queue is answered. `newIds` is
// returned so both sides can read the same set.
export interface ReviewBatch {
  size: number;
  left: number;
  dueToday: number;
  newIds: Set<number>;
}

export function reviewBatchOf(items: DueItem[], dueReviewWords: number): ReviewBatch {
  const newIds = new Set(
    items.filter((item) => item.type === 'word' && item.card.reps === 0).map((item) => item.wordId),
  );
  const size = new Set(
    items.filter((item) => !newIds.has(item.wordId)).map((item) => item.wordId),
  ).size;
  const beyond = Math.max(0, dueReviewWords - size);
  return { size, left: size > 0 ? Math.ceil(beyond / size) : 0, dueToday: dueReviewWords, newIds };
}

// The review words still ahead in `queue` from `index` on, counted the same way
// the batch was sized, so the badge can never disagree with itself.
export function reviewWordsLeft(queue: DueItem[], index: number, newIds: Set<number>): number {
  const ids = new Set<number>();
  for (let i = index; i < queue.length; i++) {
    if (!newIds.has(queue[i].wordId)) ids.add(queue[i].wordId);
  }
  return ids.size;
}
