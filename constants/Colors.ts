import { BASE, ON_FILL, PALETTE_FILLS, type FillPaletteId } from './GrammarPalettes';
import { SKINS, skinColorsFor, type SkinId, type SkinMode } from './Skins';

const darkBlue = '#2563EB';
const navy = '#0F172A';
const pink = '#EC4899';
const cyan = '#06B6D4';

// the brutalist palette (GrammarPalettes) is mapped in one place onto the keys of
// Colors: the theme key is `<palette>-light|dark`, so files that read `Colors[theme]`
// switch without separate rewriting (light = paper, dark = ink).
// tint/accent = a, secondary = b, border = ink, onTint = ON_FILL; the
// success/danger/warning stay semantic with the classic light/dark values.
function brutalColors(id: FillPaletteId, mode: 'light' | 'dark') {
  const base = BASE[mode];
  const fills = PALETTE_FILLS[id];
  const dark = mode === 'dark';
  return {
    text: base.ink,
    background: base.bg,
    tint: fills.a,
    card: base.paper,
    tabIconDefault: base.mu,
    tabIconSelected: base.ink,
    accent: fills.a,
    secondary: fills.b,
    textMuted: base.mu,
    success: dark ? '#22C55E' : '#15803D',
    successFill: '#22C55E',
    danger: dark ? '#EF4444' : '#DC2626',
    warning: dark ? '#F59E0B' : '#B45309',
    warningFill: '#F59E0B',
    info: dark ? '#38BDF8' : '#0369A1',
    border: base.ink,
    overlay: dark ? 'rgba(0,0,0,0.6)' : 'rgba(15,23,42,0.5)',
    onTint: ON_FILL,
  };
}

// the same kind of Colors entry for the themes of the theme engine (constants/Skins.ts),
// under the key `<theme-id>-<mode>`. tint/accent = a, secondary = b (if missing: a), card = paper,
// border = the frame's own color (if missing: ink), onTint = onA; the semantic colors
// (success / danger / warning / info / overlay) come from the brutalist set.
function skinColors(id: SkinId, mode: SkinMode) {
  const c = skinColorsFor(SKINS[id], mode);
  const { success, successFill, danger, warning, warningFill, info, overlay } = brutalColors('brand', mode);
  return {
    text: c.ink,
    background: c.bg,
    tint: c.a,
    card: c.paper,
    tabIconDefault: c.mu,
    tabIconSelected: c.ink,
    accent: c.a,
    secondary: c.b ?? c.a,
    textMuted: c.mu,
    success,
    successFill,
    danger,
    warning,
    warningFill,
    info,
    border: c.border ?? c.ink,
    overlay,
    onTint: c.onA,
  };
}

// The mode follows the classic light/dark key names.
export const isDarkTheme = (theme: string) => theme === 'dark' || theme.endsWith('-dark');

export default {
  'brand-light': brutalColors('brand', 'light'),
  'brand-dark': brutalColors('brand', 'dark'),
  'electric-light': brutalColors('electric', 'light'),
  'electric-dark': brutalColors('electric', 'dark'),
  'lime-light': brutalColors('lime', 'light'),
  'lime-dark': brutalColors('lime', 'dark'),
  'cyan-light': brutalColors('cyan', 'light'),
  'cyan-dark': brutalColors('cyan', 'dark'),
  'orange-light': brutalColors('orange', 'light'),
  'orange-dark': brutalColors('orange', 'dark'),
  'deco-dark': skinColors('deco', 'dark'),
  'deco-light': skinColors('deco', 'light'),
  'loteria-light': skinColors('loteria', 'light'),
  'senior-light': skinColors('senior', 'light'),
  'senior-dark': skinColors('senior', 'dark'),
  'konnyu-light': skinColors('konnyu', 'light'),
  'konnyu-dark': skinColors('konnyu', 'dark'),
  'retro95-light': skinColors('retro95', 'light'),
  'y2k-light': skinColors('y2k', 'light'),
  'kawaii-light': skinColors('kawaii', 'light'),
  'gamer-dark': skinColors('gamer', 'dark'),
  'botanikus-light': skinColors('botanikus', 'light'),
  'botanikus-dark': skinColors('botanikus', 'dark'),
  'zen-light': skinColors('zen', 'light'),
  'zen-dark': skinColors('zen', 'dark'),
  'diszlexia-light': skinColors('diszlexia', 'light'),
  'diszlexia-dark': skinColors('diszlexia', 'dark'),
  'szocreal-light': skinColors('szocreal', 'light'),
  'plakat-light': skinColors('plakat', 'light'),
  'csillampony-light': skinColors('csillampony', 'light'),
  'bauhaus-light': skinColors('bauhaus', 'light'),
  'popart-light': skinColors('popart', 'light'),
  'szecesszio-light': skinColors('szecesszio', 'light'),
  'kalocsai-light': skinColors('kalocsai', 'light'),
  'memphis-light': skinColors('memphis', 'light'),
  'kodex-light': skinColors('kodex', 'light'),
  'graffiti-dark': skinColors('graffiti', 'dark'),
  'ukiyoe-light': skinColors('ukiyoe', 'light'),
  'ukiyoe-dark': skinColors('ukiyoe', 'dark'),
  light: {
    text: '#1E293B',
    background: '#F8FAFC',
    tint: darkBlue,
    card: '#FFFFFF',
    tabIconDefault: '#64748B',
    tabIconSelected: darkBlue,
    accent: pink,
    secondary: cyan,
    textMuted: '#64748B',
    success: '#15803D',
    successFill: '#22C55E',
    danger: '#DC2626',
    warning: '#B45309',
    warningFill: '#F59E0B',
    info: '#0369A1',
    border: '#E2E8F0',
    overlay: 'rgba(15,23,42,0.5)',
    onTint: '#FFFFFF',
  },
  dark: {
    text: '#F1F5F9',
    background: navy,
    tint: '#3B82F6',
    card: '#1E293B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: cyan,
    accent: pink,
    secondary: darkBlue,
    textMuted: '#94A3B8',
    success: '#22C55E',
    successFill: '#22C55E',
    danger: '#EF4444',
    warning: '#F59E0B',
    warningFill: '#F59E0B',
    info: '#38BDF8',
    border: '#334155',
    overlay: 'rgba(0,0,0,0.6)',
    // white on #3B82F6 was 3.68; the dark base color gives 4.85 (the tint stays as text
    // on the dark base, so it is the fill's text that changed, not the tint).
    onTint: navy,
  },
};
