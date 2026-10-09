// Neo-brutalista paletták. A mód a
// meglévő Auto / Light / Dark téma-beállítást követi: világos = "papír", sötét
// = "tinta" (BASE). A palettánként csak a két kitöltő szín van: a = akcentus,
// b = második szín; a szöveg színes kitöltésen mindig ON_FILL. A 'classic' nem
// brutalista: a mai Colors[light|dark] értékeket adja (lib/ThemeContext.tsx).
export type GrammarPaletteId = 'brand' | 'electric' | 'lime' | 'cyan' | 'orange' | 'classic';
export type FillPaletteId = Exclude<GrammarPaletteId, 'classic'>;

type PaletteFills = { a: string; b: string };
// bg = háttér, paper = kártya, ink = keret + szöveg, mu = halvány szöveg.
type PaletteBase = { bg: string; paper: string; ink: string; mu: string };

export const DEFAULT_GRAMMAR_PALETTE: GrammarPaletteId = 'brand';

const GRAMMAR_PALETTE_IDS: GrammarPaletteId[] = ['brand', 'electric', 'lime', 'cyan', 'orange', 'classic'];

export const ON_FILL = '#111111';

export const BASE: Record<'light' | 'dark', PaletteBase> = {
  light: { bg: '#FFFBEA', paper: '#FFFFFF', ink: '#111111', mu: '#6B6B6B' },
  dark: { bg: '#111111', paper: '#1C1C1C', ink: '#F5F5F5', mu: '#A0A0A0' },
};

export const PALETTE_FILLS: Record<FillPaletteId, PaletteFills> = {
  brand: { a: '#EC4899', b: '#22D3EE' },
  electric: { a: '#3D7BFF', b: '#FFD23F' },
  lime: { a: '#C6FF3D', b: '#FF4FD8' },
  cyan: { a: '#22D3EE', b: '#A78BFA' },
  orange: { a: '#FF8A3D', b: '#2EE6C5' },
};

export function isGrammarPaletteId(v: unknown): v is GrammarPaletteId {
  return typeof v === 'string' && (GRAMMAR_PALETTE_IDS as string[]).includes(v);
}
