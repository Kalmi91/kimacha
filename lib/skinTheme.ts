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

// From the theme selection (skin / mix + sub-palette + mode), the Colors key and the
// composed Skin. Pure functions, so that ThemeContext and useSkin see the same thing.

// The source of the colors: a theme or (in My mix) a Neo-brutalist sub-palette.
type ColorsSource = SkinId | GrammarPaletteId;

export function colorsSourceOf(skin: SkinSelection, mix: SkinMix): ColorsSource {
  return skin === 'mix' ? mix.colors : skin;
}

const BOTH: SkinMode[] = ['light', 'dark'];

export function modesOfSource(source: ColorsSource): SkinMode[] {
  return isSkinId(source) ? SKINS[source].modes : BOTH;
}

// The Neo-brutalist sub-palette: the saved value; the old 'classic' (not a sub-palette) falls back to brand here.
function fillPaletteOf(grammarPalette: GrammarPaletteId): FillPaletteId {
  return grammarPalette === 'classic' ? 'brand' : grammarPalette;
}

// brutal → the saved sub-palette; classic → today's 'light' | 'dark' key; everything else `<id>-<mode>`.
export function themeKeyFor(source: ColorsSource, mode: SkinMode, grammarPalette: GrammarPaletteId): ThemeKey {
  if (source === 'classic') return mode;
  if (source === 'brutal') return `${fillPaletteOf(grammarPalette)}-${mode}` as ThemeKey;
  return `${source}-${mode}` as ThemeKey;
}

// From the theme key to the theme id: tests that mock ThemeContext ({ theme: 'light' }) call it without a skin.
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

// The active Skin: a theme itself, or composed from the four sources of My mix (color, font, shape;
// the decoration is resolved by useSkinDecor from mix.decor).
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
