// The steps of a Sentences tab round (FB524, Kálmán 2026-10-23): decided in ONE place, so the screen only switches on the
// kind. A round holds SENTENCE_ROUND_SIZE sentences, which take turns (beta sentenceMix, FB536); each sentence runs through, in order:
//   chunk   one per shorter sentence it is built up from (data/sentences/chunks.json, FB538): built from its English
//   listen  the whole Spanish sentence is heard and typed (only with the beta sentenceListening; credits nothing)
//   build   the whole sentence built from tiles (credits nothing)
//   type    the whole sentence typed from the English (the ONLY step that credits words, lib/sentenceTyping.ts)
// A sentence with no shorter sentences has no chunk steps. A sentence from the learner's own mistakes (SentenceEntry.mistake,
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
  /** Beta sentenceMix (FB536): the sentences take turns; off/absent = one sentence after the other. */
  mix?: boolean;
}

const step = (itemId: string, kind: StepKind, chunk?: number): RoundStep => ({
  id: `${itemId}#${kind}${chunk ?? ''}`,
  itemId,
  kind,
  ...(chunk === undefined ? {} : { chunk }),
});

/** One sentence's steps, in their order (see the header). */
function sentenceSteps(e: SentenceEntry, flags: StepFlags): RoundStep[] {
  if (e.mistake) return [step(e.itemId, 'mistake')];
  const steps: RoundStep[] = [];
  for (let i = 0; i < (e.chunks?.length ?? 0); i++) steps.push(step(e.itemId, 'chunk', i));
  if (flags.listening) steps.push(step(e.itemId, 'listen'));
  steps.push(step(e.itemId, 'build'), step(e.itemId, 'type'));
  return steps;
}

/**
 * The whole round's steps. With `mix` (FB536, "the same sentences come one after the other, shuffle them") the sentences
 * take turns, so the same sentence never comes twice in a row while another one still has steps. Each sentence keeps its
 * own order (its parts, then the whole built, then typed). Next comes the sentence with the most steps left that was not
 * the last one (ties: the round order), which spreads even a long sentence out. Without it: sentence by sentence.
 */
export function roundSteps(entries: readonly SentenceEntry[], flags: StepFlags): RoundStep[] {
  const left = entries.map((e) => sentenceSteps(e, flags));
  if (!flags.mix) return left.flat();
  const steps: RoundStep[] = [];
  let last = -1;
  for (;;) {
    let pick = -1;
    left.forEach((l, i) => {
      if (l.length > 0 && i !== last && (pick === -1 || l.length > left[pick].length)) pick = i;
    });
    if (pick === -1) pick = last >= 0 && left[last].length > 0 ? last : -1;
    if (pick === -1) return steps;
    steps.push(left[pick].shift() as RoundStep);
    last = pick;
  }
}
