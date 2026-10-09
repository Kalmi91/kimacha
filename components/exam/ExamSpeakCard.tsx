import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import { Card, brutalInputStyle } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import { useDockedAction } from '@/components/learn/DockSlot';
import { compareDictation, type DictationResult, type DictationWord } from '@/lib/exam/dictation';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import ExamButton from './ExamButton';

// oral item with the keyboard's microphone.
// The learner says the sentence with the microphone button of the text field's keyboard, the
// dictated text goes into the field; the app compares it to the expected sentence
// (lib/exam/dictation.ts). There is no own speech recogniser, microphone permission or native
// code. After a correct sentence there is NO feedback (the exam moves on); after a wrong one the
// differing words are highlighted on both sides and "Next" moves on.
// Reusable: the oral part of the mock exam and the later speaking practice both use this card.
type Props = {
  /** What the learner sees: in `translate` mode the source-language sentence, in `repeat` mode the target-language one. */
  prompt: string;
  /** The expected target-language sentence. */
  expected: string;
  /** `translate` = translate it and say it; `repeat` = read aloud the sentence you see. */
  mode: 'translate' | 'repeat';
  /** Code of the learned language: for the caption and for the Spanish pronoun-drop rule. */
  targetLang: string;
  /** The "Accents count" setting. */
  strictAccents: boolean;
  onDone: (correct: boolean) => void;
};

function Words({ words, flag, base, mark, testID }: { words: DictationWord[]; flag: string; base: string; mark: string; testID: string }) {
  return (
    <Text testID={testID} style={[styles.revealText, { color: base }]}>
      {words.map((w, i) => (
        <Text key={i} testID={w.ok ? undefined : flag} style={w.ok ? undefined : [styles.diff, { color: mark }]}>
          {i > 0 ? ' ' : ''}
          {w.text}
        </Text>
      ))}
    </Text>
  );
}

export default function ExamSpeakCard({ prompt, expected, mode, targetLang, strictAccents, onDone }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<DictationResult | null>(null);

  const check = () => {
    const r = compareDictation(typed, expected, { strictAccents, subjectDrop: targetLang === 'es' });
    if (r.correct) onDone(true);
    else setResult(r);
  };
  const missed = result !== null;

  // Check (and Next after a wrong answer) is a bar docked above the keyboard, as on the word card (DockSlot).
  const { docked, padBottom } = useDockedAction(
    missed
      ? { label: `${s.card.next} →`, tone: 'next', testID: 'exam-next', onPress: () => onDone(false) }
      : { label: `✓ ${s.card.check}`, tone: 'check', testID: 'exam-check', disabled: typed.trim().length === 0, onPress: check }
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
        <Text testID="exam-speak-mode" style={[styles.label, { color: colors.textMuted }]}>
          {mode === 'translate' ? s.exam.speakTranslate(targetLang) : s.exam.speakRepeat}
        </Text>
        <Text testID="exam-speak-prompt" style={[styles.prompt, { color: colors.text }]}>
          {prompt}
        </Text>
        {/* Intentionally no answerInputProps: it would turn off the suggestion bar, and with it could
            also hide the keyboard's microphone button; dictation needs the stock keyboard. */}
        <TextInput
          testID="exam-speak-input"
          style={[
            styles.input,
            { color: colors.text, borderColor: missed ? colors.danger : colors.border },
            g.brutal && brutalInputStyle(g),
          ]}
          placeholder={s.exam.speakPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={typed}
          onChangeText={setTyped}
          editable={!missed}
          multiline
          autoFocus
        />
        {!missed && (
          <Text testID="exam-speak-hint" style={[styles.hint, { color: colors.textMuted }]}>
            {s.exam.speakHint}
          </Text>
        )}
        {result && (
          <View style={styles.reveal}>
            <ResultBadge correct={false} label={s.games.wrongFeedback} />
            <Text style={[styles.revealLabel, { color: colors.textMuted }]}>{s.exam.speakYouSaid}</Text>
            <Words testID="exam-speak-heard" words={result.heard} flag="exam-speak-extra" base={colors.text} mark={colors.danger} />
            <Text style={[styles.revealLabel, { color: colors.textMuted }]}>{s.exam.correctAnswer}</Text>
            <Words testID="exam-speak-correct" words={result.expected} flag="exam-speak-missing" base={colors.success} mark={colors.danger} />
          </View>
        )}
      </Card>
      {missed ? (
        docked ? null : <ExamButton testID="exam-next" label={`${s.card.next} →`} onPress={() => onDone(false)} />
      ) : (
        <>
          {docked ? null : <ExamButton testID="exam-check" label={s.card.check} onPress={check} disabled={typed.trim().length === 0} />}
          <ExamButton testID="exam-dont-know" secondary label={s.exam.dontKnow} onPress={() => setResult(compareDictation('', expected, { strictAccents, subjectDrop: false }))} />
        </>
      )}
      {docked ? <View style={{ height: padBottom }} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  label: { fontSize: fontSize.sm, textAlign: 'center' },
  prompt: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  hint: { fontSize: fontSize.sm, textAlign: 'center' },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    textAlignVertical: 'top',
  },
  reveal: { gap: spacing.xs },
  revealLabel: { fontSize: fontSize.sm },
  revealText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  diff: { fontWeight: fontWeight.bold, textDecorationLine: 'underline' },
});
