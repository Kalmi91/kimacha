import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemScheme } from 'react-native';

import Colors from '@/constants/Colors';
import {
  DEFAULT_GRAMMAR_PALETTE,
  NEON_PALETTES,
  type GrammarPaletteId,
  type NeonPalette,
} from '@/constants/GrammarPalettes';
import { getDb } from '@/lib/database';

type Theme = 'light' | 'dark';
type ThemeOverride = Theme | 'system';
// NY11: neon palettánál a `theme` a paletta kulcsa (Colors.electric ...), így a
// meglévő `Colors[theme]` hívók külön átírás nélkül váltanak; classic esetén a
// mai 'light' | 'dark'. A neon mindig sötét: az isDark-ot ez adja.
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
  const classicTheme: Theme = override === 'system' ? systemScheme : override;
  const theme: ThemeKey = grammarPalette === 'classic' ? classicTheme : grammarPalette;

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

export type GrammarColors = NeonPalette & { text: string };

// NY11: a neon-kulcsok a nyelvtan-képernyőknek. classic esetén a mai
// Colors[theme]-ből képez ugyanilyen kulcsokat.
export function useGrammarColors(): GrammarColors {
  const { theme, grammarPalette } = useTheme();
  const colors = Colors[theme];
  if (grammarPalette !== 'classic') {
    return { ...NEON_PALETTES[grammarPalette], text: colors.text };
  }
  return {
    bg: colors.background,
    card: colors.card,
    chip: colors.border,
    a: colors.tint,
    b: colors.accent,
    mu: colors.textMuted,
    tr: colors.border,
    on: colors.onTint,
    text: colors.text,
  };
}
