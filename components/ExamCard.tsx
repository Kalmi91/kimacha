import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { levenshtein, normalizeAnswer } from '@/lib/levenshtein';
import { type ExamQuestion, type GapQuestion, type TranslateQuestion } from '@/data/exams';

interface Props {
  question: ExamQuestion;
  onResult: (correct: boolean) => void;
}

export default function ExamCard({ question, onResult }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  if (question.type === 'gap') {
    return <GapCard question={question} onResult={onResult} colors={colors} s={s} />;
  }
  return <TranslateCard question={question} onResult={onResult} colors={colors} s={s} />;
}

function GapCard({ question, onResult, colors, s }: { question: GapQuestion; onResult: (c: boolean) => void; colors: any; s: any }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    const correct = idx === question.correctIndex;
    setTimeout(() => onResult(correct), 1200);
  };

  const optionColors = ['#2563EB', '#1D4ED8', '#3B82F6', '#1E40AF'];

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.examTag, { color: colors.accent }]}>{s.exam.tag}</Text>
      <Text style={[styles.gapSentence, { color: colors.text }]}>{question.sentence}</Text>
      <View style={styles.optionsGrid}>
        {question.options.map((opt, idx) => {
          let bg = optionColors[idx];
          if (answered) {
            if (idx === question.correctIndex) bg = '#22C55E';
            else if (idx === selected) bg = '#EF4444';
            else bg = colors.tabIconDefault;
          }
          return (
            <Pressable
              key={idx}
              style={[styles.optionBtn, { backgroundColor: bg }]}
              onPress={() => handleSelect(idx)}
            >
              <Text style={styles.optionLetter}>{String.fromCharCode(65 + idx)})</Text>
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TranslateCard({ question, onResult, colors, s }: { question: TranslateQuestion; onResult: (c: boolean) => void; colors: any; s: any }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<'correct' | 'almost' | 'wrong' | null>(null);

  const handleCheck = () => {
    if (!text.trim()) return;
    const answer = normalizeAnswer(text);
    const correct = normalizeAnswer(question.target);
    const dist = levenshtein(answer, correct);

    const r = dist === 0 ? 'correct' : dist <= 2 ? 'almost' : 'wrong';
    setResult(r);
    setTimeout(() => onResult(r !== 'wrong'), 1500);
  };

  const resultColor = result === 'correct' ? '#22C55E' : result === 'almost' ? '#EAB308' : '#EF4444';

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.examTag, { color: colors.accent }]}>{s.exam.tag}</Text>
      <Text style={[styles.translateSource, { color: colors.text }]}>{question.source}</Text>

      <TextInput
        style={[styles.input, { color: colors.text, borderColor: result ? resultColor : colors.tabIconDefault }]}
        placeholder={s.card.typeTranslation}
        placeholderTextColor={colors.tabIconDefault}
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleCheck}
        editable={!result}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
      />

      {result && (
        <View style={styles.resultSection}>
          <Text style={[styles.resultText, { color: resultColor }]}>
            {result === 'correct' ? s.card.correct : result === 'almost' ? s.card.almostCorrect : s.card.wrong}
          </Text>
          <Text style={[styles.correctAnswer, { color: colors.tint }]}>{question.target}</Text>
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
  examTag: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  gapSentence: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 32,
  },
  optionsGrid: {
    width: '100%',
    gap: 10,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 10,
  },
  optionLetter: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '700',
  },
  optionText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  translateSource: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
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
    fontSize: 20,
    fontWeight: '600',
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
