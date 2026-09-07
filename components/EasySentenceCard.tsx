import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, Keyboard } from 'react-native';
import { speak as speakIn, stop as stopSpeech } from '@/lib/speech';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { sentenceBuildMatch, strictAnswerMatch } from '@/lib/answerMatch';
import { answerInputProps } from '@/lib/inputProps';

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
  // FB146: the "write it too" practice grades with the same accent rule as the
  // typing cards (Settings -> Difficulty).
  strictAccents?: boolean;
  // Language the target sentence is written in, so its own spelling
  // variants count when the answer is graded (German ß/ss, ä/ae).
  lang?: string;
  // ITER5: the new/review and borrowed-topic chips, which used to be rows above
  // the card. They ride at the top of the card, in the flow, so they cannot
  // slide over the sentence.
  chips?: React.ReactNode;
}

export default function EasySentenceCard({ sourceSentence, targetWords, trapWords, onResult, onBury, onSkip, mistakeNote, speechLocale, strictAccents = false, lang, chips }: Props) {
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
  // FB146, Kálmán 2026-08-18 (sentence:"Como una galleta con leche."): "most ezt
  // is le akarnám írni legyen egy ilyen opció a mondatok ál[t]... miután feljött".
  // The same optional practice the word flashcard got in FB138, one card up: it
  // opens only after the build was checked, hides the solution while the field is
  // open, and stays open after a miss so the sentence can be typed again.
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [practiceText, setPracticeText] = useState('');
  const [practiceResult, setPracticeResult] = useState<'correct' | 'wrong' | null>(null);
  const targetSentence = targetWords.join(' ');
  const practiceHidesAnswer = practiceOpen && practiceResult !== 'correct';

  const usedSet = new Set(placed);

  const addWord = (bankIdx: number) => {
    if (result) return;
    setPlaced([...placed, bankIdx]);
    // FB118, Kálmán 2026-08-14: "amikor beteszi felulre akkor ki is ejtse azt a
    // szót amit betettem, hogy a kiejtést halljam". Only the single tile is
    // spoken, so the whole sentence is never given away.
    if (speechLocale) {
      stopSpeech();
      speakIn(bank[bankIdx], speechLocale);
    }
  };

  const removeWord = (posInPlaced: number) => {
    if (result) return;
    setPlaced(placed.filter((_, i) => i !== posInPlaced));
  };

  const handleCheck = () => {
    // FB137: tile for tile, no character tolerance, see sentenceBuildMatch.
    const isCorrect = sentenceBuildMatch(placed.map(i => bank[i]), targetWords);
    setResult(isCorrect ? 'correct' : 'wrong');
  };

  const canCheck = placed.length > 0;

  const checkPractice = () => {
    setPracticeResult(strictAnswerMatch(practiceText, targetSentence, { strictAccents, lang }) ? 'correct' : 'wrong');
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {chips}
      <Text style={[styles.sourceText, { color: colors.text }]}>{sourceSentence}</Text>

      <View style={[styles.placedArea, { borderColor: result === 'correct' ? '#22C55E' : result === 'wrong' ? '#EF4444' : colors.tabIconDefault, borderStyle: result === 'correct' ? 'solid' : 'dashed' }]}>
        {practiceHidesAnswer ? (
          <Text style={[styles.placeholder, { color: colors.tabIconDefault }]}>✏️</Text>
        ) : placed.length === 0 ? (
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

      {result === 'wrong' && !practiceHidesAnswer && (
        <Text style={[styles.correctLine, { color: '#22C55E' }]}>{targetSentence}</Text>
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

      {result && !practiceOpen && (
        <Pressable
          style={[styles.typeItBtn, { borderColor: colors.tabIconDefault }]}
          onPress={() => setPracticeOpen(true)}
        >
          <Text style={[styles.typeItText, { color: colors.tabIconDefault }]}>✏️ {s.card.typeIt}</Text>
        </Pressable>
      )}

      {practiceOpen && (
        <View style={styles.practiceRow}>
          <TextInput
            style={[styles.practiceInput, { color: colors.text, borderColor: colors.tabIconDefault }]}
            placeholder={s.card.typeTranslation}
            placeholderTextColor={colors.tabIconDefault}
            value={practiceText}
            onChangeText={(v) => {
              setPracticeText(v);
              // Editing after a miss clears the verdict, so the same field takes
              // another try instead of ending on "wrong" (FB138's rule).
              if (practiceResult) setPracticeResult(null);
            }}
            onSubmitEditing={checkPractice}
            autoFocus
            {...answerInputProps}
          />
          <Pressable
            style={[styles.practiceCheckBtn, { backgroundColor: '#38BDF8' }]}
            onPress={() => { Keyboard.dismiss(); checkPractice(); }}
          >
            <Text style={styles.checkBtnText}>✓</Text>
          </Pressable>
        </View>
      )}

      {practiceResult && (
        <Text style={[styles.practiceResultText, { color: practiceResult === 'correct' ? '#22C55E' : '#EF4444' }]}>
          {practiceResult === 'correct' ? s.card.correct : s.card.wrong}
        </Text>
      )}

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
  // FB146: the optional "write it too" practice under the tile build.
  typeItBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'center' },
  typeItText: { fontSize: 13, fontWeight: '600' },
  practiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  practiceInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  practiceCheckBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  practiceResultText: { fontSize: 16, fontWeight: '700' },
  buryText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
});
