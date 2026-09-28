import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemScheme } from 'react-native';

import Colors from '@/constants/Colors';
import { DEFAULT_GRAMMAR_PALETTE, type GrammarPaletteId } from '@/constants/GrammarPalettes';
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
