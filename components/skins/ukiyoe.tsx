import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import { HalfDisc } from '@/components/skins/parts';
import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';

// Ukiyo-e: a wave at the bottom of the card (two rows of semicircles, in the theme's `wave` color), a red
// seal ("語") in the card's top right corner. The `seal` / `wave` color is the theme's extra color; with other
// colors (My mix) color a is the fallback.

const RADIUS = 11;
const BACK_LIFT = 5;
const COUNT = 20;

function Wave({ color, inset }: { color: string; inset: number }) {
  return (
    <View
      testID="decor-ukiyoe-wave"
      pointerEvents="none"
      style={[styles.waveBox, { left: inset, right: inset, bottom: inset }]}
    >
      <View style={[styles.waveRow, { left: -RADIUS, bottom: BACK_LIFT }]}>
        {Array.from({ length: COUNT }, (_, i) => (
          <HalfDisc key={i} testID="decor-ukiyoe-disc" radius={RADIUS} color={color} style={{ opacity: 0.45 }} />
        ))}
      </View>
      <View style={[styles.waveRow, { left: 0, bottom: 0 }]}>
        {Array.from({ length: COUNT }, (_, i) => (
          <HalfDisc key={i} testID="decor-ukiyoe-disc" radius={RADIUS} color={color} />
        ))}
      </View>
    </View>
  );
}

function UkiyoeCardFrame({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  return (
    <View testID="skin-ukiyoe-frame">
      {children}
      <Wave color={g.extra.wave ?? g.a} inset={shape.borderWidth} />
      <View
        testID="decor-ukiyoe-seal"
        pointerEvents="none"
        style={[styles.seal, { top: shape.borderWidth + 5, right: shape.borderWidth + 5, backgroundColor: g.extra.seal ?? g.a }]}
      >
        <Text style={styles.sealText}>語</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  waveBox: { position: 'absolute', height: RADIUS + BACK_LIFT, overflow: 'hidden' },
  waveRow: { position: 'absolute', flexDirection: 'row' },
  seal: {
    position: 'absolute',
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  sealText: { color: '#FFFFFF', fontSize: 15, lineHeight: 18 },
});

export const ukiyoeDecor: SkinDecor = {
  CardFrame: UkiyoeCardFrame,
};
