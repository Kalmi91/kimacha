import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { type ExamItem } from '@/lib/examBuilder';

type MatchItem = Extract<ExamItem, { kind: 'match' }>;

interface Props {
  item: MatchItem;
  onResult: (correct: boolean) => void;
}

/**
 * Match card: left column = ES signs/labels, right column = EN meanings.
 * User taps a left item then a right item to pair them.
 * All pairs correct = onResult(true); any wrong = onResult(false).
 */
export default function ExamMatchCard({ item, onResult }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const pairs = item.pairs;
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  // matched[leftIdx] = rightIdx when paired
  const [matched, setMatched] = useState<Map<number, number>>(new Map());
  const [wrongPair, setWrongPair] = useState<[number, number] | null>(null);
  const [done, setDone] = useState(false);
  const [allCorrect, setAllCorrect] = useState(false);

  // Shuffle right side once
  const [rightOrder] = useState<number[]>(() => {
    const idx = pairs.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  });

  const matchedRights = new Set(matched.values());

  const handleLeftTap = (leftIdx: number) => {
    if (done || matched.has(leftIdx)) return;
    setSelectedLeft(leftIdx === selectedLeft ? null : leftIdx);
    setWrongPair(null);
  };

  const handleRightTap = (rightDisplayIdx: number) => {
    if (done) return;
    const rightIdx = rightOrder[rightDisplayIdx];
    if (matchedRights.has(rightIdx)) return;
    if (selectedLeft === null) return;

    const isCorrect = rightIdx === selectedLeft;
    if (isCorrect) {
      const newMatched = new Map(matched);
      newMatched.set(selectedLeft, rightIdx);
      setMatched(newMatched);
      setSelectedLeft(null);

      if (newMatched.size === pairs.length) {
        setAllCorrect(true);
        setDone(true);
        setTimeout(() => onResult(true), 1000);
      }
    } else {
      setWrongPair([selectedLeft, rightDisplayIdx]);
      setSelectedLeft(null);
      setTimeout(() => {
        setWrongPair(null);
        setDone(true);
        onResult(false);
      }, 1200);
    }
  };

  const getLeftBg = (leftIdx: number) => {
    if (matched.has(leftIdx)) return '#22C55E';
    if (wrongPair && wrongPair[0] === leftIdx) return '#EF4444';
    if (selectedLeft === leftIdx) return '#1E40AF';
    return '#2563EB';
  };

  const getRightBg = (displayIdx: number) => {
    const rightIdx = rightOrder[displayIdx];
    if (matchedRights.has(rightIdx)) return '#22C55E';
    if (wrongPair && wrongPair[1] === displayIdx) return '#EF4444';
    return '#2563EB';
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.instruction, { color: colors.tabIconDefault }]}>
        ES → EN
      </Text>
      <View style={styles.columns}>
        <View style={styles.col}>
          {pairs.map((pair, leftIdx) => (
            <Pressable
              key={`left-${leftIdx}`}
              style={[styles.chip, { backgroundColor: getLeftBg(leftIdx) }]}
              onPress={() => handleLeftTap(leftIdx)}
            >
              <Text style={styles.chipText}>{pair.left}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.col}>
          {rightOrder.map((rightIdx, displayIdx) => (
            <Pressable
              key={`right-${displayIdx}`}
              style={[styles.chip, { backgroundColor: getRightBg(displayIdx) }]}
              onPress={() => handleRightTap(displayIdx)}
            >
              <Text style={styles.chipText}>{pairs[rightIdx].right}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {allCorrect && (
        <Text style={[styles.resultText, { color: '#22C55E' }]}>{s.card.correct}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    minHeight: 280,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    gap: 16,
  },
  instruction: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  columns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  col: {
    flex: 1,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  chipText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  resultText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
