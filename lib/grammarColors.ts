import Colors, { isDarkTheme } from '@/constants/Colors';
import { BASE, ON_FILL, PALETTE_FILLS, type FillPaletteId } from '@/constants/GrammarPalettes';
import { useTheme, type ThemeKey } from '@/lib/ThemeContext';

export type GrammarColors = {
  bg: string;
  paper: string;
  ink: string;
  mu: string;
  a: string;
  b: string;
  onFill: string;
  // Szöveg a papíron / bg-n (= ink).
  text: string;
  // true: brutalista formák (BrutalBox, Sticker, SegmentBar); false: classic.
  brutal: boolean;
};

// NY20: a téma-kulcsból (`<paletta>-light|dark` vagy a classic 'light' | 'dark')
// képzett kulcsok a nyelvtan-képernyőknek. classic esetén a mai Colors[theme]
// értékeiből képez ugyanilyen kulcsokat (brutal = false). Csak a `theme`-től
// függ, ezért a `useTheme`-et mockoló tesztekben ('light') a classic ág fut.
export function grammarColorsFor(theme: ThemeKey): GrammarColors {
  if (theme === 'light' || theme === 'dark') {
    const c = Colors[theme];
    return {
      bg: c.background,
      paper: c.card,
      ink: c.text,
      mu: c.textMuted,
      a: c.tint,
      b: c.accent,
      onFill: c.onTint,
      text: c.text,
      brutal: false,
    };
  }
  const base = BASE[isDarkTheme(theme) ? 'dark' : 'light'];
  const fills = PALETTE_FILLS[theme.split('-')[0] as FillPaletteId];
  return { ...base, ...fills, onFill: ON_FILL, text: base.ink, brutal: true };
}

export function useGrammarColors(): GrammarColors {
  return grammarColorsFor(useTheme().theme);
}
