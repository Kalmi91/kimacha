import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Diamond, DoubleLine, InnerFrame, Rays } from '@/components/skins/parts';
import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';

// Art deco: arany (a) vonalak. Dupla keret a kártya körül (külső = a téma 1 px-es
// kerete, 4 px rés, belső = InnerFrame), napsugár-legyező a szó fölött, a fejléc alatt dupla vonalak
// két oldalt, középen rombusz-elválasztóval.

const FRAME_GAP = 4;

function DecoCardFrame({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  return (
    <View testID="skin-deco-frame">
      {children}
      <InnerFrame testID="decor-deco-inner" inset={shape.borderWidth + FRAME_GAP} width={1} color={g.a} />
    </View>
  );
}

function DecoWord({ children }: { word: string; children: ReactNode }) {
  const g = useGrammarColors();
  return (
    <View style={styles.word}>
      <Rays testID="decor-deco-rays" count={9} spread={80} inner={8} outer={26} color={g.a} />
      {children}
    </View>
  );
}

function DecoHeader({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  return (
    <View>
      {children}
      <View testID="decor-deco-divider" style={styles.divider}>
        <DoubleLine color={g.a} />
        <Diamond size={8} color={g.a} />
        <DoubleLine color={g.a} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // flexShrink: a FitText a sor-konténerben összemegy, ezért a burkolója is.
  word: { flexShrink: 1, alignItems: 'center', gap: 4 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8, paddingHorizontal: 4 },
});

export const decoDecor: SkinDecor = {
  CardFrame: DecoCardFrame,
  WordRenderer: DecoWord,
  HeaderOrnament: DecoHeader,
};
