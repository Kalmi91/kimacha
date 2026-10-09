// Neo-brutalist palettes. The mode follows the
// existing Auto / Light / Dark theme setting: light = "paper", dark
// = "ink" (BASE). Each palette has only the two fill colors: a = accent,
// b = second color; text on a colored fill is always ON_FILL. 'classic' is not
// brutalist: it returns today's Colors[light|dark] values (lib/ThemeContext.tsx).
export type GrammarPaletteId = 'brand' | 'electric' | 'lime' | 'cyan' | 'orange' | 'classic';
export type FillPaletteId = Exclude<GrammarPaletteId, 'classic'>;

type PaletteFills = { a: string; b: string };
// bg = background, paper = card, ink = frame + text, mu = muted text.
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
