import { useMemo } from 'react';

import { isDarkTheme } from '@/constants/Colors';
import { DEFAULT_GRAMMAR_PALETTE } from '@/constants/GrammarPalettes';
import { DEFAULT_SKIN_MIX, type Skin, type SkinId, type SkinMode, type SkinSelection } from '@/constants/Skins';
import { useGrammarColors, type GrammarColors } from '@/lib/grammarColors';
import { composeSkin, skinIdOfTheme } from '@/lib/skinTheme';
import { useTheme, type ThemeKey } from '@/lib/ThemeContext';

type SkinState = {
  // A kiválasztás ('mix' = Saját mix).
  id: SkinSelection;
  // Az aktív Skin (mixnél a négy forrásból összerakva).
  skin: Skin;
  // A feloldott színek az aktív módban (ugyanaz, mint a useGrammarColors()).
  colors: GrammarColors;
  mode: SkinMode;
  theme: ThemeKey;
  // true: egy módú téma, a világos / sötét beállítás hatástalan (a Beállítások elrejti).
  modeLocked: boolean;
  // A díszt adó téma (mixnél a mix.decor); 'none' = nincs dísz.
  decorId: SkinId | 'none';
};

// az aktív téma, a feloldott színekkel és móddal. A ThemeContextet csak a
// `theme`-mel mockoló tesztekben (skin nélkül) a téma-kulcsból következtet.
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
