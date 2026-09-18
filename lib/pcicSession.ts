import type { Sm2Card } from './sm2';

// SZ2 (SZAVAK.md): a sor léptetése értékelés után és visszavonáskor, tesztelhetően.

/** Értékelés után: az első kártya kikerül; ha ma még esedékes (learning), a sor végére kerül vissza. */
export function requeueAfterGrade(queue: Sm2Card[], next: Sm2Card, today: string): Sm2Card[] {
  const rest = queue.slice(1);
  return next.due === today ? [...rest, next] : rest;
}

/** Visszavonás: ha az értékelt kártya a sor végére került (due === today), onnan kikerül; az értékelés előtti állapot a sor ELEJÉRE kerül. */
export function requeueAfterUndo(queue: Sm2Card[], before: Sm2Card, graded: Sm2Card, today: string): Sm2Card[] {
  let rest = queue;
  if (graded.due === today && rest.length && rest[rest.length - 1].itemId === graded.itemId) {
    rest = rest.slice(0, -1);
  }
  return [before, ...rest];
}
