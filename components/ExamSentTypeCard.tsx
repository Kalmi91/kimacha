import { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { strictAnswerMatch } from '@/lib/answerMatch';
import { type ExamItem } from '@/lib/examBuilder';
import { answerInputProps } from '@/lib/inputProps';

type SentTypeItem = Extract<ExamItem, { kind: 'sent_type' }>;

interface Props {
  item: SentTypeItem;
  onResult: (correct: boolean) => void;
}

export default function ExamSentTypeCard({ item, onResult }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const [text, setText] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);

  const handleCheck = () => {
    if (!text.trim()) return;
    // Strict (FB6): every word must match; case/punctuation/accents forgiven.
    const r = strictAnswerMatch(text, item.answer, { lang: item.dir[1] }) ? 'correct' : 'wrong';
    setResult(r);
    setTimeout(() => onResult(r === 'correct'), 1500);
  };

  const resultColor = result === 'correct' ? '#22C55E' : '#EF4444';
  const dirLabel = item.dir[0].toUpperCase() + ' → ' + item.dir[1].toUpperCase();

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.dirLabel, { color: colors.tabIconDefault }]}>{dirLabel}</Text>
      <Text style={[styles.prompt, { color: colors.text }]}>{item.prompt}</Text>

      <TextInput
        style={[styles.input, { color: colors.text, borderColor: result ? resultColor : colors.tabIconDefault }]}
        placeholder={s.card.typeTranslation}
        placeholderTextColor={colors.tabIconDefault}
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleCheck}
        editable={!result}
        autoFocus
        {...answerInputProps}
        multiline={false}
      />

      {result && (
        <View style={styles.resultSection}>
          <Text style={[styles.resultText, { color: resultColor }]}>
            {result === 'correct' ? s.card.correct : s.card.wrong}
          </Text>
          <Text style={[styles.correctAnswer, { color: colors.tint }]}>{item.answer}</Text>
        </View>
      )}

      {!result && (
        <Pressable
          style={[styles.checkBtn, { backgroundColor: colors.tint, opacity: text.trim() ? 1 : 0.4 }]}
          onPress={handleCheck}
          disabled={!text.trim()}
        >
          <Text style={styles.checkBtnText}>{s.card.check}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    minHeight: 280,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  dirLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  prompt: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 30,
  },
  input: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  resultSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  resultText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  correctAnswer: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  checkBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 160,
    alignItems: 'center',
  },
  checkBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
