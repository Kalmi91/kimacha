// Duplicate cleanup (2026-08-07): when two word cards referred to the same word
// at two levels, the higher-level one was deleted from the corpus. If the
// learner had progress on BOTH, the two FSRS rows have to be turned into one.
//
// Which one wins: the one practised more (reps), on a tie the stronger memory
// (stability), finally the earlier due date, so the review does not slip away.
// We never lose progress, the weaker row is dropped.

interface MergeableCard {
  reps: number;
  stability: number;
  due: string;
}

export function pickSurvivor<T extends MergeableCard>(a: T, b: T): T {
  if (a.reps !== b.reps) return a.reps > b.reps ? a : b;
  if (a.stability !== b.stability) return a.stability > b.stability ? a : b;
  return a.due <= b.due ? a : b;
}
