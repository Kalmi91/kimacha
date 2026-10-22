// "Sentence from my mistakes" (spec BRIEF-B2, beta sentenceMistakes): one build of the Sentences tab round is a sentence
// from the learner's own "My mistakes" list (lib/mistakes/): the English `en` is built into the Spanish `es`, the decoys are
// the words of the faulty sentence they once wrote. The sentence is the learner's own, so the "never an unknown word" rule
// does not apply to it. The answer is credited to the mistake deck, exactly like the deck's Knew it / Didn't know
// (lib/mistakes/grade.ts): a right build = knew it, a wrong one = didn't know (and it goes to the end of the round).
//
// Only the Spanish direction (the list is English -> Spanish). Pure choice functions plus the two db steps.

import { getDb } from '@/lib/database';
import { nearMissDistractors } from '@/lib/distractors';
import { cardsForBatches, type MistakeCard } from '@/lib/mistakes/deck';
import type { MistakesBatch } from '@/lib/mistakes/format';
import { gradeMistakeCard } from '@/lib/mistakes/grade';
import { tileWords } from '@/lib/sentenceCards';
import { sentenceKey, type SentenceEntry } from '@/lib/sentenceTab';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';

/** The place of the mistake sentence among the round's builds (the 3rd): the 1st stays plain, the 2nd and 4th may be heard. */
const MISTAKE_PLACE = 2;
/** Decoy tiles of a mistake step, like the corpus builds. */
const TRAP_COUNT = 3;

/**
 * The sentence to practise now: a due one first (the longest overdue), else one not seen yet (file order). A sentence that is
 * scheduled for later is not offered; `skip` = sentence keys (lib/sentenceTab.ts sentenceKey) to leave out (done or already
 * in the round). `doubtful` sentences are not cards at all (lib/mistakes/deck.ts cardsForBatch).
 */
export function chooseMistakeCard(batches: MistakesBatch[], progress: readonly Sm2Card[], today: string, skip: ReadonlySet<string> = new Set()): MistakeCard | null {
  const byId = new Map(progress.map((c) => [c.itemId, c]));
  const usable = cardsForBatches(batches).filter(
    (c) => c.kind === 'sentence' && tileWords(c.answer).length > 0 && !skip.has(sentenceKey({ target: c.answer })),
  );
  const due = usable
    .map((card) => ({ card, p: byId.get(card.cardId) }))
    .filter(({ p }) => p !== undefined && (p.state === 'review' || p.state === 'learning') && p.due <= today)
    .sort((a, b) => (a.p!.due < b.p!.due ? -1 : a.p!.due > b.p!.due ? 1 : 0));
  if (due.length > 0) return due[0].card;
  return usable.find((c) => (byId.get(c.cardId)?.state ?? 'new') === 'new') ?? null;
}

/** The mistake sentence as a round entry: it owns no learned word, `itemId` is the mistake card's id. */
export function mistakeEntry(card: MistakeCard): SentenceEntry {
  return {
    itemId: card.cardId,
    source: card.prompt,
    target: card.answer,
    wordCount: tileWords(card.answer).length,
    wordIds: [],
    due: false,
    dueIds: [],
    staleness: '',
    slots: [],
    mistake: { wrong: card.wrong ?? '' },
  };
}

/**
 * The builds of a round with the mistake sentence in: it takes the 3rd build's place; a shorter round keeps all its builds and
 * gets the mistake sentence at the end. No mistake sentence = the builds as they are.
 */
export function withMistakeStep(builds: readonly SentenceEntry[], mistake: SentenceEntry | null): SentenceEntry[] {
  if (!mistake) return [...builds];
  const out = [...builds];
  if (out.length > MISTAKE_PLACE) out[MISTAKE_PLACE] = mistake;
  else out.push(mistake);
  return out;
}

/**
 * The decoy tiles of a mistake step: first the words of the faulty sentence that are not in the right one (what the learner
 * got wrong), topped up with near-miss words (lib/distractors.ts) to `TRAP_COUNT`.
 */
export function mistakeTrapWords(targetWords: string[], wrong: string, vocab: string[], lang: string): string[] {
  const inTarget = new Set(targetWords.map((w) => w.toLowerCase()));
  const traps: string[] = [];
  const has = (w: string) => traps.some((t) => t.toLowerCase() === w.toLowerCase());
  for (const w of tileWords(wrong)) {
    if (traps.length >= TRAP_COUNT) break;
    if (!inTarget.has(w.toLowerCase()) && !has(w)) traps.push(w);
  }
  if (traps.length < TRAP_COUNT) {
    for (const w of nearMissDistractors(targetWords, vocab, lang, TRAP_COUNT + traps.length)) {
      if (traps.length >= TRAP_COUNT) break;
      if (!has(w)) traps.push(w);
    }
  }
  return traps;
}

/** The mistake sentence for a new round, or null (no list loaded, nothing due or new, an unreadable row is skipped). */
export async function pickMistakeEntry(today: string, skip: ReadonlySet<string>): Promise<SentenceEntry | null> {
  const db = getDb();
  const batches: MistakesBatch[] = [];
  for (const row of await db.getMistakeBatches()) {
    try {
      batches.push(JSON.parse(row.json));
    } catch {
      // saveMistakeBatch only stores a validated payload; a broken row is left out like in the deck
    }
  }
  if (batches.length === 0) return null;
  const card = chooseMistakeCard(batches, await db.getMistakeCards(), today, skip);
  return card ? mistakeEntry(card) : null;
}

/** The mistake build was answered: right = knew it, wrong = didn't know, the deck's own grading step. */
export async function recordMistakeBuild(cardId: string, correct: boolean, today: string): Promise<Sm2Card> {
  const card = (await getDb().getMistakeCards()).find((c) => c.itemId === cardId) ?? sm2NewCard(cardId);
  return gradeMistakeCard(card, correct ? 'good' : 'again', today);
}
