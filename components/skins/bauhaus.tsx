import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Triangle } from '@/components/skins/partsE2';
import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';

// Bauhaus: kör-négyzet-háromszög (a, b, c szín) a fejléc fölött, a kártya jobb
// felső sarkában sárga (c) kör, ami kilóg és a kártya szélén levágódik, a bal szélén kék (b) sáv.

const SUN = 64;
const SUN_SHIFT = 22;
const BAR = 10;

function BauhausHeader({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  return (
    <View>
      <View testID="decor-bauhaus-shapes" pointerEvents="none" style={styles.shapes}>
        <View testID="decor-bauhaus-circle" style={[styles.circle, { backgroundColor: g.a }]} />
        <View testID="decor-bauhaus-square" style={[styles.square, { backgroundColor: g.b }]} />
        <Triangle testID="decor-bauhaus-triangle" width={14} height={12} color={g.c} />
      </View>
      {children}
    </View>
  );
}

function BauhausCardFrame({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  return (
    <View testID="skin-bauhaus-frame">
      {children}
      <View testID="decor-bauhaus-corner" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
        <View testID="decor-bauhaus-sun" style={[styles.sun, { backgroundColor: g.c }]} />
      </View>
      <View testID="decor-bauhaus-bar" pointerEvents="none" style={[styles.bar, { backgroundColor: g.b }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  shapes: { flexDirection: 'row', alignItems: 'flex-end', alignSelf: 'flex-start', gap: 6, marginBottom: 4 },
  circle: { width: 12, height: 12, borderRadius: 6 },
  square: { width: 12, height: 12 },
  clip: { overflow: 'hidden' },
  sun: { position: 'absolute', top: -SUN_SHIFT, right: -SUN_SHIFT, width: SUN, height: SUN, borderRadius: SUN / 2 },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: BAR },
});

export const bauhausDecor: SkinDecor = {
  HeaderOrnament: BauhausHeader,
  CardFrame: BauhausCardFrame,
};
