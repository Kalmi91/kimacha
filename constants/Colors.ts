import { BASE, ON_FILL, PALETTE_FILLS, type FillPaletteId } from './GrammarPalettes';

const darkBlue = '#2563EB';
const navy = '#0F172A';
const pink = '#EC4899';
const cyan = '#06B6D4';

// NY20: a brutalista paletta (GrammarPalettes) egy helyen képződik le a Colors
// kulcsaira: a téma-kulcs `<paletta>-light|dark`, így a `Colors[theme]`-et olvasó
// fájlok külön átírás nélkül váltanak (világos = papír, sötét = tinta).
// tint/accent = a, secondary = b, border = ink, onTint = ON_FILL; a
// success/danger/warning szemantikus marad a classic light/dark értékekkel.
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

// A mód a classic light/dark kulcs-neveket követi.
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
    onTint: '#FFFFFF',
  },
};
