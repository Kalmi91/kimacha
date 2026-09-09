// FB201, Kálmán 2026-09-09 (talk-tab): „nem mindenhol van feedback gomb tegyél
// mindenhohova hogy tudd mire írom a gondod mely részére".
//
// A 💬 gomb önmagában kevés: a sheet-sornak meg kell mondania, MELYIK képernyőről
// jött. A játék-csoport ezt eddig a saját `GameFeedback` komponensében számolta
// (FB168); ez a modul ugyanazt csinálja, csak útvonal-csoporttól függetlenül, hogy
// bármelyik al-képernyő-csoport ráülhessen egyetlen mountolt gombbal.

// A csoport neve és a sorban látszó címke nem mindig ugyanaz: a `games/` mappából
// `game:` lesz, ahogy eddig is (`game:word-rain`, `game:ccat`).
const GROUP_TAGS: Record<string, string> = {
  games: 'game',
};

/**
 * A `currentCard` címke az aktuális útvonalból.
 *
 * `/games/word-rain` → `game:word-rain`, `/talk/comida` → `talk:comida`,
 * `/talk/quiz` → `talk:quiz`.
 *
 * @param pathname az expo-router `usePathname()` értéke
 */
export function feedbackTag(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return 'app';
  const prefix = GROUP_TAGS[parts[0]] ?? parts[0];
  // A csoport saját indexén nincs mit megnevezni, ott a csoport neve a címke.
  const leaf = parts.length > 1 ? parts.slice(1).join(':') : 'index';
  return `${prefix}:${leaf}`;
}
