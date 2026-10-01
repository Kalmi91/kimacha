import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { SegmentBar, segmentsFilled } from '@/components/grammar/Brutal';
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
// NY25: brutalista palettán a gyémánt-rács helyett 8 blokkos SegmentBar.
const BRUTAL_SEGMENTS = 8;

// FB122, Kálmán 2026-08-14: "ha valaki sokkal nagyobb betűkkel használja a
// telefonját ... összelóg ez a felső progress bár". The caption is a fixed-height
// row, so its two texts stay on one line and follow the system font size only up
// to this multiplier.
const FONT_SCALE_CAP = 1.4;

export default function ProgressMeter({ known, total, langFlag, langName }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();

  const safeTotal = Math.max(total, 1);
  const cellCount = Math.min(safeTotal, MAX_CELLS);
  const ratio = Math.min(known / safeTotal, 1);
  const filled = Math.round(ratio * cellCount);
  const pct = Math.round(ratio * 100);

  return (
    <View style={styles.wrap}>
      <View style={styles.captionRow}>
        <Text
          style={[styles.label, { color: colors.text }, g.brutal && styles.brutalLabel]}
          numberOfLines={1}
          maxFontSizeMultiplier={FONT_SCALE_CAP}
        >
          {langFlag} {s.progress.wordsKnown}
        </Text>
        <Text
          style={[styles.count, { color: g.brutal ? g.ink : colors.tint }, g.brutal && styles.brutalCount]}
          numberOfLines={1}
          maxFontSizeMultiplier={FONT_SCALE_CAP}
        >
          {known} / {total}
        </Text>
      </View>

      {g.brutal ? (
        <SegmentBar testID="progress-segments" filled={segmentsFilled(pct, BRUTAL_SEGMENTS)} segments={BRUTAL_SEGMENTS} style={styles.brutalBar} />
      ) : (
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
      )}

      <Text style={[styles.pct, { color: g.brutal ? g.mu : colors.tabIconDefault }]}>
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
    flexShrink: 1,
    marginRight: 8,
  },
  count: {
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 0,
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
  brutalLabel: { textTransform: 'uppercase', fontWeight: '500' },
  brutalCount: { fontWeight: '500' },
  brutalBar: { marginVertical: 4 },
  pct: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'right',
  },
});
