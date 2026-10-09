import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';

// Retro 95: the 3D edge (light top-left, dark bottom-right) on the card and the buttons comes from the
// shape's `bevel` flag (BrutalBox), the first letter of the buttons is underlined (buttonVariant 'bevel',
// BrutalButton). The decor: a "kimacha.exe" title bar above the header (dark blue = color a), with an x button on the right.

function RetroHeader({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const light = g.extra.bevelLight ?? '#FFFFFF';
  const dark = g.extra.bevelDark ?? '#808080';
  return (
    <View>
      <View testID="decor-retro95-titlebar" pointerEvents="none" style={[styles.bar, { backgroundColor: g.a }]}>
        <Text numberOfLines={1} style={[styles.title, { color: g.onA }]}>
          {t().settings.themes.retroTitle}
        </Text>
        <View
          testID="decor-retro95-close"
          style={[
            styles.close,
            {
              backgroundColor: g.paper,
              borderTopColor: light,
              borderLeftColor: light,
              borderBottomColor: dark,
              borderRightColor: dark,
            },
          ]}
        >
          <Text style={[styles.closeText, { color: g.ink }]}>x</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 2, marginBottom: 8 },
  title: { fontSize: 14, flexShrink: 1 },
  close: { width: 20, height: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 12, lineHeight: 14 },
});

export const retro95Decor: SkinDecor = {
  HeaderOrnament: RetroHeader,
  buttonVariant: 'bevel',
  checkFill: 'a',
};
