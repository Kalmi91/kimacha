import { useMemo } from 'react';

import { isDarkTheme } from '@/constants/Colors';
import { DEFAULT_GRAMMAR_PALETTE } from '@/constants/GrammarPalettes';
import { DEFAULT_SKIN_MIX, type Skin, type SkinId, type SkinMode, type SkinSelection } from '@/constants/Skins';
import { useGrammarColors, type GrammarColors } from '@/lib/grammarColors';
import { composeSkin, skinIdOfTheme } from '@/lib/skinTheme';
import { useTheme, type ThemeKey } from '@/lib/ThemeContext';

type SkinState = {
  // The selection ('mix' = My mix).
  id: SkinSelection;
  // The active Skin (for a mix, composed from the four sources).
  skin: Skin;
  // The resolved colors in the active mode (same as useGrammarColors()).
  colors: GrammarColors;
  mode: SkinMode;
  theme: ThemeKey;
  // true: a single-mode theme, the light / dark setting has no effect (Settings hides it).
  modeLocked: boolean;
  // The theme providing the decoration (mix.decor for a mix); 'none' = no decoration.
  decorId: SkinId | 'none';
};

// The active theme, with the resolved colors and mode. In tests that mock ThemeContext with only a
// `theme` (no skin), it is inferred from the theme key.
export function useSkin(): SkinState {
  const ctx = useTheme();
  const colors = useGrammarColors();
  const { theme } = ctx;
  const id: SkinSelection = ctx.skin ?? skinIdOfTheme(theme);
  const mix = ctx.skinMix ?? DEFAULT_SKIN_MIX;
  const palette = ctx.grammarPalette ?? DEFAULT_GRAMMAR_PALETTE;
  const skin = useMemo(() => composeSkin(id, mix, palette), [id, mix, palette]);
  return {
    id,
    skin,
    colors,
    mode: isDarkTheme(theme) ? 'dark' : 'light',
    theme,
    modeLocked: skin.modes.length === 1,
    decorId: id === 'mix' ? mix.decor : id,
  };
}
