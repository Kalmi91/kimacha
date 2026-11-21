import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, spacing } from '@/constants/Theme';
import { t } from '@/lib/i18n';
import type { GrammarMiss } from '@/lib/grammar/roundMiss';
import { useTheme } from '@/lib/ThemeContext';
import { Card, softCaseStyle } from '@/components/grammar/Brutal';
import ExamButton from '@/components/exam/ExamButton';

import { useGrammarColors } from '@/lib/grammarColors';
// The one end-of-practice template of the grammar part (FB691-FB695): the result as one number ("14/20"), the
// "Mistakes:" list (what the learner gave struck through, the right solution under it), then exactly two buttons:
// Retake (filled) and back to the grammar part. Screens with an extra result line of their own (a level, a verdict, a
// topic list) put it in `children`, between the number and the mistakes.
interface Props {
  correct: number;
  total: number;
  /** replaces the "14/20" text where the screen has its own score wording */
  scoreText?: string;
  scoreTestID?: string;
  misses: GrammarMiss[];
  onRetake: () => void;
  onBack: () => void;
  retakeLabel?: string;
  backLabel?: string;
  retakeTestID?: string;
  backTestID?: string;
  /** a header drawn above the body (the lesson's title row) */
  header?: ReactNode;
  children?: ReactNode;
}

export default function GrammarResult({
  correct,
  total,
  scoreText,
  scoreTestID = 'grammar-score',
  misses,
  onRetake,
  onBack,
  retakeLabel,
  backLabel,
  retakeTestID = 'grammar-practice-again',
  backTestID = 'grammar-back-course',
  header,
  children,
}: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t().grammar;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {header}
      <ScrollView contentContainerStyle={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text testID={scoreTestID} style={[styles.score, { color: colors.text }]}>
            {scoreText ?? `${correct}/${total}`}
          </Text>
        </Card>
        {children}
        {misses.length > 0 ? (
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            <Text testID="grammar-mistakes" style={[styles.title, { color: colors.textMuted }, softCaseStyle(g)]}>
              {s.mistakesTitle}
            </Text>
            {misses.map((m, i) => (
              <View key={i} testID="grammar-mistake" style={styles.miss}>
                <Text style={[styles.prompt, { color: colors.text }]}>{m.prompt}</Text>
                {m.given ? (
                  <Text testID="grammar-mistake-given" style={[styles.given, { color: colors.danger }]}>
                    {m.given}
                  </Text>
                ) : null}
                <Text testID="grammar-mistake-correct" style={[styles.correct, { color: colors.success }]}>
                  {m.correct}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}
        <ExamButton testID={retakeTestID} label={retakeLabel ?? s.retakeTest} onPress={onRetake} />
        <ExamButton testID={backTestID} secondary label={backLabel ?? s.backToGrammar} onPress={onBack} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  card: { borderRadius: 12, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  score: { fontSize: 48, fontWeight: fontWeight.bold, textAlign: 'center' },
  title: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  miss: { gap: 2 },
  prompt: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  given: { fontSize: fontSize.md, textDecorationLine: 'line-through' },
  correct: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
