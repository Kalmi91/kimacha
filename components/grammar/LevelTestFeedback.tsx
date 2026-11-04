import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import type { LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { Card } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import ExamButton from '@/components/exam/ExamButton';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';

// FB571: the card after a WRONG answer in the level test: the topic, the question, the right answer, the why, a Next
// button and the link to the topic's lesson (a push: back returns to the test, nothing is lost).
export default function LevelTestFeedback({
  q,
  topicTitle,
  onNext,
  onRule,
}: {
  q: LessonTestQuestion;
  topicTitle: string;
  onNext: () => void;
  onRule: () => void;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().randomRound;
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text testID="level-test-topic" style={[styles.topicTitle, { color: colors.text }]}>
        {topicTitle}
      </Text>
      <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
        <ResultBadge testID="level-test-feedback-badge" correct={false} label={s.wrong} />
        <Text testID="level-test-feedback-question" style={[styles.question, { color: colors.text }]}>
          {q.review.question}
        </Text>
        {q.review.answer !== '' && (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>{t().exam.correctAnswer}</Text>
            <Text testID="level-test-feedback-answer" style={[styles.answer, { color: colors.success }]}>
              {q.review.answer}
            </Text>
          </>
        )}
        {q.review.why ? (
          <Text testID="level-test-feedback-why" style={[styles.why, { color: colors.textMuted }]}>
            {q.review.why}
          </Text>
        ) : null}
      </Card>
      <View style={styles.buttons}>
        <ExamButton testID="level-test-next" label={s.next} onPress={onNext} />
        <ExamButton testID="level-test-rule" secondary label={s.rule} onPress={onRule} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: FAB_CLEARANCE, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  topicTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, textAlign: 'center', marginTop: spacing.sm },
  question: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  label: { fontSize: fontSize.sm },
  answer: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  why: { fontSize: fontSize.sm },
  buttons: { gap: spacing.md },
});
