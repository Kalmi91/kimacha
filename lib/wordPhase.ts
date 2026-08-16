// FB109/FB111/FB114: a word walks a three-step ladder before it is "learned":
//   phase 0 = flashcard learned→native, phase 1 = flashcard native→learned,
//   phase 2 = typing native→learned.
// The step is derived from SUCCESSFUL reviews (FB105: FSRS bumps `reps` on every
// answer, Again included, so every lapse takes a promotion back).
//
// The learner kept losing the typing step ("nem volt a begepelos rész miért",
// "most a gépelésből csak mondat van"): after two Goods FSRS schedules the word
// days out, so phase 2 only surfaced on a later day. The ladder is therefore
// walked inside the session (index.tsx requeues the next phase), and a word is
// only considered learned once it has been spelled right ("Egy szó akkor számít
// megtanultnak ha el tudjuk írni helyesen").

export type WordPhase = 0 | 1 | 2;

export interface PhaseCard {
  reps?: number;
  lapses?: number;
}

export function wordPhase(card: PhaseCard): WordPhase {
  const passed = Math.max(0, (card.reps ?? 0) - (card.lapses ?? 0));
  if (passed >= 2) return 2;
  return passed === 1 ? 1 : 0;
}

// The card-shape fields a DueItem needs for a given phase.
export function phaseShape(phase: WordPhase): { isTyping: boolean; typingDirection?: 'native-to-learned' } {
  if (phase === 2) return { isTyping: true, typingDirection: 'native-to-learned' };
  if (phase === 1) return { isTyping: false, typingDirection: 'native-to-learned' };
  return { isTyping: false };
}
