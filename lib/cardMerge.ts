// Duplikátum-takarítás (2026-08-07): amikor két szó-kártya ugyanarra a szóra
// vonatkozott két szinten, a magasabb szintű törlődött a korpuszból. Ha a
// tanulónak MINDKETTŐRE volt haladása, a két FSRS-sorból egyet kell csinálni.
//
// Melyik nyer: a többet gyakorolt (reps), holtversenyben az erősebb emlék
// (stability), végül a korábbi esedékesség, hogy az ismétlés ne csússzon ki.
// Sose vesztünk haladást, a gyengébb sor esik ki.

export interface MergeableCard {
  reps: number;
  stability: number;
  due: string;
}

export function pickSurvivor<T extends MergeableCard>(a: T, b: T): T {
  if (a.reps !== b.reps) return a.reps > b.reps ? a : b;
  if (a.stability !== b.stability) return a.stability > b.stability ? a : b;
  return a.due <= b.due ? a : b;
}
