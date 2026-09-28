import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, Keyboard } from 'react-native';
import { speak, stop as stopSpeech } from '@/lib/speech';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { gradePcicAnswer, suggestedGrade } from '@/lib/pcicMatch';
import { stripSentencePunct } from '@/lib/sentenceCards';
import { answerInputProps } from '@/lib/inputProps';

interface Props {
  sourceSentence: string;
  targetSentence: string;
  onResult: (correct: boolean) => void;
  // Speech locale of the learned language, the right sentence is read aloud.
  speechLocale?: string;
  // Same accent rule as the word card (Settings -> Difficulty).
  strictAccents?: boolean;
}

export default function TypedSentenceCard({ sourceSentence, targetSentence, onResult, speechLocale, strictAccents = false }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);

  const handleCheck = () => {
    Keyboard.dismiss();
    // Graded like the word card, on the sentence without its punctuation (the
    // tile card drops it too).
    const grade = gradePcicAnswer(stripSentencePunct(typed), stripSentencePunct(targetSentence), strictAccents);
    const isCorrect = suggestedGrade(grade) === 'good';
    setResult(isCorrect ? 'correct' : 'wrong');
    if (isCorrect && speechLocale) {
      stopSpeech();
      speak(targetSentence, speechLocale);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.sourceText, { color: colors.text }]}>{sourceSentence}</Text>

      <TextInput
        style={[
          styles.input,
          { color: colors.text, borderColor: result === 'correct' ? '#22C55E' : result === 'wrong' ? '#EF4444' : colors.tabIconDefault },
        ]}
        placeholder={s.card.typeSentence}
        placeholderTextColor={colors.tabIconDefault}
        value={typed}
        onChangeText={(v) => {
          setTyped(v);
          // Editing after a miss clears the verdict, so the same field takes
          // another try instead of ending on "wrong".
          if (result === 'wrong') setResult(null);
        }}
        onSubmitEditing={result ? () => onResult(result === 'correct') : handleCheck}
        editable={result !== 'correct'}
        autoFocus
        {...answerInputProps}
      />

      {result === 'wrong' && <Text style={[styles.correctLine, { color: '#22C55E' }]}>{targetSentence}</Text>}

      {result && (
        <Text style={[styles.resultText, { color: result === 'correct' ? '#22C55E' : '#EF4444' }]}>
          {result === 'correct' ? s.card.correct : s.card.wrong}
        </Text>
      )}

      {!result ? (
        <Pressable style={[styles.checkBtn, styles.checkBtnPrimary, { backgroundColor: colors.accent }]} onPress={handleCheck}>
          <Text style={styles.checkBtnText}>{s.card.check}</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.checkBtn, { backgroundColor: result === 'correct' ? '#22C55E' : '#EF4444' }]}
          onPress={() => onResult(result === 'correct')}
        >
          <Text style={styles.checkBtnText}>{s.card.next} →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 24, alignItems: 'center', minHeight: 280, gap: 16 },
  sourceText: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  input: { width: '100%', borderWidth: 2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  resultText: { fontSize: 18, fontWeight: '700' },
  correctLine: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  checkBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  checkBtnPrimary: { paddingHorizontal: 44, paddingVertical: 14, borderRadius: 24, alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  checkBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
