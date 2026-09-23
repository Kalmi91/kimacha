import { StyleSheet, View, Text, Pressable } from 'react-native';

import Colors from '@/constants/Colors';
import type { PcicLevel } from '@/data/pcic';

type ColorScheme = (typeof Colors)['light'];

// s1 (anki-ui-terv.html): egy sor a szint-választó lapon, a PCIC fejléc-chip
// alulról felcsúszó lapján ÉS az onboarding szint-lépésén is (PLAN-play 10.).
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
        {introduced > 0 ? `${introduced} / ${total} introduced` : 'not started'}
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
