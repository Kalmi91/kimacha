import type { ComponentType, ReactNode } from 'react';

// PLAN-temak 2A: a téma dísz-rétege. Minden mező opcionális; ami hiányzik, az no-op, és a mai
// kinézet változatlan marad. A díszeket a 4D / 6E lépés írja és regisztrálja (components/skins/index.ts).
// A `children` mindenhol az alap (dísz nélküli) tartalom: a dísz körbeveheti vagy lecserélheti.
export type SkinDecor = {
  // A képernyő háttér-rétege (a tartalom mögött, a háttérszín fölött; a SkinBackdrop absolute-ba teszi).
  Backdrop?: ComponentType;
  // A fül-képernyők fejléce körüli dísz (pl. vonalak a cím két oldalán).
  HeaderOrnament?: ComponentType<{ children: ReactNode }>;
  // A Szavak-fül kártyája körüli keret / dísz.
  CardFrame?: ComponentType<{ children: ReactNode }>;
  // A szó megjelenítése a kártyán (szótagolás, iniciálé, olvasó-sáv ...); `word` = a nyers szöveg,
  // `lang` = a szó nyelve (PLAN-temak 6E, opcionális: a konnyu csak spanyol szót szótagol).
  WordRenderer?: ComponentType<{ word: string; lang?: string; children: ReactNode }>;
  // Gomb-változat (senior: egymás alatt, ikon + szöveg; zen: csak szöveg; retro95: első betű aláhúzva).
  buttonVariant?: 'default' | 'stacked' | 'text' | 'bevel';
  // PLAN-temak 6E (senior): a hang-gomb mellett szöveges felirat ("Felolvas"); lásd SkinSpeakLabel.
  speakLabel?: boolean;
  // PLAN-temak 7G (retro95): a dokkolt Check-sáv kitöltése `a` (a spec szerint sötétkék, fehér szöveg);
  // alapból ink, mint a Neo-brutálon.
  checkFill?: 'a';
};
