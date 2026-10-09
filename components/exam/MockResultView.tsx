import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, lineHeight, radius, spacing } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';
import ResultBadge from '@/components/ResultBadge';
import type { MockResult } from '@/lib/exam/mock/score';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import ExamButton from './ExamButton';

// a próbavizsga eredmény-lapja (ítélet, papíronkénti sávok,
// csoportonkénti sorok, rövidítés-megjegyzés) és az átnézés (tételenként a kérdés, a te
// válaszod, a helyes válasz). A szóbeli ebben a szeletben "nem beszámított" (E2 a).

type Props = {
  result: MockResult;
  timedOut: boolean;
  onReview: () => void;
  onRetry: () => void;
  onExit: () => void;
};

export function MockResultView({ result, timedOut, onReview, onRetry, onExit }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
        <ResultBadge testID="mock-verdict" correct={result.passed} label={result.passed ? s.passed : s.notPassed} align="center" />
        {result.provisional && (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            {result.rule.kind === 'total' ? s.provisionalNoteTotal : result.rule.kind === 'average' ? s.provisionalNoteAverage : s.provisionalNote}
          </Text>
        )}
        {timedOut && <Text style={[styles.note, { color: colors.warning }]}>{s.timeUp}</Text>}
        {result.skills.map((p) => (
          <Text key={p.skill} testID={`mock-band-${p.skill}`} style={[styles.line, { color: p.included ? colors.text : colors.textMuted }]}>
            {p.included ? s.bandLine(p.name, p.points, p.maxPoints) : s.bandNotIncluded(p.name)}
          </Text>
        ))}
        {result.rule.kind === 'groups' &&
          result.rule.groups.map((g, i) => (
            <Text key={i} testID={`mock-group-${i + 1}`} style={[styles.line, { color: g.passed ? colors.success : colors.danger }]}>
              {s.groupLine(i + 1, g.points, g.of, g.needed, g.passed, g.provisional)}
            </Text>
          ))}
        {result.rule.kind === 'total' && (
          <Text testID="mock-total" style={[styles.line, { color: result.rule.passed ? colors.success : colors.danger }]}>
            {s.totalLine(result.rule.points, result.rule.of, result.rule.needed, result.rule.passed, result.rule.provisional)}
          </Text>
        )}
        {result.rule.kind === 'average' && (
          <Text testID="mock-average" style={[styles.line, { color: result.rule.passed ? colors.success : colors.danger }]}>
            {s.averageLine(result.rule.pct, result.rule.passPct, result.rule.passed, result.rule.provisional)}
          </Text>
        )}
        <Text style={[styles.note, { color: colors.textMuted }]}>{s.shortNote}</Text>
      </Card>
      <ExamButton testID="mock-review" label={s.checkAnswers} onPress={onReview} />
      <ExamButton testID="mock-retry" secondary label={s.tryAgain} onPress={onRetry} />
      <ExamButton testID="mock-exit" secondary label={s.exit} onPress={onExit} />
    </ScrollView>
  );
}

export function MockReviewView({ result, onBack }: { result: MockResult; onBack: () => void }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={[styles.title, { color: colors.text }]}>{s.reviewTitle}</Text>
      {result.papers
        .filter((p) => p.tasks.length > 0)
        .map((p) => (
          <View key={p.id} style={styles.paper}>
            <Text style={[styles.paperName, { color: colors.tint }]}>{p.name}</Text>
            {p.tasks.map((task, ti) => (
              <View key={task.taskId} style={[styles.task, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.small, { color: colors.textMuted }]}>{s.taskOf(ti + 1, p.tasks.length)}</Text>
                {task.items.map((it, ii) => (
                  <View key={ii} testID={`mock-review-${task.taskId}-${ii}`} style={styles.item}>
                    <Text style={[styles.line, { color: colors.text }]}>
                      {it.ok ? '✓' : '✗'} {it.label}
                    </Text>
                    <Text style={[styles.small, { color: it.ok ? colors.success : colors.danger }]}>
                      {s.yourAnswer}: {it.given || s.noAnswer}
                    </Text>
                    {!it.ok && (
                      <Text style={[styles.small, { color: colors.text }]}>
                        {s.correctAnswer}: {it.expected}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
      <ExamButton testID="mock-review-back" label={s.back} onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: FAB_CLEARANCE, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  line: { fontSize: fontSize.md, lineHeight: lineHeight.md },
  note: { fontSize: fontSize.sm, lineHeight: lineHeight.sm, textAlign: 'center' },
  small: { fontSize: fontSize.sm, lineHeight: lineHeight.sm },
  paper: { gap: spacing.sm },
  paperName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  task: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  item: { gap: spacing.xs },
});
