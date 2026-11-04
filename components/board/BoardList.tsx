import { useRef, useState } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import type { BoardRow } from '@/lib/cloud/board';
import { t } from '@/lib/i18n';
import { mixColor } from '@/lib/mixColor';
import { useTheme } from '@/lib/ThemeContext';
import { avatarColor } from './boardUi';
import type { Gains } from './Podium';
import RiseChip from './RiseChip';

const SLIDE_MS = 400;

function Row({ row, gain, onGainDone, animate }: { row: BoardRow; gain?: Gains[string]; onGainDone?: (name: string, id: number) => void; animate: boolean }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().board;
  const [slide] = useState(() => new Animated.Value(0));
  const lastY = useRef<number | null>(null);
  // A row that moved (the order changed) glides from its old place to the new one.
  const onLayout = (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    if (animate && lastY.current !== null && lastY.current !== y) {
      slide.setValue(lastY.current - y);
      Animated.timing(slide, { toValue: 0, duration: SLIDE_MS, useNativeDriver: true }).start();
    }
    lastY.current = y;
  };
  return (
    <Animated.View
      testID={row.me ? 'board-row-me' : `board-row-${row.rank}`}
      accessible
      accessibilityLabel={`${row.name}, ${s.rankLine(row.rank, row.xp)}`}
      accessibilityState={{ selected: row.me }}
      onLayout={onLayout}
      style={[styles.row, { backgroundColor: row.me ? mixColor(colors.tint, colors.card, 0.2) : colors.card, transform: [{ translateY: slide }] }]}
    >
      <Text style={[styles.rank, { color: colors.textMuted }]}>{row.rank}</Text>
      <View style={[styles.avatar, { backgroundColor: avatarColor(row.name, colors) }]}>
        <Text style={[styles.letter, { color: colors.text }]}>{[...row.name][0].toUpperCase()}</Text>
      </View>
      <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{row.name}</Text>
      <Text style={[styles.xp, { color: colors.text }]}>{s.xp(row.xp)}</Text>
      {gain ? <RiseChip key={gain.id} delta={gain.delta} onDone={() => onGainDone?.(row.name, gain.id)} style={styles.gain} /> : null}
    </Animated.View>
  );
}

// The list from the 4th place down; rows are keyed by name so a row that changes place keeps its identity and can slide.
export default function BoardList({ rows, gains, onGainDone, animate }: { rows: BoardRow[]; gains: Gains; onGainDone: (name: string, id: number) => void; animate: boolean }) {
  return (
    <View>
      {rows.map((r) => (
        <Row key={r.name} row={r} gain={gains[r.name]} onGainDone={onGainDone} animate={animate} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: tapTarget + spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md },
  rank: { width: 20, textAlign: 'right', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  avatar: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  letter: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  name: { flex: 1, minWidth: 0, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  xp: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  gain: { right: 76, top: 17 },
});
