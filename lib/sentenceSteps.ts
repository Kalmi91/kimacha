// The steps of a Sentences tab round (FB524, Kálmán 2026-10-23): decided in ONE place, so the screen only switches on the
// kind. A round holds SENTENCE_ROUND_SIZE sentences, played one after the other; each sentence runs through, in order:
//   chunk   one per part of a split sentence (data/sentences/chunks.json): the English part is built into the Spanish part
//   listen  the whole Spanish sentence is heard and typed (only with the beta sentenceListening; credits nothing)
//   build   the whole sentence built from tiles (credits nothing)
//   type    the whole sentence typed from the English (the ONLY step that credits words, lib/sentenceTyping.ts)
// A sentence with fewer than 2 parts has no chunk steps. A sentence from the learner's own mistakes (SentenceEntry.mistake,
// lib/sentenceMistakes.ts) is ONE `mistake` step: it is credited to the mistake deck instead.
//
// The step list is saved with the round (lib/sentenceRound.ts), so a round continues on the same steps after a reload.

import type { SentenceEntry } from '@/lib/sentenceTab';

export type StepKind = 'chunk' | 'listen' | 'build' | 'type' | 'mistake';

export interface RoundStep {
  /** Unique in the round: `${itemId}#${kind}${chunk ?? ''}`. */
  id: string;
  /** The sentence (SentenceEntry.itemId) this step belongs to. */
  itemId: string;
  kind: StepKind;
  /** The 0-based part, on a `chunk` step. */
  chunk?: number;
}

/** The beta switches that change the steps (lib/beta.ts); a new switch adds its own flag here. */
export interface StepFlags {
  /** Beta sentenceListening: the listen-and-type step. */
  listening: boolean;
}

const step = (itemId: string, kind: StepKind, chunk?: number): RoundStep => ({
  id: `${itemId}#${kind}${chunk ?? ''}`,
  itemId,
  kind,
  ...(chunk === undefined ? {} : { chunk }),
});

/** The whole round's steps, sentence by sentence (see the header). */
export function roundSteps(entries: readonly SentenceEntry[], flags: StepFlags): RoundStep[] {
  const steps: RoundStep[] = [];
  for (const e of entries) {
    if (e.mistake) {
      steps.push(step(e.itemId, 'mistake'));
      continue;
    }
    for (let i = 0; i < (e.chunks && e.chunks.length >= 2 ? e.chunks.length : 0); i++) steps.push(step(e.itemId, 'chunk', i));
    if (flags.listening) steps.push(step(e.itemId, 'listen'));
    steps.push(step(e.itemId, 'build'), step(e.itemId, 'type'));
  }
  return steps;
}
