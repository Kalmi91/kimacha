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

interface Placed {
  word: string;
  slot: number; // index into the fixed `slots` array
}

export default function EasySentenceCard({ sourceSentence, targetWords, trapWords, onResult, onBury }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  // Fixed pool: every word keeps its position. Tapping it moves it up into the
  // sentence area and leaves a dashed ghost of the same size behind — nothing
  // reflows.
  const [slots] = useState<string[]>(() => [...targetWords, ...trapWords].sort(() => Math.random() - 0.5));
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);

  const usedSlots = new Set(placed.map(p => p.slot));

  const addWord = (slot: number) => {
    if (result || usedSlots.has(slot)) return;
    setPlaced([...placed, { word: slots[slot], slot }]);
  };

  const removeWord = (idx: number) => {
    if (result) return;
    setPlaced(placed.filter((_, i) => i !== idx));
  };

  const handleCheck = () => {
    const isCorrect = placed.length === targetWords.length &&
      placed.every((p, i) => p.word.toLowerCase() === targetWords[i].toLowerCase());
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
            {placed.map((p, i) => (
              <Pressable key={`placed-${p.slot}`} style={[styles.wordChip, styles.placedChip]} onPress={() => removeWord(i)}>
                <Text style={styles.chipText}>{p.word}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {result === 'wrong' && (
        <Text style={[styles.correctLine, { color: '#22C55E' }]}>{targetWords.join(' ')}</Text>
      )}

      <View style={styles.wordRow}>
        {slots.map((w, i) =>
          usedSlots.has(i) ? (
            // Ghost slot: same footprint as the chip (invisible text reserves
            // the width), dashed grey outline marks where the word lived.
            <View key={`ghost-${i}`} style={[styles.wordChip, styles.ghostChip, { borderColor: colors.tabIconDefault }]}>
              <Text style={[styles.chipText, styles.ghostText]}>{w}</Text>
            </View>
          ) : (
            <Pressable key={`slot-${i}`} style={[styles.wordChip, { backgroundColor: '#2563EB' }]} onPress={() => addWord(i)}>
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
  wordChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#2563EB' },
  placedChip: { backgroundColor: '#1E40AF' },
  ghostChip: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed' },
  ghostText: { opacity: 0 },
  chipText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  resultText: { fontSize: 18, fontWeight: '700' },
  correctLine: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  checkBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  checkBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  buryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8 },
  buryText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
});
