import { Pressable, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { BrutalBox, SegmentBar, segmentsFilled } from '@/components/grammar/Brutal';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import type { ExamLevelStatus } from '@/lib/exam/unlock';

type ColorScheme = (typeof Colors)['light'];

// PLAN-vizsga A. szakasz 2. lépés (Kálmán, 2026-10-01, A1 a): a szintválasztó lap
// vizsga-sora a szint sora alatt. Zárva: lakat + mennyi hiányzik (szó, lecke);
// koppintásra a hiányzó dologhoz visz (szavak gyakorlása / nyelvtani leckék), tehát
// sosem "nincs adat" felirat gomb nélkül (DESIGN 9/9). Nyitva: "Ready" + a mentett
// eredmény (átment-e, legjobb pontszám); koppintásra indul a vizsga.
type Props = {
  status: ExamLevelStatus;
  colors: ColorScheme;
  onStart: () => void;
  onPractice: () => void;
  onGrammar: () => void;
};

export default function ExamLevelRow({ status, colors, onStart, onPractice, onGrammar }: Props) {
  const s = t();
  const g = useGrammarColors();
  const { level, unlocked, total, learned, needed, missing, lessonDone, result } = status;

  const onPress = unlocked ? onStart : missing > 0 ? onPractice : onGrammar;
  const action = unlocked ? s.exam.start : missing > 0 ? s.exam.practiceWords : s.exam.openGrammar;
  const pct = needed > 0 ? Math.min(100, (learned / needed) * 100) : 0;

  const content = (
    <>
      <View style={styles.main}>
        <Text style={[styles.title, { color: colors.text }]}>
          {unlocked ? '' : '🔒 '}
          {s.exam.rowTitle(level)}
        </Text>
        {!unlocked && missing > 0 && (
          <Text testID="exam-row-words" style={[styles.meta, { color: colors.textMuted }]}>
            {s.exam.rowLocked(learned, needed, missing)}
          </Text>
        )}
        {!unlocked && !lessonDone && (
          <Text testID="exam-row-lesson" style={[styles.meta, { color: colors.textMuted }]}>
            {s.exam.rowNeedLesson(level)}
          </Text>
        )}
        {!unlocked && total > 0 && (g.brutal ? (
          <SegmentBar filled={segmentsFilled(pct, 8)} segments={8} />
        ) : (
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View style={[styles.fill, { backgroundColor: colors.tint, width: `${pct}%` }]} />
          </View>
        ))}
        {unlocked && (
          <Text testID="exam-row-ready" style={[styles.meta, { color: colors.textMuted }]}>
            {s.exam.rowReady}
            {result ? ` · ${result.passed ? s.exam.rowPassed(result.best) : s.exam.rowBest(result.best)}` : ''}
          </Text>
        )}
      </View>
      <Text style={[styles.action, { color: g.brutal ? colors.text : colors.tint }]}>{action} ›</Text>
    </>
  );

  if (g.brutal) {
    return (
      <BrutalBox testID={`exam-row-${level}`} offset={2} style={styles.outer} boxStyle={styles.brutalBox} onPress={onPress}>
        {content}
      </BrutalBox>
    );
  }
  return (
    <Pressable
      testID={`exam-row-${level}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { marginBottom: spacing.md },
  brutalBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  row: {
    minHeight: tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  main: { flex: 1, gap: spacing.xs },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  meta: { fontSize: fontSize.sm },
  track: { height: 8, borderRadius: radius.xs, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.xs },
  action: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
