import { StyleSheet, View, Pressable } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { t } from '@/lib/i18n';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalBox, SegmentBar, segmentsFilled } from '@/components/grammar/Brutal';
import type { PcicLevel } from '@/data/pcic';

type ColorScheme = (typeof Colors)['light'];

// One row of the level-picker sheet: on the sheet that slides up from the PCIC header chip
// AND on the onboarding level step too.
type Props = {
  level: PcicLevel;
  label: string;
  introduced: number;
  total: number;
  active: boolean;
  colors: ColorScheme;
  onPress: () => void;
};

export default function LevelRow({ level, label, introduced, total, active, colors, onPress }: Props) {
  const pct = total > 0 ? (introduced / total) * 100 : 0;
  // The row used to show these two texts hardcoded in English, so they
  // stayed English on a Spanish UI too.
  const s = t();
  const g = useGrammarColors();
  // brutalist palette: a box (active = the fill) + a segmented bar.
  if (g.brutal) {
    const ink = active ? g.onFill : g.ink;
    return (
      <BrutalBox
        testID={`level-row-${level}`}
        fill={active ? 'a' : 'paper'}
        offset={2}
        style={styles.brutalRow}
        boxStyle={styles.brutalBox}
        onPress={onPress}
      >
        <View style={styles.topLine}>
          <Text style={[styles.label, { color: ink, fontWeight: '500', textTransform: 'uppercase' }]}>{`${level} · ${label}`}</Text>
          {active && <Text style={[styles.check, { color: ink }]}>✓</Text>}
        </View>
        <SegmentBar filled={segmentsFilled(pct, 8)} segments={8} style={styles.brutalBar} />
        <Text style={[styles.progress, { color: active ? g.onFill : g.mu }]}>
          {introduced > 0 ? s.pcic.levelRowIntroduced(introduced, total) : s.pcic.levelNotStarted}
        </Text>
      </BrutalBox>
    );
  }
  return (
    <Pressable
      style={[styles.row, { backgroundColor: colors.card, borderColor: active ? colors.tint : 'transparent' }]}
      onPress={onPress}
    >
      <View style={styles.topLine}>
        <View style={[styles.badge, { backgroundColor: colors.tint }]}>
          <Text style={styles.badgeText}>{level}</Text>
        </View>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {active && <Text style={[styles.check, { color: colors.tint }]}>✓</Text>}
      </View>
      <View style={[styles.track, { backgroundColor: colors.background }]}>
        <View style={[styles.fill, { backgroundColor: colors.tint, width: `${pct}%` }]} />
      </View>
      <Text style={[styles.progress, { color: colors.tabIconDefault }]}>
        {introduced > 0 ? s.pcic.levelRowIntroduced(introduced, total) : s.pcic.levelNotStarted}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    marginBottom: 10,
  },
  brutalRow: { marginBottom: 10 },
  brutalBox: { padding: 12 },
  brutalBar: { marginBottom: 6 },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  check: {
    fontSize: 18,
    fontWeight: '700',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  progress: {
    fontSize: 12,
  },
});
