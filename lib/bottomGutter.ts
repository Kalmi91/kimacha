// FB202, Kálmán 2026-09-09 (grammar:clases-de-palabras:lesson): „az app nem veszi
// figyelembe hogy a telefonomon van alul a vissza gomb meg az ilyenek valahol jó
// valahol nem, amikro a chevk gombot csináltuk akkor is ez előjött. ugy kellen
// megcsinálni, hogy az app nézze meg hogy van e olyan ha van akkor úgy töltse be az
// appot, hogy ne legyen átfedés".
//
// Eddig képernyőnként foltoztuk: a tanuló-lap dokkolt Check gombja kapott egy
// `insets.bottom` emelést (FB178), a többi képernyő nem kapott semmit, és a
// rendszer navigációs sávja (gesztus-csík vagy a három gomb) alá futott. Innentől
// a gyökér-layout tartja a rést, egy helyen, minden képernyőnek.
//
// A `(tabs)` csoport a kivétel: ott a fülsáv maga rajzol bele az inset-be
// (React Navigation bottom-tabs), tehát ha a gyökér is kipárnázna, a fülsáv egy
// navigációs-sávnyival a levegőben lógna.

/**
 * Mekkora alsó rés kell a gyökér-layoutnak az aktuális útvonalon.
 *
 * @param segments az expo-router `useSegments()` értéke
 * @param insetBottom a rendszer alsó safe-area inset-je (0, ha nincs sáv)
 * @returns a rés pontokban
 */
export function bottomGutter(segments: string[], insetBottom: number): number {
  // Az első képernyő kirajzolása előtt még nincs útvonal. Ilyenkor nem párnázunk,
  // hogy a fülekkel induló app ne ugorjon egyet az első képkockán.
  if (segments.length === 0) return 0;
  if (segments[0] === '(tabs)') return 0;
  return Math.max(0, insetBottom);
}
