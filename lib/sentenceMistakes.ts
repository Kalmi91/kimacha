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
import type { PcicItem, PcicLevel } from '@/data/pcic';
import { knownTokens, sentenceTokens, type LearnedEntry, type ResolvedTense } from '@/lib/knownSentence';
import { tileWords } from '@/lib/sentenceCards';
import { wordIn } from '@/lib/pcicItemText';
import { posOf } from '@/lib/pcicPos';
import { sentenceKey, type SentenceEntry } from '@/lib/sentenceTab';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';

/** The place of the mistake sentence among the round's sentences (the 3rd). */
const MISTAKE_PLACE = 2;
/** Decoy tiles of a mistake step, like the corpus builds. */
const TRAP_COUNT = 3;

/**
 * The sentence to practise now: a due one first (the longest overdue), else one not seen yet (file order). A sentence that is
 * scheduled for later is not offered; `skip` = sentence keys (lib/sentenceTab.ts sentenceKey) to leave out (done or already
 * in the round). `doubtful` sentences are not cards at all (lib/mistakes/deck.ts cardsForBatch).
 */
export function chooseMistakeCard(batches: MistakesBatch[], progress: readonly Sm2Card[], today: string, skip: ReadonlySet<string> = new Set(), fits?: (answer: string) => boolean): MistakeCard | null {
  const byId = new Map(progress.map((c) => [c.itemId, c]));
  const usable = cardsForBatches(batches).filter(
    (c) => c.kind === 'sentence' && tileWords(c.answer).length > 0 && !skip.has(sentenceKey({ target: c.answer })) && (!fits || fits(c.answer)),
  );
  const due = usable
    .map((card) => ({ card, p: byId.get(card.cardId) }))
    .filter(({ p }) => p !== undefined && (p.state === 'review' || p.state === 'learning') && p.due <= today)
    .sort((a, b) => (a.p!.due < b.p!.due ? -1 : a.p!.due > b.p!.due ? 1 : 0));
  if (due.length > 0) return due[0].card;
  return usable.find((c) => (byId.get(c.cardId)?.state ?? 'new') === 'new') ?? null;
}

/**
 * FB631: the mistake sentence follows the tab's level rule. With a level chosen, a sentence that uses a word known only from a
 * HIGHER level is not offered (a word outside the corpus is the learner's own and stays); `all` = every sentence.
 */
export function mistakeFitsLevel(level: 'all' | PcicLevel, levels: readonly PcicLevel[], itemsFor: (l: PcicLevel) => readonly PcicItem[], tenses?: ReadonlySet<ResolvedTense>): ((answer: string) => boolean) | undefined {
  if (level === 'all') return undefined;
  const entries = (ls: readonly PcicLevel[]): LearnedEntry[] =>
    ls.flatMap((l) => itemsFor(l)).map((item) => ({ text: wordIn(item, 'es') ?? '', pos: item.pos ?? posOf(item)?.pos }));
  const upTo = levels.slice(0, levels.indexOf(level) + 1);
  const low = knownTokens('es', { learned: entries(upTo), tenses });
  const all = knownTokens('es', { learned: entries(levels), tenses });
  return (answer) => sentenceTokens(answer, 'es').every((t) => low.has(t) || !all.has(t));
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
 * The sentences of a round with the mistake sentence in: it is inserted at the 3rd place (the corpus sentences all stay);
 * a shorter round gets it at the end. No mistake sentence = the sentences as they are.
 */
export function withMistakeStep(sentences: readonly SentenceEntry[], mistake: SentenceEntry | null): SentenceEntry[] {
  if (!mistake) return [...sentences];
  const out = [...sentences];
  out.splice(Math.min(MISTAKE_PLACE, out.length), 0, mistake);
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
export async function pickMistakeEntry(today: string, skip: ReadonlySet<string>, fits?: (answer: string) => boolean): Promise<SentenceEntry | null> {
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
  const card = chooseMistakeCard(batches, await db.getMistakeCards(), today, skip, fits);
  return card ? mistakeEntry(card) : null;
}

/** The mistake build was answered: right = knew it, wrong = didn't know, the deck's own grading step. */
export async function recordMistakeBuild(cardId: string, correct: boolean, today: string): Promise<Sm2Card> {
  const card = (await getDb().getMistakeCards()).find((c) => c.itemId === cardId) ?? sm2NewCard(cardId);
  return gradeMistakeCard(card, correct ? 'good' : 'again', today);
}
