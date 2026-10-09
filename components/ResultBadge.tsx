import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { ON_FILL } from '@/constants/GrammarPalettes';
import { bestOn } from '@/constants/Skins';
import { useGrammarColors } from '@/lib/grammarColors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';

// User feedback: "the green should be reworked somehow too, because it
// clashes a lot. often I can't tell when it's right and when it isn't". A single shared indicator for the
// correct / incorrect answer, the same on every card type:
//   correct   = green fill from the token + ✓ + text, SOLID ink border, offset shadow
//   incorrect = red fill from the token + ✗ + text, DASHED border, no shadow
// The two differ in colour AND shape (a state colour is never the only signal).
// The text is in the UI language (s.games.correctFeedback / wrongFeedback).
export default function ResultBadge({
  correct,
  label,
  align = 'flex-start',
  testID,
}: {
  correct: boolean;
  label?: string;
  align?: 'flex-start' | 'center';
  testID?: string;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const fill = correct ? colors.successFill : colors.danger;
  // Dark text on the fill (token: ON_FILL; success green 7.8:1, dark-mode danger 5.0:1).
  // The light-mode danger (#DC2626) was 3.9:1 under dark text, and the label (18 px) is not
  // "large" text (no bold with a custom font), so 4.5 is needed: there white (4.8:1) is better.
  const ink = bestOn(fill, [ON_FILL, '#FFFFFF']);
  const text = label ?? (correct ? s.games.correctFeedback : s.games.wrongFeedback);
  return (
    <View
      testID={testID}
      accessibilityRole="text"
      style={[
        styles.badge,
        { backgroundColor: fill, borderColor: g.ink },
        correct ? styles.solid : styles.dashed,
        !g.brutal && styles.rounded,
        { alignSelf: align },
      ]}
    >
      <Text style={[styles.glyph, { color: ink }]}>{correct ? '✓' : '✗'}</Text>
      <Text style={[styles.label, { color: ink }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    borderWidth: 2.5,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  solid: { borderStyle: 'solid' },
  dashed: { borderStyle: 'dashed' },
  rounded: { borderRadius: 8 },
  glyph: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
});
