// FB198, Kálmán 2026-09-09 (word:feet): „legyen egy opció amilyan mehézség állotó a
// settingsbe […] az a lényege hogy most hány szó jöjjön fel mire új szót kérdez. Mert
// van hogy túl gyorsan következik igyan az a szó és még a rövid távú memoriám tárolja,
// szal igazából a nehézség az azt fogja szamályozni, hogy mennyi szó után jöjjön fel
// egy elrontott szó".
//
// Az elrontott kártya eddig a sor VÉGÉRE került. Hosszú soron ez rendben van, de a
// nap végén, amikor négy-öt kártya maradt, a „vége" két lapnyira volt, és a szó még
// a rövid távú memóriában ült: a helyes válasz nem előhívás volt, hanem emlékezés.
// Ezért a távolság mostantól beállítás, nem a sor hosszának véletlene.

export const REQUEUE_GAPS = {
  // Kevés lap múlva jön vissza: könnyebb eltalálni, gyorsabb megerősítés.
  easy: 5,
  normal: 12,
  // Sok lap múlva: mire visszaér, tényleg elő kell hívni.
  hard: 25,
} as const;

export type RequeueLevel = keyof typeof REQUEUE_GAPS;

export const REQUEUE_LEVELS: RequeueLevel[] = ['easy', 'normal', 'hard'];

export const DEFAULT_REQUEUE_LEVEL: RequeueLevel = 'normal';

export function requeueGapFor(level: string): number {
  return REQUEUE_GAPS[(level as RequeueLevel)] ?? REQUEUE_GAPS[DEFAULT_REQUEUE_LEVEL];
}

/**
 * Hova kerüljön vissza az elrontott kártya, miután kivettük a sorból.
 *
 * @param restLength a sor hossza a kártya kivétele UTÁN
 * @param currentIndex ahol a kártya állt (a kivétel után ez már a következő lap)
 * @param gap hány lap teljen el, mielőtt újra jön
 * @returns beszúrási index a maradék sorban, sosem a hosszon túl
 */
export function requeueIndex(restLength: number, currentIndex: number, gap: number): number {
  if (restLength <= 0) return 0;
  return Math.min(currentIndex + Math.max(1, gap), restLength);
}
