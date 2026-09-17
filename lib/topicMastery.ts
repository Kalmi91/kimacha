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
// Korábbi mérce: a szó akkor kész, ha KILÉPETT a Learning állapotból (FSRS
// state >= 2, Review vagy Relearning).
//
// UTEMEZO 12/4 (Kálmán, 2026-09-17): ez a mérce ELTÉRT a Stats-kártyáétól (lap
// >= 3 OR buried, UTEMEZO 1. szakasz "megtanult"), ezért lehetett a szint
// 928/931, miközben egy téma 0/10, a fa és a Stats más adatot számolt. Innentől
// EGY definíció: a `state` paraméter a `db.getWordStates()`-től egy 1/0
// "ismert" jelzőt kap (lap >= 3 OR buried), nem FSRS-állapotot, lásd ott.
export function isWordMastered(state: number | undefined): boolean {
  return (state ?? 0) >= 1;
}

export function masteredCount(wordIds: number[], stateMap: Map<number, number>): number {
  return wordIds.filter((id) => isWordMastered(stateMap.get(id))).length;
}

// Üres topic sosem kész, különben egy tartalmatlan topic azonnal "kipipálódna".
export function isTopicMastered(wordIds: number[], stateMap: Map<number, number>): boolean {
  return wordIds.length > 0 && wordIds.every((id) => isWordMastered(stateMap.get(id)));
}
