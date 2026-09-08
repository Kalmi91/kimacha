// FB188, Kálmán 2026-09-08 (word:beef): „szeretnék egy olyat, hogy amikor ilyen szó
// van akkor ne begépelni kelljen a el la t hanem kiválasztani itt legyen 3 opcio el
// le vagy none mármint egy kor áthúzva. […] a cél az hogy sokszór szó közben
// változtatom meg és egyszerűen akarom változtatgatni".
//
// Három gombot kért, de a korpuszban többes névelő is van (los zapatos, las gafas),
// és ha a gombsor CSAK a névelős kártyákon jelenne meg, a puszta megjelenése
// elmondaná, hogy kell névelő. Ezért öt gomb (el / la / los / las / ⊘), és minden
// spanyol FŐNÉV-kártyán ott van, névelőstől-névelőtlenül. A ⊘ az alapállás, tehát
// aki nem nyúl hozzá, ugyanúgy gépelhet, mint eddig.

export const ARTICLE_OPTIONS = ['el', 'la', 'los', 'las'] as const;

export type ArticlePick = '' | (typeof ARTICLE_OPTIONS)[number];

/**
 * Megjelenik-e a gombsor. Csak akkor, ha a beírandó nyelv a spanyol és a kártya
 * főnevet kérdez: igénél és melléknévnél nincs mit választani.
 */
export function articlePickerApplies(backLang: string, pos: string | undefined): boolean {
  return backLang === 'es' && pos === 'noun';
}

/** Amit az értékelő lát: a választott névelő és a begépelt szó egy stringben. */
export function composeAnswer(pick: ArticlePick, typed: string): string {
  const body = typed.trim();
  if (!pick) return body;
  if (!body) return pick;
  return `${pick} ${body}`;
}

/**
 * A helyes alak névelője, hogy felfedéskor a gombsor a JÓ választ mutassa
 * (a tanuló lássa, mit kellett volna nyomnia).
 */
export function articleOf(text: string): ArticlePick {
  const first = text.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return (ARTICLE_OPTIONS as readonly string[]).includes(first) ? (first as ArticlePick) : '';
}

/** A helyes alak névelő nélkül, a gépelős mező elvárt tartalma. */
export function bodyOf(text: string): string {
  const trimmed = text.trim();
  return articleOf(trimmed) ? trimmed.split(/\s+/).slice(1).join(' ') : trimmed;
}
