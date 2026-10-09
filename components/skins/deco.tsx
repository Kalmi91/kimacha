import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Diamond, DoubleLine, InnerFrame, Rays } from '@/components/skins/parts';
import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';

// Art deco: gold (a) lines. A double frame around the card (outer = the theme's 1 px
// border, 4 px gap, inner = InnerFrame), a sunburst fan above the word, double lines on both sides under the header,
// with a diamond separator in the middle.

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
  // flexShrink: the FitText shrinks inside the row container, so its wrapper must too.
  word: { flexShrink: 1, alignItems: 'center', gap: 4 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8, paddingHorizontal: 4 },
});

export const decoDecor: SkinDecor = {
  CardFrame: DecoCardFrame,
  WordRenderer: DecoWord,
  HeaderOrnament: DecoHeader,
};
