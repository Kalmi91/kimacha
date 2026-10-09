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
  // Szöveg a papíron / bg-n (= ink).
  text: string;
  // true: brutalista formák (BrutalBox, Sticker, SegmentBar); false: classic.
  brutal: boolean;
  // szöveg az a / b / c kitöltésen (onFill = onA), a harmadik szín,
  // a keret saját színe (alap: ink), szöveg ink kitöltésen, téma-specifikus színek.
  onA: string;
  onB: string;
  c: string;
  border: string;
  onInk: string;
  extra: Record<string, string>;
};

// a téma-kulcsból (`<paletta>-light|dark` vagy a classic 'light' | 'dark')
// képzett kulcsok a nyelvtan-képernyőknek. classic esetén a mai Colors[theme]
// értékeiből képez ugyanilyen kulcsokat (brutal = false). Csak a `theme`-től
// függ, ezért a `useTheme`-et mockoló tesztekben ('light') a classic ág fut.
// A `<téma-id>-<mód>` kulcsok (constants/Skins.ts) a téma színeit adják.
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
      // a rózsaszín (b) kitöltésen a fehér 3,53 volt, a fekete 5,2.
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
  // Saját mix: a formát a `shape` téma adja; classic forma = a mai kinézet (nem brutalista).
  if (skin === 'mix' && skinMix) return { ...g, brutal: skinMix.shape !== 'classic' };
  return g;
}
