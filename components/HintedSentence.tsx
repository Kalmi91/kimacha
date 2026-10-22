import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { useGrammarColors } from '@/lib/grammarColors';
import type { HintPiece, SentenceHint } from '@/lib/sentenceHint';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';

// The English prompt of the Sentences tab with tappable words (lib/sentenceHint.ts, beta sentenceHint): underlined words, a
// tap shows a bubble with the Spanish form and a small "hint used" mark, a second tap on the same word closes it. Without
// `pieces` it is the plain sentence, exactly as before. `onHint` gets the cards the word belongs to (they earn no credit).
interface Props {
  text: string;
  pieces?: HintPiece[] | null;
  style?: StyleProp<TextStyle>;
  onHint?: (ids: string[]) => void;
}

export default function HintedSentence({ text, pieces, style, onHint }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const [open, setOpen] = useState<SentenceHint | null>(null);

  if (!pieces) return <Text style={style}>{text}</Text>;

  const tap = (hint: SentenceHint) => {
    setOpen((cur) => (cur?.index === hint.index ? null : hint));
    onHint?.(hint.ids);
  };

  return (
    <View style={styles.wrap}>
      <Text style={style}>
        {pieces.map((p, i) =>
          p.hint ? (
            <Text
              key={i}
              testID={`sentence-hint-${p.hint.index}`}
              accessibilityRole="button"
              accessibilityHint={s.sentenceTab.hintA11y}
              style={styles.tappable}
              onPress={() => tap(p.hint!)}
            >
              {p.text}
            </Text>
          ) : (
            p.text
          ),
        )}
      </Text>
      {open && (
        <View
          testID="sentence-hint-bubble"
          style={[styles.bubble, { backgroundColor: colors.card, borderColor: g.brutal ? g.ink : colors.tabIconDefault }, g.brutal && styles.brutalBubble]}
        >
          <Text style={[styles.bubbleText, { color: colors.text }]}>{open.es}</Text>
          <Text style={[styles.bubbleMark, { color: colors.tabIconDefault }]}>{s.sentenceTab.hintUsed}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  tappable: { textDecorationLine: 'underline' },
  bubble: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', gap: 2 },
  brutalBubble: { borderRadius: 0, borderWidth: 2.5 },
  bubbleText: { fontSize: 18, fontWeight: '700' },
  bubbleMark: { fontSize: 12, fontWeight: '600' },
});
