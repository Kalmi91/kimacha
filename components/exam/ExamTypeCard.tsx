import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import { themedInputStyle } from '@/components/grammar/Themed';
import ResultBadge from '@/components/ResultBadge';
import { answerInputProps } from '@/lib/inputProps';
import { useDockedAction } from '@/components/learn/DockSlot';
import { useFocusOnNewCard } from '@/lib/learn/useFocusOnNewCard';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { gradePcicAnswer, gradeSentenceAnswer, suggestedGrade } from '@/lib/pcicMatch';
import { strictAnswerMatch } from '@/lib/answerMatch';
import { stripSentencePunct } from '@/lib/sentenceCards';
import { useTheme } from '@/lib/ThemeContext';
import ExamButton from './ExamButton';

// word or sentence typing. After a correct answer there is NO feedback, the exam moves on; after a
// wrong (or "I don't know") answer it shows the correct one, and "Next" moves on. No sound: the
// exam has no listening.
type Props = {
  prompt: string;
  /** The level test's form task on a non-verb table: the table's title above, and the label of the cell under it. */
  heading?: string;
  label?: string;
  /** Extra space under the buttons (a floating button of the screen must not sit on them). */
  bottomPad?: number;
  /** A short sentence for a word with several meanings; the `*marked*` part is highlighted. */
  hint?: string;
  answer: string;
  /** Further accepted answers (e.g. for the sentence transformation of the grammar test); after a wrong answer `answer` is shown. */
  accept?: string[];
  sentence: boolean;
  /** Code of the learned language, for the placeholder caption. */
  targetLang: string;
  strictAccents: boolean;
  /** German only: the umlaut and the ß are the thing asked (a grammar form), so dropping the dots is wrong even while accents are forgiven. */
  keepUmlauts?: boolean;
  /** The result is handed over at once (`onDone(correct)`), without the card's own reveal and Next: for a screen that shows the answer itself. */
  instant?: boolean;
  /** `given`: what was typed (absent for "I don't know"). */
  onDone: (correct: boolean, given?: string) => void;
};

export default function ExamTypeCard({ prompt, heading, label, bottomPad, hint, answer, accept, sentence, targetLang, strictAccents, keepUmlauts = false, instant = false, onDone }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const [typed, setTyped] = useState('');
  const [missed, setMissed] = useState(false);
  // the level tests: with the keyboard open the buttons under the field (I don't know) can sit behind the docked Check bar,
  // so the body scrolls to its end when the keyboard comes up
  const scrollRef = useRef<ScrollView>(null);
  // the keyboard opens by itself, with the word card's single delayed focus (plain autoFocus left Gboard up with a dead field)
  const inputRef = useRef<TextInput>(null);
  useFocusOnNewCard(inputRef, true, prompt);
  useEffect(() => {
    if (!instant) return;
    const sub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    });
    return () => sub.remove();
  }, [instant]);

  const check = () => {
    const ok = [answer, ...(accept ?? [])].some((target) => {
      if (keepUmlauts && targetLang === 'de') return strictAnswerMatch(typed, target, { lang: 'de', keepUmlauts: true, strictAccents });
      const grade = sentence
        ? gradeSentenceAnswer(stripSentencePunct(typed), stripSentencePunct(target), strictAccents, targetLang)
        : gradePcicAnswer(typed, target, strictAccents, targetLang);
      return suggestedGrade(grade) === 'good';
    });
    if (ok || instant) onDone(ok, typed);
    else setMissed(true);
  };
  const giveUp = () => (instant ? onDone(false) : setMissed(true));

  // Check (and Next after a wrong answer) is a bar docked above the keyboard, as on the word card (DockSlot).
  const { docked, padBottom } = useDockedAction(
    missed
      ? { label: `${s.card.next} →`, tone: 'next', testID: 'exam-next', onPress: () => onDone(false, typed) }
      : { label: `✓ ${s.card.check}`, tone: 'check', testID: 'exam-check', disabled: typed.trim().length === 0, onPress: check }
  );

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={[styles.scroll, bottomPad ? { paddingBottom: bottomPad } : null]} keyboardShouldPersistTaps="handled">
      <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
        {heading ? (
          <Text testID="exam-heading" style={[styles.caption, { color: colors.textMuted }]}>
            {heading}
          </Text>
        ) : null}
        {label ? (
          <Text testID="exam-label" style={[styles.caption, { color: colors.textMuted }]}>
            {label}
          </Text>
        ) : null}
        <Text testID="exam-prompt" style={[styles.prompt, { color: colors.text }]}>{prompt}</Text>
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
          ref={inputRef}
          testID="exam-input"
          style={[
            styles.input,
            { color: colors.text, borderColor: missed ? colors.danger : colors.border },
            themedInputStyle(g),
          ]}
          placeholder={sentence ? s.card.typeSentence : s.card.typeIn(targetLang)}
          placeholderTextColor={colors.textMuted}
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={missed ? () => onDone(false, typed) : check}
          editable={!missed}
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
        docked ? null : <ExamButton testID="exam-next" label={`${s.card.next} →`} onPress={() => onDone(false, typed)} />
      ) : (
        <>
          {docked ? null : <ExamButton testID="exam-check" label={s.card.check} onPress={check} disabled={typed.trim().length === 0} />}
          <ExamButton testID="exam-dont-know" secondary label={s.exam.dontKnow} onPress={giveUp} />
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
  caption: { fontSize: fontSize.sm, textAlign: 'center' },
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
