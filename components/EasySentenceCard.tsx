import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import * as Speech from 'expo-speech';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { levenshtein } from '@/lib/levenshtein';

interface Props {
  sourceSentence: string;
  targetWords: string[];
  trapWords: string[];
  onResult: (correct: boolean) => void;
  onBury?: () => void;
  onSkip?: () => void;
  // FB90: the card's grammar note, shown only after a wrong build.
  mistakeNote?: string | null;
  // FB118: speech locale of the learned language, so a placed tile can be heard.
  speechLocale?: string;
}

export default function EasySentenceCard({ sourceSentence, targetWords, trapWords, onResult, onBury, onSkip, mistakeNote, speechLocale }: Props) {
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
    // FB118, Kálmán 2026-08-14: "amikor beteszi felulre akkor ki is ejtse azt a
    // szót amit betettem, hogy a kiejtést halljam". Only the single tile is
    // spoken, so the whole sentence is never given away.
    if (speechLocale) {
      Speech.stop();
      Speech.speak(bank[bankIdx], { language: speechLocale });
    }
  };

  const removeWord = (posInPlaced: number) => {
    if (result) return;
    setPlaced(placed.filter((_, i) => i !== posInPlaced));
  };

  const handleCheck = () => {
    // Forgiving (same rule as the typing cards): ignore case + trailing
    // punctuation, accept up to a 2-character difference as fully correct.
    const norm = (str: string) => str.toLowerCase().replace(/[.!?¡¿,;:]+$/, '').trim();
    const builtStr = norm(placed.map(i => bank[i]).join(' '));
    const targetStr = norm(targetWords.join(' '));
    const isCorrect = levenshtein(builtStr, targetStr) <= 2;
    setResult(isCorrect ? 'correct' : 'wrong');
  };

  const canCheck = placed.length > 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.sourceText, { color: colors.text }]}>{sourceSentence}</Text>

      <View style={[styles.placedArea, { borderColor: result === 'correct' ? '#22C55E' : result === 'wrong' ? '#EF4444' : colors.tabIconDefault, borderStyle: result === 'correct' ? 'solid' : 'dashed' }]}>
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

      {result === 'wrong' && mistakeNote ? (
        <Text style={[styles.noteLine, { color: colors.tabIconDefault }]}>{mistakeNote}</Text>
      ) : null}

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
          style={[styles.checkBtn, styles.checkBtnPrimary, { backgroundColor: colors.accent, opacity: canCheck ? 1 : 0.4 }]}
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
        <Pressable style={({ pressed }) => [styles.buryBtn, pressed && { backgroundColor: '#22C55E', borderRadius: 8 }]} onPress={onBury}>
          {({ pressed }) => <Text style={[styles.buryText, pressed && { color: '#FFFFFF' }]}>{s.buttons.iKnowThis}</Text>}
        </Pressable>
      )}

      {/* FB46: too-hard-right-now escape hatch, requeues to the end with no rating. */}
      {onSkip && (
        <Pressable style={({ pressed }) => [styles.buryBtn, pressed && { backgroundColor: '#22C55E', borderRadius: 8 }]} onPress={onSkip}>
          {({ pressed }) => <Text style={[styles.buryText, pressed && { color: '#FFFFFF' }]}>{s.card.skip}</Text>}
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
  noteLine: { fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 8 },
  checkBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  checkBtnPrimary: { paddingHorizontal: 44, paddingVertical: 14, borderRadius: 24, alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  checkBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  nextBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14, marginTop: 8, alignSelf: 'center' },
  nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  buryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8 },
  buryText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
});
