import type { TextStyle, ViewStyle } from 'react-native';

import type { Skin } from '@/constants/Skins';
import type { GrammarColors } from '@/lib/grammarColors';

// the native header (Tabs / Stack screenOptions) on the brutalist palette: bg background,
// a 2.5 px ink line at the bottom, no shadow / elevation, an uppercase 500-weight ink title.
// Empty on the classic palette: today's header stays. (headerShadowVisible: false is not
// included, because it also zeroes borderBottomWidth.)
// The second parameter is the active theme; the title's typeface (without fontWeight for a custom typeface),
// letter spacing and upper/lower case form go onto the native header title.
export function brutalHeaderOptions(
  g: GrammarColors,
  skin?: Pick<Skin, 'fonts' | 'letterSpacing' | 'uppercaseTitle' | 'lowercaseTitle'>,
): {
  headerStyle?: ViewStyle;
  headerTintColor?: string;
  headerTitleStyle?: TextStyle;
} {
  const base: ReturnType<typeof brutalHeaderOptions> = g.brutal
    ? {
        headerStyle: {
          backgroundColor: g.bg,
          borderBottomWidth: 2.5,
          borderBottomColor: g.ink,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: g.ink,
        headerTitleStyle: { color: g.ink, fontWeight: '500', textTransform: 'uppercase' },
      }
    : {};
  // Night (g.soft): a 1 px border-colour line and a normal-case 600 title instead of the ink line and the capitals.
  if (g.brutal && g.soft) {
    base.headerStyle = { ...base.headerStyle, borderBottomWidth: 1, borderBottomColor: g.border };
    base.headerTitleStyle = { ...base.headerTitleStyle, fontWeight: '600', textTransform: 'none' };
  }
  if (!skin) return base;
  const title: TextStyle = { ...base.headerTitleStyle };
  if (skin.fonts.title) {
    title.fontFamily = skin.fonts.title;
    delete title.fontWeight;
  }
  if (skin.letterSpacing !== 0) title.letterSpacing = skin.letterSpacing;
  if (skin.uppercaseTitle) title.textTransform = 'uppercase';
  else if (skin.lowercaseTitle) title.textTransform = 'lowercase';
  return Object.keys(title).length ? { ...base, headerTitleStyle: title } : base;
}

// Bottom line of the inner header row (drawn into the screen) on the brutalist palette.
export function brutalHeaderRowStyle(g: GrammarColors): ViewStyle | null {
  if (!g.brutal) return null;
  return g.soft ? { borderBottomWidth: 1, borderBottomColor: g.border, paddingBottom: 12 } : { borderBottomWidth: 2.5, borderBottomColor: g.ink, paddingBottom: 12 };
}
