import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { ON_FILL } from '@/constants/GrammarPalettes';
import { useGrammarColors } from '@/lib/grammarColors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';

// FB403 (PLAN-fb0929 6. lépés), Kálmán: „a zöldet is valahogy át kellene dolgozni, mert
// nagyon elüt. sokszor nem tudom mikor jó és mikor nem". Egyetlen közös jelzés a
// helyes / helytelen válaszra, minden kártyatípuson ugyanaz:
//   helyes  = tokenből vett zöld kitöltés + ✓ + szöveg, TÖMÖR ink keret, eltolt árnyék
//   helytelen = tokenből vett piros kitöltés + ✗ + szöveg, SZAGGATOTT keret, árnyék nélkül
// A kettő színe ÉS alakja is különbözik (DESIGN.md: állapot-szín soha nem az egyetlen jel).
// A szöveg a felület nyelvén (s.games.correctFeedback / wrongFeedback).
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
  // Sötét szöveg mindkét kitöltésen (siker-zöld 7.8:1, danger 3.8:1 nagy félkövér szövegre elég), token: ON_FILL.
  const ink = ON_FILL;
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
