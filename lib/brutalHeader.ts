import type { TextStyle, ViewStyle } from 'react-native';

import type { GrammarColors } from '@/lib/grammarColors';

// NY25: a natív fejléc (Tabs / Stack screenOptions) brutalista palettán: bg háttér,
// alul 2,5 px ink vonal, árnyék / elevation nélkül, nagybetűs 500-as ink cím.
// Classic palettán üres: a mai fejléc marad. (headerShadowVisible: false nem
// kerül bele, mert az a borderBottomWidth-et is nullázza.)
export function brutalHeaderOptions(g: GrammarColors): {
  headerStyle?: ViewStyle;
  headerTintColor?: string;
  headerTitleStyle?: TextStyle;
} {
  if (!g.brutal) return {};
  return {
    headerStyle: {
      backgroundColor: g.bg,
      borderBottomWidth: 2.5,
      borderBottomColor: g.ink,
      elevation: 0,
      shadowOpacity: 0,
    },
    headerTintColor: g.ink,
    headerTitleStyle: { color: g.ink, fontWeight: '500', textTransform: 'uppercase' },
  };
}

// Belső (képernyőbe rajzolt) fejlécsor alsó vonala brutalista palettán.
export function brutalHeaderRowStyle(g: GrammarColors): ViewStyle | null {
  return g.brutal ? { borderBottomWidth: 2.5, borderBottomColor: g.ink, paddingBottom: 12 } : null;
}
