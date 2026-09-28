import { NEON_PALETTES, NEON_TEXT, type NeonPalette } from './GrammarPalettes';

const darkBlue = '#2563EB';
const navy = '#0F172A';
const pink = '#EC4899';
const cyan = '#06B6D4';

// NY11: a neon paletta (GrammarPalettes) egy helyen képződik le a Colors
// kulcsaira, így a `Colors[theme]`-et olvasó fájlok külön átírás nélkül váltanak.
// success/danger/warning szemantikus marad, a sötét dark-értékekkel.
function neonColors(p: NeonPalette) {
  return {
    text: NEON_TEXT,
    background: p.bg,
    tint: p.a,
    card: p.card,
    tabIconDefault: p.mu,
    tabIconSelected: p.a,
    accent: p.a,
    secondary: p.b,
    textMuted: p.mu,
    success: '#22C55E',
    successFill: '#22C55E',
    danger: '#EF4444',
    warning: '#F59E0B',
    warningFill: '#F59E0B',
    info: '#38BDF8',
    border: p.tr,
    overlay: 'rgba(0,0,0,0.6)',
    onTint: p.on,
  };
}

export default {
  electric: neonColors(NEON_PALETTES.electric),
  lime: neonColors(NEON_PALETTES.lime),
  brand: neonColors(NEON_PALETTES.brand),
  cyan: neonColors(NEON_PALETTES.cyan),
  orange: neonColors(NEON_PALETTES.orange),
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
