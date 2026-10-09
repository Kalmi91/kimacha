import { StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import { SegmentBar, segmentsFilled } from '@/components/grammar/Brutal';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import type { SkillResult } from '@/lib/exam/skills';

type ColorScheme = (typeof Colors)['light'];

// az eredmény-lap egy készség-sora: felirat,
// pont és %, "Strong" vagy "Weak" jelzés (gyenge = a % az átmenési küszöb alatt) és egy sáv.
type Props = {
  result: SkillResult;
  label: string;
  colors: ColorScheme;
};

export default function ExamSkillRow({ result, label, colors }: Props) {
  const s = t();
  const g = useGrammarColors();
  const { skill, correct, total, pct, weak } = result;
  const tone = weak ? colors.danger : colors.success;

  return (
    <View testID={`exam-skill-${skill}`} style={styles.row}>
      <View style={styles.head}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <Text testID={`exam-skill-${skill}-score`} style={[styles.score, { color: colors.textMuted }]}>
          {s.exam.score(correct, total, pct)}
        </Text>
        <Text testID={`exam-skill-${skill}-verdict`} style={[styles.verdict, { color: tone }]}>
          {weak ? s.exam.skillWeak : s.exam.skillStrong}
        </Text>
      </View>
      {g.brutal ? (
        <SegmentBar filled={segmentsFilled(pct, 8)} segments={8} />
      ) : (
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.fill, { backgroundColor: tone, width: `${pct}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  score: { fontSize: fontSize.sm },
  verdict: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  track: { height: 8, borderRadius: radius.xs, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.xs },
});
