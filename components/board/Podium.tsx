import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, lineHeight, medal, radius, spacing } from '@/constants/Theme';
import type { BoardRow } from '@/lib/cloud/board';
import { t } from '@/lib/i18n';
import { textOn } from '@/lib/contrast';
import { mixColor } from '@/lib/mixColor';
import { useTheme } from '@/lib/ThemeContext';
import { avatarColor } from './boardUi';
import RiseChip from './RiseChip';

export type Gains = Record<string, { delta: number; id: number }>;

// Columns left to right: 2nd, 1st, 3rd. Flex 1 / 1.16 / 1, the ring avatar 50 / 60 / 50, the column's height follows the XP.
const COLUMNS = [
  { place: 2, flex: 1, avatar: 50, ghost: 100, medal: medal.silver },
  { place: 1, flex: 1.16, avatar: 60, ghost: 112, medal: medal.gold },
  { place: 3, flex: 1, avatar: 50, ghost: 83, medal: medal.bronze },
] as const;
const FIRST_HEIGHT = 112;
// the sheet overlaps the column's bottom by 8; the rank and XP lines need 8 + 34 + 16 = 58, so 72 leaves them fully visible
const MIN_HEIGHT = 72;

// The top three. `rows` null = no data (joining, loading, offline): three faint "?" columns. Fewer than three players: the
// missing column is a faint placeholder.
export default function Podium({ rows, gains, onGainDone }: { rows: BoardRow[] | null; gains?: Gains; onGainDone?: (name: string, id: number) => void }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().board;
  const band = mixColor(colors.secondary, colors.background, 0.3);
  const top = rows?.[0]?.xp || 1;
  return (
    <View style={styles.pod}>
      {COLUMNS.map((c) => {
        const row = rows?.find((r) => r.rank === c.place);
        const size = c.avatar;
        const ring = [styles.ring, { backgroundColor: c.medal }];
        const avatar = [styles.avatar, { width: size, height: size, borderRadius: size / 2 }];
        if (!row) {
          return (
            <View key={c.place} testID={`board-podium-ghost-${c.place}`} style={[styles.col, { flex: c.flex }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={ring}>
                <View style={[...avatar, { backgroundColor: colors.card }]}>
                  <Text style={[styles.letter, { color: colors.text }]}>?</Text>
                </View>
              </View>
              <View style={[styles.block, { height: c.ghost, marginTop: spacing.sm, backgroundColor: mixColor(colors.text, band, 0.12) }]} />
            </View>
          );
        }
        const gain = gains?.[row.name];
        const fill = c.place === 1 ? colors.tint : colors.secondary;
        const ink = c.place === 1 ? colors.onTint : textOn(colors.secondary, colors.text, colors.background);
        const height = Math.max(MIN_HEIGHT, Math.round((row.xp / top) * FIRST_HEIGHT));
        return (
          <View
            key={c.place}
            testID={`board-podium-${c.place}`}
            accessible
            accessibilityLabel={`${row.name}, ${s.rankLine(row.rank, row.xp)}`}
            style={[styles.col, { flex: c.flex }]}
          >
            <View style={ring}>
              <View style={[...avatar, { backgroundColor: avatarColor(row.name, colors) }]}>
                <Text style={[styles.letter, { color: colors.text }]}>{[...row.name][0].toUpperCase()}</Text>
              </View>
            </View>
            <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{row.me ? `${row.name} ${s.you}` : row.name}</Text>
            <View style={[styles.block, { height, backgroundColor: fill }]}>
              <Text style={[styles.place, { color: ink }]}>{c.place}</Text>
              <Text style={[styles.xp, c.place === 1 && styles.xpFirst, { color: ink }]}>{s.xp(row.xp)}</Text>
              {gain ? <RiseChip key={gain.id} delta={gain.delta} onDone={() => onGainDone?.(row.name, gain.id)} style={styles.gain} /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pod: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.lg, minHeight: 204 },
  col: { alignItems: 'center', minWidth: 0 },
  ring: { padding: 3, borderRadius: radius.full },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: 20, fontWeight: '700' },
  name: { maxWidth: '100%', marginVertical: spacing.xs, fontSize: fontSize.sm, fontWeight: '700' },
  block: { alignSelf: 'stretch', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, alignItems: 'center', paddingTop: spacing.sm },
  place: { fontSize: fontSize.xxl, lineHeight: lineHeight.xxl, fontWeight: '700' },
  xp: { fontSize: fontSize.xs, lineHeight: lineHeight.xs, fontWeight: '700' },
  xpFirst: { fontSize: fontSize.sm },
  gain: { top: -9, right: spacing.xs },
});
