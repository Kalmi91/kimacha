import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import type { BoardMetric } from '@/lib/cloud/board';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';

// The switch on top of the leaderboard: two separate rankings, the week's XP or the week's learning time. `value` is the learner's
// choice (it is remembered by useBoard); the list below changes when the worker's answer for it arrives.
export default function MetricSwitch({ value, onChange }: { value: BoardMetric; onChange: (metric: BoardMetric) => void }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().board;
  const options: { metric: BoardMetric; label: string }[] = [
    { metric: 'xp', label: s.metricXp },
    { metric: 'time', label: s.metricTime },
  ];
  return (
    <View accessibilityRole="tablist" accessibilityLabel={s.metricLabel} style={[styles.wrap, { backgroundColor: colors.card }]}>
      {options.map((o) => {
        const on = o.metric === value;
        return (
          <Pressable
            key={o.metric}
            testID={`board-metric-${o.metric}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.metric)}
            style={[styles.option, on && { backgroundColor: colors.tint }]}
          >
            <Text style={[styles.label, { color: on ? colors.onTint : colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', flexDirection: 'row', marginBottom: spacing.sm, padding: 3, borderRadius: radius.lg },
  option: { minWidth: 88, minHeight: tapTarget - 8, paddingHorizontal: spacing.md, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
