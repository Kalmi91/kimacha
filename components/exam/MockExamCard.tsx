import { StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, lineHeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import type { MockOverview } from '@/lib/exam/mock/session';
import type { MockLevel } from '@/lib/exam/mock/types';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import ExamButton from './ExamButton';

// the Stats tab's "Practice exam" card: one button per level (A1 to C1 in both directions; the caller passes
// only the levels that have content), the buttons wrap to a new row when they do not fit, with the latest
// result or the unfinished-exam marker of each level under them. The button always leads somewhere.
type Props = {
  levels: readonly MockLevel[];
  overview: MockOverview;
  /** Exam with the official structure (Spanish direction) or an international sample (English): the text labels it differently. */
  official: boolean;
  onStart: (level: MockLevel) => void;
};

export default function MockExamCard({ levels, overview, official, onStart }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  if (levels.length === 0) return null;
  return (
    <Card testID="mock-exam-card" classicStyle={styles.card} boxStyle={styles.brutalCard} style={styles.outer}>
      <Text style={[styles.title, { color: colors.text }]}>{s.cardTitle}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{official ? s.cardBody : s.cardBodyIntl}</Text>
      {/* the level buttons share a row and wrap to the next one when they do not fit */}
      <View testID="mock-exam-levels" style={styles.buttons}>
        {levels.map((level) => (
          <View key={level} style={styles.cell}>
            <ExamButton testID={`mock-exam-start-${level}`} label={level} onPress={() => onStart(level)} />
          </View>
        ))}
      </View>
      {levels.map((level) => {
        const entry = overview[level];
        const status = entry?.session ? s.cardInProgress(level) : entry?.last ? s.cardLast(level, entry.last.passed, entry.last.date) : null;
        return status ? (
          <Text key={level} testID={`mock-exam-status-${level}`} style={[styles.status, { color: colors.textMuted }]}>
            {status}
          </Text>
        ) : null;
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  outer: { marginBottom: spacing.lg },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  body: { fontSize: fontSize.sm, lineHeight: lineHeight.sm },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexGrow: 1, flexBasis: tapTarget * 2 },
  status: { fontSize: fontSize.sm, lineHeight: lineHeight.sm },
});
