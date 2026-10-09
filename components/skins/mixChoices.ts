import { SKIN_DECOR } from '@/components/skins';
import type { FillPaletteId, GrammarPaletteId } from '@/constants/GrammarPalettes';
import { SKIN_GROUPS, SKINS, type SkinId } from '@/constants/Skins';

// the contents of the My mix chip rows (app/theme-mix.tsx).

// All themes in the group order of Settings.
export const SKIN_ORDER: SkinId[] = SKIN_GROUPS.flatMap((group) => group.skins);

const OLD_PALETTES: FillPaletteId[] = ['electric', 'lime', 'cyan', 'orange'];

// The Colors row: all themes, then after Neo-brutal the 4 old sub-palettes.
export const COLOR_CHOICES: (SkinId | GrammarPaletteId)[] = SKIN_ORDER.flatMap((id) =>
  id === 'brutal' ? [id, ...OLD_PALETTES] : [id],
);

export const shapeKey = (id: SkinId): string => JSON.stringify(SKINS[id].shape);

// The Shape row: duplicate shapes merged (the first theme in group order is kept).
export function uniqueShapeChoices(): SkinId[] {
  const seen = new Set<string>();
  return SKIN_ORDER.filter((id) => {
    const key = shapeKey(id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// The Decor row: None + the themes that have a registered decor.
export function decorChoices(): (SkinId | 'none')[] {
  return ['none', ...SKIN_ORDER.filter((id) => SKIN_DECOR[id])];
}
