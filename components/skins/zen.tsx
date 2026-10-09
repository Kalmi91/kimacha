import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';

// Zen: a red dot above the word (the theme's `dot` color), a short horizontal line under the word;
// the buttons are text only, the main one ("I know") underlined (buttonVariant 'text', BrutalBox / BrutalButton).

const DOT = 10;
const LINE_W = 32;

function ZenWord({ children }: { word: string; children: ReactNode }) {
  const g = useGrammarColors();
  return (
    <View style={styles.word}>
      <View testID="decor-zen-dot" pointerEvents="none" style={[styles.dot, { backgroundColor: g.extra.dot ?? g.a }]} />
      {children}
      <View testID="decor-zen-line" pointerEvents="none" style={[styles.line, { backgroundColor: g.ink }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // flexShrink: FitText shrinks inside the row container, so its wrapper must too.
  word: { flexShrink: 1, alignItems: 'center', gap: 10 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  line: { width: LINE_W, height: 1 },
});

export const zenDecor: SkinDecor = {
  WordRenderer: ZenWord,
  buttonVariant: 'text',
};
