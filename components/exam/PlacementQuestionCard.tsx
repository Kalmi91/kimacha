import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, lineHeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';
import { Card } from '@/components/grammar/Brutal';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';

// PLAN-vizsga C. szakasz (C2): a szintfelmérő feleletválasztós kérdése. A koppintás azonnal
// válaszol, visszajelzés nincs (a felmérő nem tanít, és a hossz a válaszoktól függ); az
// "I don't know" hibának számít, de külön nem büntet.
type Props = {
  /** A kérdés fölötti rövid felirat (nyelvtannál a feladat, szónál üres). */
  heading?: string;
  /** A kérdés vagy a lyukas mondat. */
  text: string;
  options: string[];
  correctIndex: number;
  onDone: (correct: boolean) => void;
};

export default function PlacementQuestionCard({ heading, text, options, correctIndex, onDone }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
        {heading ? <Text style={[styles.heading, { color: colors.textMuted }]}>{heading}</Text> : null}
        <Text testID="placement-text" style={[styles.text, { color: colors.text }]}>{text}</Text>
      </Card>
      <View style={styles.options}>
        {options.map((option, i) => (
          <Pressable
            key={`${i}-${option}`}
            testID={`placement-option-${i}`}
            accessibilityRole="button"
            onPress={() => onDone(i === correctIndex)}
            style={[styles.option, g.brutal && styles.brutalEdge, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
          </Pressable>
        ))}
        <Pressable
          testID="placement-dont-know"
          accessibilityRole="button"
          onPress={() => onDone(false)}
          style={[styles.option, g.brutal && styles.brutalEdge, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.optionText, { color: colors.textMuted }]}>{s.placement.dontKnow}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: FAB_CLEARANCE, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  heading: { fontSize: fontSize.sm, textAlign: 'center' },
  text: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, textAlign: 'center', lineHeight: lineHeight.lg },
  options: { gap: spacing.sm },
  option: {
    minHeight: tapTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  brutalEdge: { borderRadius: 0, borderWidth: 2 },
  optionText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
