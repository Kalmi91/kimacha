import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { useFitFontSize } from '@/lib/fitText';
import { syllabifyPhrase } from '@/lib/syllables';

// Easy reading: the syllables of the Spanish word alternate between colors a / b, with the
// "ca – rro" line below. Only for a Spanish word (`lang` = 'es'); a word in another language, or one with no language given,
// is left untouched by the decor (the plain word stays). The word's font size steps like the card's FitText.

const WORD_BASE = 32;
const WORD_RESERVE = 150;

function KonnyuWord({ word, lang, children }: { word: string; lang?: string; children: ReactNode }) {
  const g = useGrammarColors();
  const parts = useMemo(() => (lang === 'es' ? syllabifyPhrase(word) : []), [word, lang]);
  const size = useFitFontSize(word, { base: WORD_BASE, reserve: WORD_RESERVE, maxLines: 3 });
  if (!parts.some((p) => p.syllables)) return <>{children}</>;

  let n = 0;
  const colored = parts.map((p, i) =>
    p.syllables ? (
      p.syllables.map((syl, j) => (
        <Text key={`${i}-${j}`} testID="skin-konnyu-syllable" style={{ color: n++ % 2 === 0 ? g.a : g.b }}>
          {syl}
        </Text>
      ))
    ) : (
      <Text key={i}>{p.text}</Text>
    ),
  );
  const line = parts.map((p) => (p.syllables ? p.syllables.join(' – ') : p.text.replace(/\s+/g, '   '))).join('');
  return (
    <View style={styles.word}>
      <Text variant="word" testID="skin-konnyu-word" accessibilityLabel={word} style={{ fontSize: size, color: g.ink, textAlign: 'center' }}>
        {colored}
      </Text>
      <Text testID="skin-konnyu-syllables" style={{ fontSize: 16, color: g.mu, textAlign: 'center' }}>
        {line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // flexShrink: FitText shrinks inside the row container, so its wrapper must too.
  word: { flexShrink: 1, alignItems: 'center', gap: 4 },
});

export const konnyuDecor: SkinDecor = {
  WordRenderer: KonnyuWord,
};
