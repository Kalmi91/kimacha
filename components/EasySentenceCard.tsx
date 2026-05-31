import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';

interface Props {
  sourceSentence: string;
  targetWords: string[];
  trapWords: string[];
  onResult: (correct: boolean) => void;
  onBury?: () => void;
}

export default function EasySentenceCard({ sourceSentence, targetWords, trapWords, onResult, onBury }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  // Word bank shuffled once. Positions never change — clicking a word leaves a
  // same-size dashed placeholder in its spot instead of reflowing the whole row.
  const [bank] = useState<string[]>(() =>
    [...targetWords, ...trapWords].sort(() => Math.random() - 0.5)
  );
  // placed = bank indices, in the order the user tapped them.
  const [placed, setPlaced] = useState<number[]>([]);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);

  const usedSet = new Set(placed);

  const addWord = (bankIdx: number) => {
    if (result) return;
    setPlaced([...placed, bankIdx]);
  };

  const removeWord = (posInPlaced: number) => {
    if (result) return;
    setPlaced(placed.filter((_, i) => i !== posInPlaced));
  };

  const handleCheck = () => {
    const built = placed.map(i => bank[i]);
    const isCorrect = built.length === targetWords.length &&
      built.every((w, i) => w.toLowerCase() === targetWords[i].toLowerCase());
    setResult(isCorrect ? 'correct' : 'wrong');
  };

  const canCheck = placed.length > 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.sourceText, { color: colors.text }]}>{sourceSentence}</Text>

      <View style={[styles.placedArea, { borderColor: result === 'correct' ? '#22C55E' : result === 'wrong' ? '#EF4444' : colors.tabIconDefault }]}>
        {placed.length === 0 ? (
          <Text style={[styles.placeholder, { color: colors.tabIconDefault }]}>...</Text>
        ) : (
          <View style={styles.wordRow}>
            {placed.map((bankIdx, pos) => (
              <Pressable key={`placed-${bankIdx}-${pos}`} style={[styles.wordChip, styles.placedChip]} onPress={() => removeWord(pos)}>
                <Text style={styles.chipText}>{bank[bankIdx]}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {result === 'wrong' && (
        <Text style={[styles.correctLine, { color: '#22C55E' }]}>{targetWords.join(' ')}</Text>
      )}

      <View style={styles.wordRow}>
        {bank.map((w, idx) =>
          usedSet.has(idx) ? (
            // Same-size dashed slot keeps the layout fixed while the word is in use.
            <View key={`slot-${idx}`} style={[styles.wordChip, styles.emptySlot, { borderColor: colors.tabIconDefault }]}>
              <Text style={[styles.chipText, styles.hiddenText]}>{w}</Text>
            </View>
          ) : (
            <Pressable key={`bank-${idx}`} style={[styles.wordChip, { backgroundColor: '#2563EB' }]} onPress={() => addWord(idx)}>
              <Text style={styles.chipText}>{w}</Text>
            </Pressable>
          )
        )}
      </View>

      {!result ? (
        <Pressable
          style={[styles.checkBtn, { backgroundColor: colors.tint, opacity: canCheck ? 1 : 0.4 }]}
          onPress={handleCheck}
          disabled={!canCheck}
        >
          <Text style={styles.checkBtnText}>{s.card.check}</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.checkBtn, { backgroundColor: result === 'correct' ? '#22C55E' : '#EF4444' }]}
          onPress={() => onResult(result === 'correct')}
        >
          <Text style={styles.checkBtnText}>
            {result === 'correct' ? s.card.correct : s.card.wrong} →
          </Text>
        </Pressable>
      )}

      {onBury && (
        <Pressable style={styles.buryBtn} onPress={onBury}>
          <Text style={styles.buryText}>{s.buttons.iKnowThis}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 24, alignItems: 'center', minHeight: 280, gap: 16 },
  sourceText: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  placedArea: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, padding: 12, minHeight: 50, width: '100%', justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontSize: 16 },
  wordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  // Transparent border here keeps the chip box model identical to emptySlot so sizes match exactly.
  wordChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#2563EB', borderWidth: 2, borderColor: 'transparent' },
  placedChip: { backgroundColor: '#1E40AF' },
  emptySlot: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  hiddenText: { opacity: 0 },
  chipText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  resultText: { fontSize: 18, fontWeight: '700' },
  correctLine: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  checkBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  checkBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  nextBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14, marginTop: 8, alignSelf: 'center' },
  nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  buryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8 },
  buryText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
});
