import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { legibleOn } from '@/constants/Skins';
import { fontSize, fontWeight, lineHeight, radius, spacing } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import { ProgressBar, Badge } from '@/components/grammar/Themed';
import { t } from '@/lib/i18n';
import { LEVEL_WORDS_PCT, type ProgressLevel } from '@/lib/progressLevel';
import { useTheme } from '@/lib/ThemeContext';

// The Stats tab's level card (lib/progressLevel.ts): the learner's current level A1-C1 and, under it,
// the progress toward the next one (words toward the 80% goal, grammar topics done / all).
type Props = {
  progress: ProgressLevel;
};

type MeterProps = {
  testID: string;
  label: string;
  now: number;
  max: number;
};

// One progress row: the label as text plus a bar; the row is a single accessibility element (a progressbar
// with the same label and value), so a screen reader does not read the text and the bar separately.
function Meter({ testID, label, now, max }: MeterProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const pct = max > 0 ? Math.min(100, Math.round((now / max) * 100)) : 0;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: Math.min(now, max) }}
      style={styles.meter}
    >
      <Text style={[styles.meterLabel, { color: colors.text }]}>{label}</Text>
      <ProgressBar
        testID={`${testID}-bar`}
        pct={pct}
        trackStyle={styles.track}
        trackColor={colors.background}
        fillStyle={styles.fill}
        fillColor={colors.tint}
        fillProps={{ testID: `${testID}-fill` }}
      />
    </View>
  );
}

export default function LevelCard({ progress }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().levelCard;
  const { level, next } = progress;
  // Not even A1 cleared: the badge says 0 and the headline "Heading for A1".
  const badge = level ?? '0';
  const headline = level ? s.level(level) : s.heading(next?.level ?? 'A1');
  return (
    <Card testID="level-card" classicStyle={styles.card} boxStyle={styles.brutalCard} style={styles.outer}>
      <Text style={[styles.title, { color: colors.textMuted }]}>{s.title}</Text>
      <View style={styles.head}>
        <Badge
          testID="level-card-badge"
          label={badge}
          rotate={-4}
          brutalTextStyle={styles.stickerText}
          classicStyle={[styles.badge, { backgroundColor: legibleOn('#38BDF8', '#FFFFFF') }]}
          classicTextStyle={styles.badgeText}
        />
        <Text testID="level-card-headline" style={[styles.headline, { color: colors.text }]}>
          {headline}
        </Text>
      </View>
      {next ? (
        <View style={styles.next}>
          <Text testID="level-card-goal" style={[styles.goal, { color: colors.textMuted }]}>
            {s.goal(next.level)}
          </Text>
          <Meter
            testID="level-card-words"
            label={s.words(next.wordsKnown, next.wordsNeeded, next.wordsTotal, LEVEL_WORDS_PCT)}
            now={next.wordsKnown}
            max={next.wordsNeeded}
          />
          <Meter
            testID="level-card-grammar"
            label={s.grammar(next.grammarDone, next.grammarTotal)}
            now={next.grammarDone}
            max={next.grammarTotal}
          />
          <Text style={[styles.rule, { color: colors.textMuted }]}>{s.rule(LEVEL_WORDS_PCT)}</Text>
        </View>
      ) : (
        <Text testID="level-card-top" style={[styles.rule, { color: colors.textMuted }]}>
          {s.top}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  outer: { marginBottom: spacing.lg },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  badgeText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: '800' },
  // the Sticker sets its own text colour for the palette's fill; only the size is ours.
  stickerText: { fontSize: fontSize.sm },
  headline: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, flexShrink: 1 },
  next: { gap: spacing.md },
  goal: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  meter: { gap: spacing.xs },
  meterLabel: { fontSize: fontSize.sm, lineHeight: lineHeight.sm },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  rule: { fontSize: fontSize.xs, lineHeight: lineHeight.xs },
});
