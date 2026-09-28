// Neon sötét paletták (NY11). Kulcsok: bg = háttér, card = kártya,
// chip = chip / nem választott gomb, a = akcentus, b = második szín,
// mu = halvány szöveg, tr = progress-sáv alja, on = szöveg akcentus kitöltésen.
// Az alap szöveg minden neon palettán ugyanaz (NEON_TEXT). A 'classic' nem
// neon: a mai Colors[theme] értékeket adja (lib/ThemeContext.tsx).
export type GrammarPaletteId = 'electric' | 'lime' | 'brand' | 'cyan' | 'orange' | 'classic';
export type NeonPaletteId = Exclude<GrammarPaletteId, 'classic'>;

export type NeonPalette = {
  bg: string;
  card: string;
  chip: string;
  a: string;
  b: string;
  mu: string;
  tr: string;
  on: string;
};

export const NEON_TEXT = '#E8ECF8';

export const DEFAULT_GRAMMAR_PALETTE: GrammarPaletteId = 'electric';

export const GRAMMAR_PALETTE_IDS: GrammarPaletteId[] = ['electric', 'lime', 'brand', 'cyan', 'orange', 'classic'];

export const NEON_PALETTES: Record<NeonPaletteId, NeonPalette> = {
  electric: { bg: '#08090D', card: '#12141C', chip: '#1A1D28', a: '#3D7BFF', b: '#FFD23F', mu: '#8C90A0', tr: '#232735', on: '#FFFFFF' },
  lime: { bg: '#0B1020', card: '#141B33', chip: '#1C2440', a: '#C6FF3D', b: '#FF4FD8', mu: '#8A93B8', tr: '#26304F', on: '#0B1020' },
  brand: { bg: '#0F172A', card: '#1A2338', chip: '#243049', a: '#EC4899', b: '#22D3EE', mu: '#94A3B8', tr: '#2A3650', on: '#FFFFFF' },
  cyan: { bg: '#0A0F1F', card: '#131A30', chip: '#1B2440', a: '#22D3EE', b: '#A78BFA', mu: '#8B95B5', tr: '#243050', on: '#0A0F1F' },
  orange: { bg: '#100E14', card: '#1C1822', chip: '#26212E', a: '#FF8A3D', b: '#2EE6C5', mu: '#9A92A8', tr: '#302A38', on: '#100E14' },
};

export function isGrammarPaletteId(v: unknown): v is GrammarPaletteId {
  return typeof v === 'string' && (GRAMMAR_PALETTE_IDS as string[]).includes(v);
}
