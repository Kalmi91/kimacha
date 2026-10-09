import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemScheme } from 'react-native';

import Colors from '@/constants/Colors';
import { DEFAULT_GRAMMAR_PALETTE, type GrammarPaletteId } from '@/constants/GrammarPalettes';
import {
  DEFAULT_SKIN_MIX,
  legacySkinFor,
  resolveMode,
  type SkinMix,
  type SkinSelection,
} from '@/constants/Skins';
import { getDb } from '@/lib/database';
import { colorsSourceOf, modesOfSource, themeKeyFor } from '@/lib/skinTheme';
import { getWebTestParams } from '@/lib/webTestHooks';

type Theme = 'light' | 'dark';
type ThemeOverride = Theme | 'system';
// For a brutalist palette `theme` is the `<palette>-light|dark` key
// (Colors['brand-light'] ...), so existing `Colors[theme]` callers switch
// without any rewrite; for classic it stays today's 'light' | 'dark'. The mode
// (paper / ink) follows the Auto / Light / Dark setting.
// The other themes use the `<theme-id>-<mode>` key (constants/Skins.ts); for a
// single-mode theme the mode belongs to the theme and Auto / Light / Dark has no effect.
export type ThemeKey = keyof typeof Colors;

// Exported: the live preview of My mix (app/theme-mix.tsx) overrides the context with the draft mix.
export const ThemeContext = createContext<{
  theme: ThemeKey;
  override: ThemeOverride;
  setOverride: (o: ThemeOverride) => void;
  grammarPalette: GrammarPaletteId;
  setGrammarPalette: (p: GrammarPaletteId) => void;
  // the active theme (the saved one, or for a legacy user the one derived from the palette),
  // the four sources of My mix, and their setters (which also persist to the db).
  skin: SkinSelection;
  setSkin: (s: SkinSelection) => void;
  skinMix: SkinMix;
  setSkinMix: (m: SkinMix) => void;
}>({
  theme: 'dark',
  override: 'system',
  setOverride: () => {},
  grammarPalette: DEFAULT_GRAMMAR_PALETTE,
  setGrammarPalette: () => {},
  skin: 'brutal',
  setSkin: () => {},
  skinMix: DEFAULT_SKIN_MIX,
  setSkinMix: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const raw = useSystemScheme();
  const systemScheme: Theme = raw === 'light' ? 'light' : 'dark';
  const [override, setOverride] = useState<ThemeOverride>(() => getWebTestParams()?.mode ?? 'system');
  const [grammarPalette, setPalette] = useState<GrammarPaletteId>(DEFAULT_GRAMMAR_PALETTE);
  // null = no theme chosen yet: the legacy (palette-based) behavior, see legacySkinFor.
  const [chosenSkin, setChosenSkin] = useState<SkinSelection | null>(null);
  const [skinMix, setMix] = useState<SkinMix>(DEFAULT_SKIN_MIX);
  const skin: SkinSelection = chosenSkin ?? legacySkinFor(grammarPalette);
  const source = colorsSourceOf(skin, skinMix);
  const mode: Theme = resolveMode(modesOfSource(source), override, systemScheme);
  const theme: ThemeKey = themeKeyFor(source, mode, grammarPalette);

  useEffect(() => {
    let alive = true;
    getDb()
      .getGrammarPalette()
      .then(p => {
        if (alive) setPalette(p);
      })
      .catch(() => {});
    getDb()
      .getSkin()
      .then(s => {
        if (alive) setChosenSkin(s);
      })
      .catch(() => {});
    getDb()
      .getSkinMix()
      .then(m => {
        if (alive && m) setMix(m);
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

  const setSkin = (s: SkinSelection) => {
    setChosenSkin(s);
    getDb().setSkin(s).catch(() => {});
  };

  const setSkinMix = (m: SkinMix) => {
    setMix(m);
    getDb().setSkinMix(m).catch(() => {});
  };

  return (
    <ThemeContext.Provider
      value={{ theme, override, setOverride, grammarPalette, setGrammarPalette, skin, setSkin, skinMix, setSkinMix }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
