// The kind of each build step of the Sentences tab round (spec BRIEF-B1): decided in ONE place, so the screen only
// switches on the kind. Today a build is `normal` (tiles from the shown prompt) or `listening` (the prompt is heard, not
// shown, until the build is right). A later kind (a sentence from the learner's mistakes) is a new member of
// BuildStepKind plus one more rule in buildStepKind; the typing step is not a build and has no kind.
//
// The kind is derived, never saved: the saved round (lib/sentenceRound.ts) keeps its format.

import type { SentenceRound } from '@/lib/sentenceRound';

export type BuildStepKind = 'normal' | 'listening';

/** The beta switches that change the kinds (lib/beta.ts); a new kind adds its own switch here. */
export interface BuildStepFlags {
  /** Beta sentenceListening. */
  listening: boolean;
}

/**
 * The kind of the build of the sentence `itemId`. With `listening` on, every second sentence of the round is a listening
 * one: the 2nd and the 4th, counted in the round's first order (`round.entries`), so a sentence that comes back after a
 * wrong build is the same kind as before. Everything else, and everything with the switch off, is `normal`.
 */
export function buildStepKind(round: Pick<SentenceRound, 'entries'>, itemId: string, flags: BuildStepFlags): BuildStepKind {
  const place = round.entries.findIndex((e) => e.itemId === itemId);
  if (flags.listening && place % 2 === 1) return 'listening';
  return 'normal';
}
