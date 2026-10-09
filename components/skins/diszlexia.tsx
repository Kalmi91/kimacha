import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';

// Dyslexia: a reading band, a yellow stripe behind the word, across the full width of the word row.
// The band is the theme's `band` color; with other colors (My mix) the lightened b color is the fallback.

function DiszlexiaWord({ children }: { word: string; children: ReactNode }) {
  const g = useGrammarColors();
  const band = g.extra.band;
  return (
    <View testID="skin-diszlexia-word" style={styles.word}>
      <View
        testID="decor-diszlexia-band"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: band ?? g.b, opacity: band ? 1 : 0.35 }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // flexGrow: in the row container (word + 🔊) the band fills the word's space; alignSelf stretch: in a column
  // (preview) it takes the full width. flexShrink is needed because of FitText.
  word: { flexGrow: 1, flexShrink: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
});

export const diszlexiaDecor: SkinDecor = {
  WordRenderer: DiszlexiaWord,
};
