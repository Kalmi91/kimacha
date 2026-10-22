// The kind of each build step of the Sentences tab round (spec BRIEF-B1): decided in ONE place, so the screen only
// switches on the kind. A build is `normal` (tiles from the shown prompt), `listening` (the prompt is heard, not
// shown, until the build is right) or `mistake` (a sentence from the learner's own "My mistakes" list, credited to that
// deck). A further kind is a new member of BuildStepKind plus one more rule in buildStepKind; the typing step is not a
// build and has no kind.
//
// The kind is derived, never saved: the saved round (lib/sentenceRound.ts) keeps its format. A mistake step is the one
// exception that is visible in the saved data: its entry carries `mistake` (SentenceEntry), so it stays one after a reload.

import type { SentenceRound } from '@/lib/sentenceRound';

export type BuildStepKind = 'normal' | 'listening' | 'mistake';

/** The beta switches that change the kinds (lib/beta.ts); a new kind adds its own switch here. */
export interface BuildStepFlags {
  /** Beta sentenceListening. */
  listening: boolean;
  /** Beta sentenceMistakes. */
  mistakes: boolean;
}

/**
 * The kind of the build of the sentence `itemId`. A sentence that carries `mistake` (lib/sentenceMistakes.ts put it in
 * the round) is a `mistake` step while `mistakes` is on; with it off the saved sentence is simply built, nothing credited.
 * With `listening` on, every second sentence of the round is a listening one: the 2nd and the 4th, counted in the
 * round's first order (`round.entries`), so a sentence that comes back after a wrong build is the same kind as before.
 * Everything else, and everything with the switches off, is `normal`.
 */
export function buildStepKind(round: Pick<SentenceRound, 'entries'>, itemId: string, flags: BuildStepFlags): BuildStepKind {
  const place = round.entries.findIndex((e) => e.itemId === itemId);
  if (flags.mistakes && round.entries[place]?.mistake) return 'mistake';
  if (flags.listening && place % 2 === 1) return 'listening';
  return 'normal';
}
