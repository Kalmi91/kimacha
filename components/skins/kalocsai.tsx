import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Flower, Plant } from '@/components/skins/partsE2';
import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';

// PLAN-temak 6E (E2), Kalocsai: öt színű virág-sor a fejléc alatt (a téma flower1..5 színei; más
// színekkel, Saját mixben a, b, c, ink, mu a tartalék), növény-ikon a kártya két felső sarkában.
// A szaggatott a keret a téma formája, a másodlagos gomb szaggatott b kerete a Brutal.tsx-ben.

const FLOWER_KEYS = ['flower1', 'flower2', 'flower3', 'flower4', 'flower5'];

function KalocsaiHeader({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const fallback = [g.a, g.b, g.c, g.ink, g.mu];
  return (
    <View>
      {children}
      <View testID="decor-kalocsai-row" pointerEvents="none" style={styles.row}>
        {FLOWER_KEYS.map((key, i) => (
          <Flower key={key} testID="decor-kalocsai-flower" size={14} petals={5} color={g.extra[key] ?? fallback[i]} center={g.paper} />
        ))}
      </View>
    </View>
  );
}

function KalocsaiCardFrame({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  const inset = shape.borderWidth + 4;
  const flower = g.extra.flower1 ?? g.a;
  const green = g.extra.flower4 ?? g.b;
  return (
    <View testID="skin-kalocsai-frame">
      {children}
      <View testID="decor-kalocsai-plant-left" pointerEvents="none" style={[styles.corner, { top: inset, left: inset }]}>
        <Plant flower={flower} center={g.paper} green={green} />
      </View>
      <View testID="decor-kalocsai-plant-right" pointerEvents="none" style={[styles.corner, { top: inset, right: inset }]}>
        <Plant flower={flower} center={g.paper} green={green} style={styles.mirror} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, marginBottom: 4 },
  corner: { position: 'absolute' },
  mirror: { transform: [{ scaleX: -1 }] },
});

export const kalocsaiDecor: SkinDecor = {
  HeaderOrnament: KalocsaiHeader,
  CardFrame: KalocsaiCardFrame,
};
