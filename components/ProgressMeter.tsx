import { StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';

interface Props {
  known: number;
  total: number;
  langFlag: string;
  langName: string;
}

// Unique "gem grid" meter: a wrapped row of diamonds (rotated squares) that fill
// as the learner masters words. Rarely used vs a plain bar, no extra dependency.
const MAX_CELLS = 40;

export default function ProgressMeter({ known, total, langFlag, langName }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const safeTotal = Math.max(total, 1);
  const cellCount = Math.min(safeTotal, MAX_CELLS);
  const ratio = Math.min(known / safeTotal, 1);
  const filled = Math.round(ratio * cellCount);
  const pct = Math.round(ratio * 100);

  return (
    <View style={styles.wrap}>
      <View style={styles.captionRow}>
        <Text style={[styles.label, { color: colors.text }]}>
          {langFlag} {s.progress.wordsKnown}
        </Text>
        <Text style={[styles.count, { color: colors.tint }]}>
          {known} / {total}
        </Text>
      </View>

      <View style={styles.grid}>
        {Array.from({ length: cellCount }).map((_, i) => {
          const isFilled = i < filled;
          const isEdge = i === filled - 1;
          return (
            <View
              key={i}
              style={[
                styles.cell,
                {
                  backgroundColor: isFilled ? (isEdge ? colors.accent : colors.tint) : 'transparent',
                  borderColor: isFilled ? 'transparent' : colors.tabIconDefault,
                },
              ]}
            />
          );
        })}
      </View>

      <Text style={[styles.pct, { color: colors.tabIconDefault }]}>
        {langName} · {pct}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  captionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  count: {
    fontSize: 15,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    paddingVertical: 4,
  },
  cell: {
    width: 13,
    height: 13,
    borderRadius: 2,
    borderWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  pct: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'right',
  },
});
