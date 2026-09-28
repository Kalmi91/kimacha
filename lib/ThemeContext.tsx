import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemScheme } from 'react-native';

import Colors, { isDarkTheme } from '@/constants/Colors';
import {
  BASE,
  DEFAULT_GRAMMAR_PALETTE,
  ON_FILL,
  PALETTE_FILLS,
  type GrammarPaletteId,
} from '@/constants/GrammarPalettes';
import { getDb } from '@/lib/database';

type Theme = 'light' | 'dark';
type ThemeOverride = Theme | 'system';
// NY20: brutalista palettánál a `theme` a `<paletta>-light|dark` kulcs
// (Colors['brand-light'] ...), így a meglévő `Colors[theme]` hívók külön
// átírás nélkül váltanak; classic esetén a mai 'light' | 'dark'. A mód
// (papír / tinta) az Auto / Light / Dark beállítást követi.
export type ThemeKey = keyof typeof Colors;

const ThemeContext = createContext<{
  theme: ThemeKey;
  override: ThemeOverride;
  setOverride: (o: ThemeOverride) => void;
  grammarPalette: GrammarPaletteId;
  setGrammarPalette: (p: GrammarPaletteId) => void;
}>({
  theme: 'dark',
  override: 'system',
  setOverride: () => {},
  grammarPalette: DEFAULT_GRAMMAR_PALETTE,
  setGrammarPalette: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const raw = useSystemScheme();
  const systemScheme: Theme = raw === 'light' ? 'light' : 'dark';
  const [override, setOverride] = useState<ThemeOverride>('system');
  const [grammarPalette, setPalette] = useState<GrammarPaletteId>(DEFAULT_GRAMMAR_PALETTE);
  const mode: Theme = override === 'system' ? systemScheme : override;
  const theme: ThemeKey = grammarPalette === 'classic' ? mode : (`${grammarPalette}-${mode}` as ThemeKey);

  useEffect(() => {
    let alive = true;
    getDb()
      .getGrammarPalette()
      .then(p => {
        if (alive) setPalette(p);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const setGrammarPalette = (p: GrammarPaletteId) => {
    setPalette(p);
    getDb().setGrammarPalette(p).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ theme, override, setOverride, grammarPalette, setGrammarPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

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

// NY20: a brutalista kulcsok a nyelvtan-képernyőknek. classic esetén a mai
// Colors[theme]-ből képez ugyanilyen kulcsokat (brutal = false).
export function useGrammarColors(): GrammarColors {
  const { theme, grammarPalette } = useTheme();
  if (grammarPalette === 'classic') {
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
  const fills = PALETTE_FILLS[grammarPalette];
  return { ...base, ...fills, onFill: ON_FILL, text: base.ink, brutal: true };
}
