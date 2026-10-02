import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import { Card, brutalInputStyle } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import { answerInputProps } from '@/lib/inputProps';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { gradePcicAnswer, gradeSentenceAnswer, suggestedGrade } from '@/lib/pcicMatch';
import { stripSentencePunct } from '@/lib/sentenceCards';
import { useTheme } from '@/lib/ThemeContext';
import ExamButton from './ExamButton';

// PLAN-vizsga A. szakasz 2. lépés (A5 c): szó- vagy mondat-beírás. Helyes válasz
// után NINCS visszajelzés, a vizsga megy tovább; hibás (vagy "nem tudom") válasz
// után mutatja a helyeset, és a "Next" lép tovább. Nincs hang: a vizsgában nincs hallás.
type Props = {
  prompt: string;
  /** Több jelentésű szó kis mondata; a `*jelölt*` rész kiemelve (PLAN-tobbjelentes). */
  hint?: string;
  answer: string;
  sentence: boolean;
  /** A tanult nyelv kódja, a placeholder feliratához. */
  targetLang: string;
  strictAccents: boolean;
  onDone: (correct: boolean) => void;
};

export default function ExamTypeCard({ prompt, hint, answer, sentence, targetLang, strictAccents, onDone }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const [typed, setTyped] = useState('');
  const [missed, setMissed] = useState(false);

  const check = () => {
    const grade = sentence
      ? gradeSentenceAnswer(stripSentencePunct(typed), stripSentencePunct(answer), strictAccents)
      : gradePcicAnswer(typed, answer, strictAccents);
    if (suggestedGrade(grade) === 'good') onDone(true);
    else setMissed(true);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
        <Text style={[styles.prompt, { color: colors.text }]}>{prompt}</Text>
        {hint ? (
          <Text testID="exam-hint" style={[styles.hint, { color: colors.textMuted }]}>
            {hint.split('*').map((part, i) =>
              i % 2 === 1 ? (
                <Text key={i} style={{ color: colors.text, fontWeight: fontWeight.bold }}>
                  {part}
                </Text>
              ) : (
                part
              ),
            )}
          </Text>
        ) : null}
        <TextInput
          testID="exam-input"
          style={[
            styles.input,
            { color: colors.text, borderColor: missed ? colors.danger : colors.border },
            g.brutal && brutalInputStyle(g),
          ]}
          placeholder={sentence ? s.card.typeSentence : s.card.typeIn(targetLang)}
          placeholderTextColor={colors.textMuted}
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={missed ? () => onDone(false) : check}
          editable={!missed}
          autoFocus
          {...answerInputProps}
        />
        {missed && (
          <View style={styles.reveal}>
            <ResultBadge correct={false} label={s.games.wrongFeedback} />
            <Text style={[styles.revealLabel, { color: colors.textMuted }]}>{s.exam.correctAnswer}</Text>
            <Text testID="exam-correct-answer" style={[styles.revealText, { color: colors.success }]}>
              {answer}
            </Text>
          </View>
        )}
      </Card>
      {missed ? (
        <ExamButton testID="exam-next" label={`${s.card.next} →`} onPress={() => onDone(false)} />
      ) : (
        <>
          <ExamButton testID="exam-check" label={s.card.check} onPress={check} disabled={typed.trim().length === 0} />
          <ExamButton testID="exam-dont-know" secondary label={s.exam.dontKnow} onPress={() => setMissed(true)} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  prompt: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  hint: { fontSize: fontSize.sm, textAlign: 'center' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
  },
  reveal: { gap: spacing.xs },
  revealLabel: { fontSize: fontSize.sm },
  revealText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
});
