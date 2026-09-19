// FB315 (NY9): a lecke-képernyő "Ezen szavak tanulása" gombja a Learn fület
// egy szűkített szó-sorra állítja. Modul-singleton, mint a pendingAction,
// mert a Learn fül újra-mountolása és a fül-váltás nem törölheti, csak a ✕
// vagy a "minden ismert" állapot.
export type FocusWords = { topicId: string; label: string; wordIds: number[] };

let focus: FocusWords | null = null;

export function setFocusWords(f: FocusWords) {
  focus = f;
}

export function getFocusWords(): FocusWords | null {
  return focus;
}

export function clearFocusWords() {
  focus = null;
}

// `done` = minden fókusz-szó ismert (knownIds tartalmazza).
export function focusProgress(
  wordIds: number[],
  knownIds: Set<number>
): { known: number; total: number; done: boolean } {
  const known = wordIds.filter((id) => knownIds.has(id)).length;
  const total = wordIds.length;
  return { known, total, done: known === total };
}
