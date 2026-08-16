// Mikor számít egy témakör befejezettnek.
//
// Kálmán, 2026-08-10: "egyik nap elkezdem tanulni a testrészeket, aztán együtt
// tanulom a testrészeket és a banki szavakat, mert így átcsúszik, aztán úgy érzem
// még nem teljesen értem a testrészeket sem."
//
// Gyökérok: a topic-kész feltétel eddig `reps > 0` volt, azaz a szót ELEGENDŐ volt
// egyszer látni. Amint a téma utolsó szava is megjelent egyszer, az aktív topic
// továbblépett a következőre, miközben az előző szavai még FSRS Learning
// állapotban napokig visszajártak. Innen jött a két téma keveredése.
//
// Új mérce: a szó akkor kész, ha KILÉPETT a Learning állapotból.
// FSRS állapotok: 0 New, 1 Learning, 2 Review, 3 Relearning.
// A Relearning (3) is beleszámít: az a szó egyszer már felnőtt Review-ra, csak
// megbotlott. Így egy-két makacs szó nem tudja határozatlan időre befagyasztani a
// téma lezárását (ezt a felhasználó a "kemény fázis-zár" opció elvetésével kérte).
export const MASTERED_STATE = 2;

export function isWordMastered(state: number | undefined): boolean {
  return (state ?? 0) >= MASTERED_STATE;
}

export function masteredCount(wordIds: number[], stateMap: Map<number, number>): number {
  return wordIds.filter((id) => isWordMastered(stateMap.get(id))).length;
}

// Üres topic sosem kész, különben egy tartalmatlan topic azonnal "kipipálódna".
export function isTopicMastered(wordIds: number[], stateMap: Map<number, number>): boolean {
  return wordIds.length > 0 && wordIds.every((id) => isWordMastered(stateMap.get(id)));
}
