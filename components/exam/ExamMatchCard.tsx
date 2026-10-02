import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';
import { Card } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { hashString, shuffleArray } from '@/lib/shuffle';
import { useTheme } from '@/lib/ThemeContext';
import ExamButton from './ExamButton';

// PLAN-vizsga A. szakasz 2. lépés (A5 c): párosítás. Bal oszlop = a tanult nyelv
// szavai, alul a kiinduló nyelvű jelentések; a kijelölt bal sorhoz a jelentésre
// koppintva rendel párt (a sor a következő párosítatlanra lép). A "Check" csak akkor
// él, ha minden sornak van párja; csupa jó pár után a vizsga megy tovább, különben a
// helyes párok látszanak, és a "Next" lép tovább.
type Props = {
  pairs: { left: string; right: string }[];
  onDone: (correct: boolean) => void;
};

export default function ExamMatchCard({ pairs, onDone }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const [pool] = useState(() =>
    shuffleArray(
      pairs.map((_, i) => i),
      hashString(pairs.map((p) => p.left).join('|')),
    ),
  );
  // assigned[leftIdx] = a hozzárendelt jelentés (a pairs indexe), vagy null.
  const [assigned, setAssigned] = useState<(number | null)[]>(() => pairs.map(() => null));
  const [selected, setSelected] = useState<number | null>(0);
  const [missed, setMissed] = useState(false);

  const firstFree = (list: (number | null)[]) => {
    const i = list.findIndex((a) => a === null);
    return i < 0 ? null : i;
  };
  const pickLeft = (i: number) => {
    if (missed) return;
    const next = [...assigned];
    next[i] = null;
    setAssigned(next);
    setSelected(i);
  };
  const pickRight = (rightIdx: number) => {
    if (missed || selected === null) return;
    const next = [...assigned];
    next[selected] = rightIdx;
    setAssigned(next);
    setSelected(firstFree(next));
  };
  const allAssigned = assigned.every((a) => a !== null);
  const check = () => {
    if (assigned.every((a, i) => a === i)) onDone(true);
    else setMissed(true);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{s.exam.matchPairs}</Text>
        {pairs.map((pair, i) => (
          <Pressable
            key={pair.left}
            testID={`exam-left-${i}`}
            accessibilityRole="button"
            onPress={() => pickLeft(i)}
            style={[
              styles.row,
              g.brutal && styles.brutalEdge,
              { backgroundColor: colors.card, borderColor: selected === i && !missed ? colors.tint : colors.border },
              selected === i && !missed && styles.rowSelected,
            ]}
          >
            <Text style={[styles.word, { color: colors.text }]}>{pair.left}</Text>
            <Text style={[styles.partner, { color: assigned[i] === null ? colors.textMuted : colors.text }]}>
              {assigned[i] === null ? '…' : `→ ${pairs[assigned[i] as number].right}`}
            </Text>
          </Pressable>
        ))}
        {!missed && (
          <View style={styles.pool}>
            {pool
              .filter((rightIdx) => !assigned.includes(rightIdx))
              .map((rightIdx) => (
                <Pressable
                  key={rightIdx}
                  testID={`exam-right-${rightIdx}`}
                  accessibilityRole="button"
                  onPress={() => pickRight(rightIdx)}
                  style={[styles.chip, g.brutal && styles.brutalEdge, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.chipText, { color: colors.text }]}>{pairs[rightIdx].right}</Text>
                </Pressable>
              ))}
          </View>
        )}
        {missed && (
          <View style={styles.reveal}>
            <ResultBadge correct={false} label={s.games.wrongFeedback} />
            <Text style={[styles.revealLabel, { color: colors.textMuted }]}>{s.exam.correctAnswer}</Text>
            {pairs.map((pair) => (
              <Text key={pair.left} testID="exam-correct-pair" style={[styles.revealText, { color: colors.success }]}>
                {pair.left} = {pair.right}
              </Text>
            ))}
          </View>
        )}
      </Card>
      {missed ? (
        <ExamButton testID="exam-next" label={`${s.card.next} →`} onPress={() => onDone(false)} />
      ) : (
        <ExamButton testID="exam-check" label={s.card.check} onPress={check} disabled={!allAssigned} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: FAB_CLEARANCE, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  label: { fontSize: fontSize.sm, textAlign: 'center' },
  row: {
    minHeight: tapTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowSelected: { borderWidth: 2 },
  brutalEdge: { borderRadius: 0, borderWidth: 2 },
  word: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, flexShrink: 1 },
  partner: { fontSize: fontSize.md, flexShrink: 1, textAlign: 'right' },
  pool: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  chip: {
    minHeight: tapTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  chipText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  reveal: { gap: spacing.xs },
  revealLabel: { fontSize: fontSize.sm },
  revealText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
