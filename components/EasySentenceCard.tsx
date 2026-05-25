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
}

export default function EasySentenceCard({ sourceSentence, targetWords, trapWords, onResult }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const [placed, setPlaced] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>(() =>
    [...targetWords, ...trapWords].sort(() => Math.random() - 0.5)
  );
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);

  const addWord = (word: string, idx: number) => {
    if (result) return;
    setPlaced([...placed, word]);
    setAvailable(available.filter((_, i) => i !== idx));
  };

  const removeWord = (idx: number) => {
    if (result) return;
    const word = placed[idx];
    setPlaced(placed.filter((_, i) => i !== idx));
    setAvailable([...available, word]);
  };

  const handleCheck = () => {
    const isCorrect = placed.length === targetWords.length &&
      placed.every((w, i) => w.toLowerCase() === targetWords[i].toLowerCase());
    setResult(isCorrect ? 'correct' : 'wrong');
    setTimeout(() => onResult(isCorrect), 1500);
  };

  const canCheck = placed.length >= targetWords.length;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.sourceText, { color: colors.text }]}>{sourceSentence}</Text>

      <View style={[styles.placedArea, { borderColor: result === 'correct' ? '#22C55E' : result === 'wrong' ? '#EF4444' : colors.tabIconDefault }]}>
        {placed.length === 0 ? (
          <Text style={[styles.placeholder, { color: colors.tabIconDefault }]}>...</Text>
        ) : (
          <View style={styles.wordRow}>
            {placed.map((w, i) => (
              <Pressable key={`${w}-${i}`} style={[styles.wordChip, styles.placedChip]} onPress={() => removeWord(i)}>
                <Text style={styles.chipText}>{w}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {result === 'wrong' && (
        <Text style={[styles.correctLine, { color: '#22C55E' }]}>{targetWords.join(' ')}</Text>
      )}

      {result && (
        <Text style={[styles.resultText, { color: result === 'correct' ? '#22C55E' : '#EF4444' }]}>
          {result === 'correct' ? s.card.correct : s.card.wrong}
        </Text>
      )}

      <View style={styles.wordRow}>
        {available.map((w, i) => (
          <Pressable key={`${w}-${i}`} style={[styles.wordChip, { backgroundColor: '#2563EB' }]} onPress={() => addWord(w, i)}>
            <Text style={styles.chipText}>{w}</Text>
          </Pressable>
        ))}
      </View>

      {!result && (
        <Pressable
          style={[styles.checkBtn, { backgroundColor: colors.tint, opacity: canCheck ? 1 : 0.4 }]}
          onPress={handleCheck}
          disabled={!canCheck}
        >
          <Text style={styles.checkBtnText}>{s.card.check}</Text>
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
  chipText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  resultText: { fontSize: 18, fontWeight: '700' },
  correctLine: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  checkBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  checkBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
