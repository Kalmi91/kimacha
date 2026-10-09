import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';

// Diszlexia: olvasó-sáv, sárga csík a szó mögött, a szó-sor teljes szélességében.
// A sáv a téma `band` színe; más színekkel (Saját mix) a b szín halványítva a tartalék.

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
  // flexGrow: a sor-konténerben (szó + 🔊) a sáv kitölti a szó helyét; alignSelf stretch: oszlopban
  // (előnézet) a teljes szélesség. A flexShrink a FitText miatt kell.
  word: { flexGrow: 1, flexShrink: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
});

export const diszlexiaDecor: SkinDecor = {
  WordRenderer: DiszlexiaWord,
};
