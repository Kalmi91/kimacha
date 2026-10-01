import { StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, lineHeight, radius, spacing } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import type { MockOverview } from '@/lib/exam/mock/session';
import type { MockLevel } from '@/lib/exam/mock/types';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import ExamButton from './ExamButton';

// PLAN-vizsga E. szakasz (Kálmán E1 a): a Stats fül "Practice exam" kártyája: szintenként egy
// gomb (A1, A2; az es→en irányban csak az A2), alatta a legutóbbi eredmény vagy a félbehagyott
// vizsga jelzése. A gomb mindig viszi tovább (DESIGN 9/9).
type Props = {
  levels: readonly MockLevel[];
  overview: MockOverview;
  onStart: (level: MockLevel) => void;
};

export default function MockExamCard({ levels, overview, onStart }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  if (levels.length === 0) return null;
  return (
    <Card testID="mock-exam-card" classicStyle={styles.card} boxStyle={styles.brutalCard} style={styles.outer}>
      <Text style={[styles.title, { color: colors.text }]}>{s.cardTitle}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{s.cardBody}</Text>
      {levels.map((level) => {
        const entry = overview[level];
        const status = entry?.session ? s.cardInProgress(level) : entry?.last ? s.cardLast(level, entry.last.passed, entry.last.date) : null;
        return (
          <View key={level} style={styles.row}>
            <ExamButton testID={`mock-exam-start-${level}`} label={level} onPress={() => onStart(level)} />
            {status && (
              <Text testID={`mock-exam-status-${level}`} style={[styles.status, { color: colors.textMuted }]}>
                {status}
              </Text>
            )}
          </View>
        );
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
  row: { gap: spacing.xs },
  status: { fontSize: fontSize.sm, lineHeight: lineHeight.sm },
});
