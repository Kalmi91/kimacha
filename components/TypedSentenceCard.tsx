import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, Keyboard } from 'react-native';
import { Text } from '@/components/KText';
import { speak, stop as stopSpeech } from '@/lib/speech';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { Card, brutalInputStyle } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import DockedAction, { DOCK_RESERVE, FAB_CLEARANCE } from '@/components/learn/DockedAction';
import SentenceGradeRow from '@/components/learn/SentenceGradeRow';
import { t } from '@/lib/i18n';
import { gradeSentenceAnswer, suggestedGrade } from '@/lib/pcicMatch';
import { stripSentencePunct } from '@/lib/sentenceCards';
import { answerInputProps } from '@/lib/inputProps';

interface Props {
  sourceSentence: string;
  targetSentence: string;
  onResult: (correct: boolean) => void;
  // Speech locale of the learned language, the right sentence is read aloud.
  speechLocale?: string;
  // The prompt sentence (in the source language) is spoken when the card opens,
  // like the word card's prompt.
  sourceSpeechLocale?: string;
  // Same accent rule as the word card (Settings -> Difficulty).
  strictAccents?: boolean;
  // the Check/Next bar is the same docked bar above the keyboard as on the
  // PCIC word card (DockedAction). The parent supplies the keyboard lift (useDockLift) and receives the
  // bar's height so that the 💬 button can sit above it; with default values it also renders on its own (in a test).
  dockLift?: number;
  dockH?: number;
  onDockHeight?: (h: number) => void;
  // The word card's "Didn't know" / "Knew it" button row after Check (overrides the displayed grade).
  gradeButtons?: boolean;
}

export default function TypedSentenceCard({
  sourceSentence,
  targetSentence,
  onResult,
  speechLocale,
  sourceSpeechLocale,
  strictAccents = false,
  dockLift = 0,
  dockH = DOCK_RESERVE,
  onDockHeight,
  gradeButtons = false,
}: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();

  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  // Check judged the answer wrong; the correct sentence is also shown after an override ("Knew it").
  const [missed, setMissed] = useState(false);

  useEffect(() => {
    if (sourceSpeechLocale) speak(sourceSentence, sourceSpeechLocale);
    return () => stopSpeech();
  }, [sourceSentence, sourceSpeechLocale]);

  const handleCheck = () => {
    Keyboard.dismiss();
    // Graded like the word card, on the sentence without its punctuation (the
    // tile card drops it too).
    // An answer without the pronoun is also correct ("Como en casa." instead of "Yo como en casa.").
    const grade = gradeSentenceAnswer(stripSentencePunct(typed), stripSentencePunct(targetSentence), strictAccents);
    const isCorrect = suggestedGrade(grade) === 'good';
    setResult(isCorrect ? 'correct' : 'wrong');
    setMissed(!isCorrect);
    // The correct sentence is ALWAYS spoken, after a good and after a wrong answer alike.
    if (speechLocale) {
      stopSpeech();
      speak(targetSentence, speechLocale);
    }
  };

  // The input and the feedback stay in the scrollable card; Check / Next is
  // a bar docked to the bottom of the screen (a direct child of the parent's KeyboardAvoidingView,
  // like on the PCIC word card), on the keyboard's top edge.
  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: FAB_CLEARANCE + dockH + dockLift }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text style={[styles.sourceText, { color: colors.text }]}>{sourceSentence}</Text>

          <TextInput
            style={[
              styles.input,
              { color: colors.text, borderColor: result === 'correct' ? colors.successFill : result === 'wrong' ? colors.danger : colors.tabIconDefault },
              g.brutal && brutalInputStyle(g),
              g.brutal && result && { borderColor: result === 'correct' ? colors.successFill : colors.danger },
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

          {result && (result === 'wrong' || missed) && <Text style={[styles.correctLine, { color: colors.success }]}>{targetSentence}</Text>}

          {/* the same correct / wrong indicator on every card (colour + shape + ✓/✗ + text). */}
          {result && <ResultBadge correct={result === 'correct'} label={result === 'correct' ? s.card.correct : s.card.wrong} />}

          {result && gradeButtons && <SentenceGradeRow colors={colors} result={result} onOverride={(ok) => setResult(ok ? 'correct' : 'wrong')} />}
        </Card>
      </ScrollView>

      <DockedAction
        label={result ? `${s.card.next} →` : `✓ ${s.card.check}`}
        onPress={result ? () => onResult(result === 'correct') : handleCheck}
        tone={result ? 'next' : 'check'}
        color={result ? (result === 'correct' ? colors.successFill : colors.danger) : undefined}
        bottom={dockLift}
        colors={colors}
        onHeight={onDockHeight}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 24, alignItems: 'center', minHeight: 280, gap: 16 },
  brutalCard: { padding: 24, alignItems: 'center', minHeight: 280, gap: 16 },
  scroll: { flex: 1 },
  sourceText: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  input: { width: '100%', borderWidth: 2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  correctLine: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
