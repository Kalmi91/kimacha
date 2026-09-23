// FB201, Kálmán 2026-09-09 (talk-tab): „nem mindenhol van feedback gomb tegyél
// mindenhohova hogy tudd mire írom a gondod mely részére".
//
// A 💬 gomb önmagában kevés: a sheet-sornak meg kell mondania, MELYIK képernyőről
// jött. Ez a modul útvonal-csoporttól függetlenül állítja elő a címkét, hogy
// bármelyik al-képernyő-csoport ráülhessen egyetlen mountolt gombbal.

/**
 * A `currentCard` címke az aktuális útvonalból.
 *
 * `/grammar/ser-estar` → `grammar:ser-estar`, `/pcic/b1` → `pcic:b1`.
 *
 * @param pathname az expo-router `usePathname()` értéke
 */
export function feedbackTag(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return 'app';
  const prefix = parts[0];
  // A csoport saját indexén nincs mit megnevezni, ott a csoport neve a címke.
  const leaf = parts.length > 1 ? parts.slice(1).join(':') : 'index';
  return `${prefix}:${leaf}`;
}
