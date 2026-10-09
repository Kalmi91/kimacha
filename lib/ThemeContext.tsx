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
// brutalista palettánál a `theme` a `<paletta>-light|dark` kulcs
// (Colors['brand-light'] ...), így a meglévő `Colors[theme]` hívók külön
// átírás nélkül váltanak; classic esetén a mai 'light' | 'dark'. A mód
// (papír / tinta) az Auto / Light / Dark beállítást követi.
// A többi téma `<téma-id>-<mód>` kulcson (constants/Skins.ts); egy módú
// témánál a mód a témáé, az Auto / Light / Dark hatástalan.
export type ThemeKey = keyof typeof Colors;

// Exportált: a Saját mix élő előnézete (app/theme-mix.tsx) a piszkozat-mixszel felülírja a kontextust.
export const ThemeContext = createContext<{
  theme: ThemeKey;
  override: ThemeOverride;
  setOverride: (o: ThemeOverride) => void;
  grammarPalette: GrammarPaletteId;
  setGrammarPalette: (p: GrammarPaletteId) => void;
  // az aktív téma (a mentett, vagy régi felhasználónál a paletta szerinti),
  // a Saját mix négy forrása, és a váltásuk (a db-be is mentenek).
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
  // null = még nincs választott téma: a régi (paletta-alapú) viselkedés, lásd legacySkinFor.
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
