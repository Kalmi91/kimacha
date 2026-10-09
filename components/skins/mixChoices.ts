import { SKIN_DECOR } from '@/components/skins';
import type { FillPaletteId, GrammarPaletteId } from '@/constants/GrammarPalettes';
import { SKIN_GROUPS, SKINS, type SkinId } from '@/constants/Skins';

// a Saját mix chip-sorainak tartalma (app/theme-mix.tsx).

// Az összes téma a Beállítások csoport-sorrendjében.
export const SKIN_ORDER: SkinId[] = SKIN_GROUPS.flatMap((group) => group.skins);

const OLD_PALETTES: FillPaletteId[] = ['electric', 'lime', 'cyan', 'orange'];

// A Colors-sor: az összes téma, a Neo-brutál után a régi 4 al-paletta.
export const COLOR_CHOICES: (SkinId | GrammarPaletteId)[] = SKIN_ORDER.flatMap((id) =>
  id === 'brutal' ? [id, ...OLD_PALETTES] : [id],
);

export const shapeKey = (id: SkinId): string => JSON.stringify(SKINS[id].shape);

// A Shape-sor: a duplikált formák összevonva (az első, csoport-sorrend szerinti téma marad).
export function uniqueShapeChoices(): SkinId[] {
  const seen = new Set<string>();
  return SKIN_ORDER.filter((id) => {
    const key = shapeKey(id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// A Decor-sor: None + azok a témák, amelyeknek van regisztrált díszük.
export function decorChoices(): (SkinId | 'none')[] {
  return ['none', ...SKIN_ORDER.filter((id) => SKIN_DECOR[id])];
}
