import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, lineHeight, radius, shadow, spacing, tapTarget } from '@/constants/Theme';
import type { BoardRow } from '@/lib/cloud/board';
import { gaps } from '@/lib/cloud/boardStats';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';

// The bar floating above the tab bar: the own place, name and XP with the gap to the next place (tap: jump to the own-week panel)
// and the Learn button.
export default function MeBar({ me, rows, onOpenWeek, onLearn }: { me: { rank: number; xp: number; name: string }; rows: BoardRow[]; onOpenWeek?: () => void; onLearn: () => void }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().board;
  const { toPass, lead, atTop, alone } = gaps(rows, me);
  // The second line only says what is known: the gap to the player ahead, the lead at the top, or being alone at the top.
  const hint = toPass !== null ? s.needToPass(toPass) : atTop && lead !== null ? s.leading(lead) : alone ? s.alone : null;
  return (
    <View testID="board-mebar" style={[styles.bar, { backgroundColor: colors.text }]}>
      <Pressable
        testID="board-open-week"
        accessibilityRole="button"
        accessibilityLabel={`${me.name}, ${s.rankLine(me.rank, me.xp)}${hint ? `, ${hint}` : ''}`}
        onPress={onOpenWeek}
        disabled={!onOpenWeek}
        style={styles.open}
      >
        <Text testID="board-rank" style={[styles.big, { color: colors.background }]}>{`${me.rank}.`}</Text>
        <View style={styles.txt}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.background }]}>{`${me.name} · ${s.xp(me.xp)}`}</Text>
          {hint ? <Text numberOfLines={1} style={[styles.hint, { color: colors.background }]}>{hint}</Text> : null}
        </View>
      </Pressable>
      <Pressable testID="board-learn" accessibilityRole="button" accessibilityLabel={s.learn} onPress={onLearn} style={[styles.go, { backgroundColor: colors.tint }]}>
        <Text style={[styles.goText, { color: colors.onTint }]}>{s.learn}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderRadius: radius.lg,
    ...shadow.modal,
  },
  open: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: tapTarget },
  big: { fontSize: fontSize.xxl, lineHeight: lineHeight.xxl, fontWeight: fontWeight.bold, letterSpacing: -1 },
  txt: { flex: 1, minWidth: 0 },
  name: { fontSize: fontSize.md, lineHeight: lineHeight.md, fontWeight: fontWeight.bold },
  hint: { fontSize: fontSize.xs, lineHeight: lineHeight.xs },
  go: { minWidth: tapTarget, minHeight: tapTarget, paddingHorizontal: spacing.md, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  goText: { fontWeight: fontWeight.bold },
});
