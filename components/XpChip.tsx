import { StyleSheet, View } from 'react-native';
import BadgeRow from '@/components/learn/BadgeRow';
import Colors from '@/constants/Colors';
import { DAILY_XP_GOAL } from '@/lib/dailyXp';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { useXpToday } from '@/lib/useXpToday';

// The "XP n/50" chip of the word card, on the grammar and Sentences screens too. FB624: no "+N XP" text or flash,
// the number just grows. `earned` stays in the props so the screens keep passing it; it is not shown.
// `flush` (FB630): the screen already pads its content (Sentences, 20), so the chip adds no side padding of its own.
export default function XpChip({ flush = false }: { earned?: number; flush?: boolean }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const xp = useXpToday();
  const items: Parameters<typeof BadgeRow>[0]['items'] = [{ label: s.pcic.badgeXp(xp, DAILY_XP_GOAL), tone: 'accent', accessibilityLabel: s.pcic.badgeXpA11y(xp, DAILY_XP_GOAL), tabular: true }];
  return (
    <View style={flush ? styles.rowFlush : styles.row}>
      <BadgeRow singleLine colors={colors} items={items} />
    </View>
  );
}

// The screens that show it have no side padding of their own at this spot: the chip must not touch the screen edge.
const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, marginTop: 4 },
  rowFlush: { marginTop: 4 },
});
