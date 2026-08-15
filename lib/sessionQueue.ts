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
