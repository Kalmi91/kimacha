import Colors, { isDarkTheme } from '@/constants/Colors';
import { BASE, ON_FILL, PALETTE_FILLS, type FillPaletteId } from '@/constants/GrammarPalettes';
import { SKINS, bestOn, isSkinId, skinColorsFor } from '@/constants/Skins';
import { useTheme, type ThemeKey } from '@/lib/ThemeContext';

export type GrammarColors = {
  bg: string;
  paper: string;
  ink: string;
  mu: string;
  a: string;
  b: string;
  onFill: string;
  // Text on the paper / bg (= ink).
  text: string;
  // true: brutalist shapes (BrutalBox, Sticker, SegmentBar); false: classic.
  brutal: boolean;
  // text on the a / b / c fill (onFill = onA), the third color,
  // the border's own color (default: ink), text on the ink fill, theme-specific colors.
  onA: string;
  onB: string;
  c: string;
  border: string;
  onInk: string;
  extra: Record<string, string>;
};

// keys for the grammar screens, built from the theme key (`<palette>-light|dark` or the
// classic 'light' | 'dark'). For classic it builds the same keys from today's
// Colors[theme] values (brutal = false). It depends only on `theme`,
// so in tests that mock `useTheme` ('light') the classic branch runs.
// The `<theme-id>-<mode>` keys (constants/Skins.ts) give the theme's colors.
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
      onA: c.onTint,
      // contrast on the pink (b) fill was 3.53 for white and 5.2 for black.
      onB: bestOn(c.accent, [c.onTint, '#000000']),
      c: c.accent,
      border: c.text,
      onInk: c.accent,
      extra: {},
    };
  }
  const mode = isDarkTheme(theme) ? 'dark' : 'light';
  const id = theme.slice(0, theme.lastIndexOf('-'));
  if (isSkinId(id)) {
    const c = skinColorsFor(SKINS[id], mode);
    const b = c.b ?? c.a;
    const cc = c.c ?? b;
    return {
      bg: c.bg,
      paper: c.paper,
      ink: c.ink,
      mu: c.mu,
      a: c.a,
      b,
      onFill: c.onA,
      text: c.ink,
      brutal: true,
      onA: c.onA,
      onB: c.onB ?? (c.b ? bestOn(b, [c.onA, c.ink, c.bg]) : c.onA),
      c: cc,
      border: c.border ?? c.ink,
      onInk: c.bg,
      extra: c.extra ?? {},
    };
  }
  const base = BASE[mode];
  const fills = PALETTE_FILLS[id as FillPaletteId];
  return {
    ...base,
    ...fills,
    onFill: ON_FILL,
    text: base.ink,
    brutal: true,
    onA: ON_FILL,
    onB: ON_FILL,
    c: fills.b,
    border: base.ink,
    onInk: mode === 'dark' ? base.bg : fills.b,
    extra: {},
  };
}

export function useGrammarColors(): GrammarColors {
  const { theme, skin, skinMix } = useTheme();
  const g = grammarColorsFor(theme);
  // Own mix: the shape comes from the `shape` theme; classic shape = today's look (not brutalist).
  if (skin === 'mix' && skinMix) return { ...g, brutal: skinMix.shape !== 'classic' };
  return g;
}
