import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';

// Kawaii: mosolygó arc-ikon a szó fölött (kör, két szem, mosoly: View-kból, a téma
// rózsaszín `icon` színével), szív a fejlécben.

const FACE = 30;

function Face({ color }: { color: string }) {
  return (
    <View testID="decor-kawaii-face" pointerEvents="none" style={[styles.face, { borderColor: color }]}>
      <View style={styles.eyes}>
        <View style={[styles.eye, { backgroundColor: color }]} />
        <View style={[styles.eye, { backgroundColor: color }]} />
      </View>
      <View style={[styles.smile, { borderColor: color }]} />
    </View>
  );
}

function KawaiiWord({ children }: { word: string; children: ReactNode }) {
  const g = useGrammarColors();
  return (
    <View style={styles.word}>
      <Face color={g.extra.icon ?? g.a} />
      {children}
    </View>
  );
}

function KawaiiHeader({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  return (
    <View>
      <View testID="decor-kawaii-heart" pointerEvents="none" style={styles.heartRow}>
        <Text style={[styles.heart, { color: g.extra.icon ?? g.a }]}>♥</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // flexShrink: a FitText a sor-konténerben összemegy, ezért a burkolója is.
  word: { flexShrink: 1, alignItems: 'center', gap: 6 },
  face: { width: FACE, height: FACE, borderRadius: FACE / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  eyes: { flexDirection: 'row', gap: 8, marginTop: -2 },
  eye: { width: 3, height: 3, borderRadius: 1.5 },
  smile: {
    width: 12,
    height: 6,
    marginTop: 3,
    borderWidth: 0,
    borderBottomWidth: 2,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  heartRow: { alignItems: 'center', marginBottom: 2 },
  heart: { fontSize: 18 },
});

export const kawaiiDecor: SkinDecor = {
  WordRenderer: KawaiiWord,
  HeaderOrnament: KawaiiHeader,
};
