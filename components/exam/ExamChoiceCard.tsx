import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, lineHeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';
import { Card } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import ExamButton from './ExamButton';

// PLAN-vizsga A. szakasz 2. lépés (A5 c): feleletválasztós tétel (nyelvtani lyukas
// mondat, olvasás). A koppintás azonnal válaszol: helyesnél a vizsga megy tovább,
// hibásnál a helyes válasz kiemelve látszik, és a "Next" lép tovább.
type Props = {
  /** A feladat rövid felirata a szöveg fölött. */
  heading: string;
  /** A lyukas mondat vagy az olvasandó szöveg. */
  text: string;
  options: string[];
  correctIndex: number;
  onDone: (correct: boolean) => void;
};

export default function ExamChoiceCard({ heading, text, options, correctIndex, onDone }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const [picked, setPicked] = useState<number | null>(null);

  const choose = (i: number) => {
    if (picked !== null) return;
    if (i === correctIndex) onDone(true);
    else setPicked(i);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
        <Text style={[styles.heading, { color: colors.textMuted }]}>{heading}</Text>
        <Text testID="exam-text" style={[styles.text, { color: colors.text }]}>{text}</Text>
        {picked !== null && <ResultBadge correct={false} label={s.games.wrongFeedback} />}
      </Card>
      <View style={styles.options}>
        {options.map((option, i) => {
          const wrong = picked === i;
          const right = picked !== null && i === correctIndex;
          return (
            <Pressable
              key={`${i}-${option}`}
              testID={`exam-option-${i}`}
              accessibilityRole="button"
              onPress={() => choose(i)}
              style={[
                styles.option,
                g.brutal && styles.brutalEdge,
                { backgroundColor: colors.card, borderColor: colors.border },
                right && { backgroundColor: colors.successFill, borderColor: colors.successFill },
                wrong && { backgroundColor: colors.danger, borderColor: colors.danger },
              ]}
            >
              <Text style={[styles.optionText, { color: wrong ? colors.onTint : colors.text }]}>
                {right ? '✓ ' : wrong ? '✗ ' : ''}
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {picked !== null && <ExamButton testID="exam-next" label={`${s.card.next} →`} onPress={() => onDone(false)} />}
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
