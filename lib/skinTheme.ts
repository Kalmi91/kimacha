import type { FillPaletteId, GrammarPaletteId } from '@/constants/GrammarPalettes';
import {
  SKINS,
  brutalSkinColors,
  isSkinId,
  type Skin,
  type SkinId,
  type SkinMix,
  type SkinMode,
  type SkinSelection,
} from '@/constants/Skins';
import type { ThemeKey } from '@/lib/ThemeContext';

// PLAN-temak 2A: a téma-kiválasztásból (skin / mix + al-paletta + mód) a Colors-kulcs és az
// összerakott Skin. Tiszta függvények, hogy a ThemeContext és a useSkin ugyanazt lássa.

// A színek forrása: egy téma vagy (Saját mixben) egy Neo-brutál al-paletta.
export type ColorsSource = SkinId | GrammarPaletteId;

export function colorsSourceOf(skin: SkinSelection, mix: SkinMix): ColorsSource {
  return skin === 'mix' ? mix.colors : skin;
}

const BOTH: SkinMode[] = ['light', 'dark'];

export function modesOfSource(source: ColorsSource): SkinMode[] {
  return isSkinId(source) ? SKINS[source].modes : BOTH;
}

// A Neo-brutál al-paletta: a mentett érték; a régi 'classic' (nem al-paletta) itt brand-re esik.
function fillPaletteOf(grammarPalette: GrammarPaletteId): FillPaletteId {
  return grammarPalette === 'classic' ? 'brand' : grammarPalette;
}

// brutal → a mentett al-paletta; classic → a mai 'light' | 'dark' kulcs; minden más `<id>-<mód>`.
export function themeKeyFor(source: ColorsSource, mode: SkinMode, grammarPalette: GrammarPaletteId): ThemeKey {
  if (source === 'classic') return mode;
  if (source === 'brutal') return `${fillPaletteOf(grammarPalette)}-${mode}` as ThemeKey;
  return `${source}-${mode}` as ThemeKey;
}

// A téma-kulcsból a téma-id: a ThemeContextet mockoló tesztek ({ theme: 'light' }) skin nélkül hívják.
export function skinIdOfTheme(theme: ThemeKey): SkinId {
  if (theme === 'light' || theme === 'dark') return 'classic';
  const id = theme.slice(0, theme.lastIndexOf('-'));
  return isSkinId(id) ? id : 'brutal';
}

function colorsOfSource(source: ColorsSource, grammarPalette: GrammarPaletteId): Skin['colors'] {
  if (source === 'brutal') return brutalSkinColors(fillPaletteOf(grammarPalette));
  if (isSkinId(source)) return SKINS[source].colors;
  return brutalSkinColors(source as FillPaletteId);
}

// Az aktív Skin: egy téma maga, vagy a Saját mix négy forrásából összerakva (szín, betű, forma;
// a díszt a useSkinDecor oldja fel a mix.decor-ból).
export function composeSkin(selection: SkinSelection, mix: SkinMix, grammarPalette: GrammarPaletteId): Skin {
  if (selection === 'mix') {
    const font = SKINS[mix.font];
    return {
      ...font,
      id: 'mix',
      group: 'hangulat',
      modes: modesOfSource(mix.colors),
      colors: colorsOfSource(mix.colors, grammarPalette),
      shape: SKINS[mix.shape].shape,
    };
  }
  if (selection === 'brutal') return { ...SKINS.brutal, colors: colorsOfSource('brutal', grammarPalette) };
  return SKINS[selection];
}
