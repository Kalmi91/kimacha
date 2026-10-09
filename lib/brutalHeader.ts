import type { TextStyle, ViewStyle } from 'react-native';

import type { Skin } from '@/constants/Skins';
import type { GrammarColors } from '@/lib/grammarColors';

// a natív fejléc (Tabs / Stack screenOptions) brutalista palettán: bg háttér,
// alul 2,5 px ink vonal, árnyék / elevation nélkül, nagybetűs 500-as ink cím.
// Classic palettán üres: a mai fejléc marad. (headerShadowVisible: false nem
// kerül bele, mert az a borderBottomWidth-et is nullázza.)
// A második paraméter az aktív téma; a title-betűje (egyedi betűnél fontWeight nélkül),
// betűköze és kis-/nagybetűs formája a natív fejléc címére kerül.
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

// Belső (képernyőbe rajzolt) fejlécsor alsó vonala brutalista palettán.
export function brutalHeaderRowStyle(g: GrammarColors): ViewStyle | null {
  return g.brutal ? { borderBottomWidth: 2.5, borderBottomColor: g.ink, paddingBottom: 12 } : null;
}
