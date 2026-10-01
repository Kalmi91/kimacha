import { StyleSheet, View } from 'react-native';

import { Triangle, Zigzag } from '@/components/skins/partsE2';
import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';

// PLAN-temak 6E (E2), Memphis: a háttérben cikcakk (b) jobb fent, sárga kör (a téma `yellow` színe,
// tartalék: a papír) bal lent, türkiz (c) háromszög jobb lent. Mind a tartalom mögött áll.

function MemphisBackdrop() {
  const g = useGrammarColors();
  return (
    <View testID="decor-memphis-art" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
      <View style={styles.zigzag}>
        <Zigzag testID="decor-memphis-zigzag" segments={6} color={g.b} />
      </View>
      <View testID="decor-memphis-circle" style={[styles.circle, { backgroundColor: g.extra.yellow ?? g.paper }]} />
      <Triangle testID="decor-memphis-triangle" width={40} height={34} color={g.c} style={styles.triangle} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  zigzag: { position: 'absolute', top: 110, right: 14 },
  circle: { position: 'absolute', left: -18, bottom: 96, width: 64, height: 64, borderRadius: 32 },
  triangle: { position: 'absolute', right: 34, bottom: 64 },
});

export const memphisDecor: SkinDecor = {
  Backdrop: MemphisBackdrop,
};
