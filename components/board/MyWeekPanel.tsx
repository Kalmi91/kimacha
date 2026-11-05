import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Text } from '@/components/KText';
import Colors, { isDarkTheme } from '@/constants/Colors';
import { fontSize, radius, spacing } from '@/constants/Theme';
import type { BoardMetric, BoardRow } from '@/lib/cloud/board';
import { daysLeft, formatMinutes, gaps, weekSummary } from '@/lib/cloud/boardStats';
import { DAILY_XP_GOAL } from '@/lib/dailyXp';
import { t } from '@/lib/i18n';
import { mixColor } from '@/lib/mixColor';
import { useTheme } from '@/lib/ThemeContext';
import { MonoText } from './MonoText';

const FLAP = { width: 44, height: 64 };
const BAR_MAX = 52;
const DAY_LABEL = 18;
const CHART_HEIGHT = 92;
// shown where a figure is not known (e.g. the neighbour is beyond the cut list) or there is nothing yet
const DASH = '–';

export interface MyWeekPanelProps {
  me: { rank: number; xp: number };
  rows: BoardRow[];
  // XP (or, for the time ranking, learning minutes) of Monday..Sunday (fractions allowed), null for the days still to come
  days: (number | null)[];
  todayIndex: number;
  lastWeek: number;
  streak: number;
  onLayout?: (e: LayoutChangeEvent) => void;
  // 'time': every figure is minutes (`me.xp`, `days`, `lastWeek` carry them), written as `3 h 25 min`, and there is no daily XP goal
  metric?: BoardMetric;
}

// The own-week panel: a dark panel in both themes with the place on split-flap digits, the week's XP, the days left, a bar
// chart of the week with the daily goal line, and six small figures.
export default function MyWeekPanel({ me, rows, days, todayIndex, lastWeek, streak, onLayout, metric = 'xp' }: MyWeekPanelProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().board;
  const dark = isDarkTheme(theme);
  const panel = dark ? colors.background : colors.text;
  const fg = dark ? colors.text : colors.background;
  const time = metric === 'time';
  const fig = (n: number) => (time ? formatMinutes(n) : `${n} XP`);
  const sum = weekSummary(days, todayIndex, DAILY_XP_GOAL);
  const { toPass, lead, atTop, last } = gaps(rows, me);
  const px = BAR_MAX / Math.max(time ? 1 : DAILY_XP_GOAL, ...days.map((d) => d ?? 0));
  const mono = { color: fg };
  const lab = [styles.lab, mono];
  const cells = [
    [s.toPass, toPass !== null ? fig(toPass) : atTop ? s.atTop : DASH],
    [s.lead, lead !== null ? fig(lead) : last ? s.none : DASH],
    // the daily goal is an XP goal: the time ranking has none
    ...(time ? [] : [[s.toGoal, sum.toGoal > 0 ? `${sum.toGoal} XP` : s.goalDone]]),
    [s.bestDay, sum.best.xp > 0 ? `${s.days[sum.best.index]} · ${time ? formatMinutes(sum.best.xp) : sum.best.xp}` : DASH],
    [s.average, fig(sum.average)],
    [s.streak, s.daysCount(streak)],
  ];
  return (
    <View testID="board-panel" onLayout={onLayout} style={[styles.panel, { backgroundColor: panel }]}>
      <View style={styles.score}>
        <View>
          <MonoText style={[...lab, styles.opLab]}>{s.place}</MonoText>
          <View style={styles.flaps}>
            {String(me.rank).split('').map((d, i) => (
              <View key={i} style={[styles.flap, { backgroundColor: mixColor(fg, panel, 0.14) }]}>
                <MonoText style={[styles.flapText, mono]}>{d}</MonoText>
                <View style={[styles.flapLine, { backgroundColor: panel }]} />
              </View>
            ))}
          </View>
        </View>
        <View style={styles.stat}>
          <MonoText style={[...lab, styles.opLab]}>{time ? s.weekTime : s.weekXp}</MonoText>
          <MonoText numberOfLines={1} adjustsFontSizeToFit style={[styles.big, time && styles.bigTime, mono]}>{time ? formatMinutes(me.xp) : me.xp}</MonoText>
          <MonoText style={[styles.small, mono]}>{time ? s.todayTime(formatMinutes(sum.today)) : s.todayXp(sum.today)}</MonoText>
        </View>
        <View style={styles.stat}>
          <MonoText style={[...lab, styles.opLab]}>{s.remaining(daysLeft(todayIndex))}</MonoText>
          <MonoText style={[styles.big, mono]}>{s.daysCount(daysLeft(todayIndex))}</MonoText>
          <MonoText style={[styles.small, mono]}>{s.resetsShort}</MonoText>
        </View>
      </View>
      <View style={styles.chead}>
        <MonoText style={[styles.small, mono]}>{s.yourWeek}</MonoText>
        <MonoText style={[styles.small, mono]}>{time ? s.lastWeekTime(formatMinutes(lastWeek)) : s.lastWeek(lastWeek)}</MonoText>
      </View>
      <View style={styles.chart}>
        {time ? null : (
          <View style={[styles.goal, { bottom: Math.round(DAILY_XP_GOAL * px) + DAY_LABEL, borderColor: mixColor(fg, panel, 0.55) }]}>
            <MonoText style={[styles.small, mono, styles.goalText]}>{s.goalLine(DAILY_XP_GOAL)}</MonoText>
          </View>
        )}
        {days.map((xp, i) => (
          <View key={i} style={styles.day}>
            {xp === null ? (
              <View style={[styles.bar, styles.future, { backgroundColor: mixColor(fg, panel, 0.3) }]} />
            ) : (
              <>
                <MonoText style={[styles.value, mono, { backgroundColor: panel }]}>{Math.round(xp)}</MonoText>
                <View style={[styles.bar, { height: Math.round(xp * px), backgroundColor: i === todayIndex ? colors.tint : colors.secondary }]} />
              </>
            )}
            <MonoText style={[styles.dayName, mono, i === todayIndex && styles.today]}>{s.days[i]}</MonoText>
          </View>
        ))}
      </View>
      <View style={styles.cells}>
        {[cells.slice(0, 3), cells.slice(3)].map((line, r) => (
          <View key={r} style={styles.cellRow}>
            {line.map(([label, value]) => (
              <View key={label} style={[styles.cell, { backgroundColor: mixColor(fg, panel, 0.1) }]}>
                <Text numberOfLines={1} style={[styles.cellLabel, { color: fg }]}>{label}</Text>
                <MonoText numberOfLines={1} style={[styles.cellValue, mono]}>{value}</MonoText>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.sm },
  score: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  stat: { flex: 1 },
  lab: { fontSize: fontSize.xs, lineHeight: 16, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  opLab: { opacity: 0.74 },
  flaps: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  flap: { width: FLAP.width, height: FLAP.height, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
  flapText: { fontSize: 44, fontWeight: '700' },
  flapLine: { position: 'absolute', left: 0, right: 0, top: '50%', height: 2, marginTop: -1 },
  big: { marginTop: spacing.xs, fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -1 },
  bigTime: { fontSize: 20 },
  small: { fontSize: fontSize.xs, lineHeight: 16, opacity: 0.8 },
  chead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.md },
  chart: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end', height: CHART_HEIGHT, marginTop: spacing.xs },
  goal: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed' },
  goalText: { position: 'absolute', right: 0, top: -17 },
  day: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  value: { paddingHorizontal: 2, fontSize: fontSize.xs, lineHeight: 16, fontWeight: '700' },
  bar: { alignSelf: 'stretch', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  future: { height: 3 },
  dayName: { height: DAY_LABEL, fontSize: fontSize.xs, lineHeight: DAY_LABEL, opacity: 0.8 },
  today: { opacity: 1, fontWeight: '700' },
  cells: { gap: spacing.xs, marginTop: spacing.sm },
  cellRow: { flexDirection: 'row', gap: spacing.xs },
  cell: { flex: 1, minWidth: 0, padding: spacing.sm, borderRadius: radius.sm },
  cellLabel: { fontSize: fontSize.xs, lineHeight: 16, opacity: 0.8 },
  cellValue: { fontSize: fontSize.md, lineHeight: 22, fontWeight: '700' },
});
