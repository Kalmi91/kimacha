import { isValidElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radiusStyle } from '@/components/grammar/Brutal';
import { Flower } from '@/components/skins/partsE2';
import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';

// PLAN-temak 6E (E2), Szecesszió: a kártya (2 px a keret, íves tető) körül 3 px rés után 1 px-es b
// külső keret; arany (b) virágok a cím két oldalán (ha a fejléc maga a cím; a többi fejlécnél
// virág - vonal - virág sor fölötte), nagy virág a szó fölött.

const GAP = 3;
const OUTER = 1;

function SzecessioCardFrame({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  const out = GAP + OUTER;
  const grow = (r: number) => (r > 0 ? r + out : 0);
  const r = shape.radius;
  const outerRadius = radiusStyle(typeof r === 'number' ? grow(r) : [grow(r[0]), grow(r[1]), grow(r[2]), grow(r[3])]);
  return (
    <View testID="skin-szecesszio-frame" style={{ margin: out }}>
      {children}
      <View
        testID="decor-szecesszio-outer"
        pointerEvents="none"
        style={[styles.outer, { top: -out, left: -out, right: -out, bottom: -out, borderWidth: OUTER, borderColor: g.b }, outerRadius]}
      />
    </View>
  );
}

function SzecessioWord({ children }: { word: string; children: ReactNode }) {
  const g = useGrammarColors();
  return (
    <View style={styles.word}>
      <Flower testID="decor-szecesszio-bloom" size={26} petals={8} color={g.b} center={g.c} />
      {children}
    </View>
  );
}

// A fejléc maga a cím (a fül-fejléc `Text variant="title"`-je): virágok két oldalt.
const isTitle = (node: ReactNode) => isValidElement(node) && (node.props as { variant?: string }).variant === 'title';

function SzecessioHeader({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const flower = <Flower testID="decor-szecesszio-flower" size={16} petals={6} color={g.b} center={g.c} />;
  if (isTitle(children)) {
    return (
      <View style={styles.titleRow}>
        {flower}
        {children}
        {flower}
      </View>
    );
  }
  return (
    <View>
      <View testID="decor-szecesszio-ornament" pointerEvents="none" style={styles.ornament}>
        {flower}
        <View style={[styles.line, { backgroundColor: g.b }]} />
        {flower}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'absolute' },
  // flexShrink: a FitText a sor-konténerben összemegy, ezért a burkolója is.
  word: { flexShrink: 1, alignItems: 'center', gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  line: { flex: 1, height: 1 },
});

export const szecesszioDecor: SkinDecor = {
  CardFrame: SzecessioCardFrame,
  WordRenderer: SzecessioWord,
  HeaderOrnament: SzecessioHeader,
};
