import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, Keyboard, View } from 'react-native';
import { Text } from '@/components/KText';
import { speak, speakAuto, stop as stopSpeech } from '@/lib/speech';
import { speechBusy, useSpeechStatus } from '@/lib/speechStatus';
import type { VoiceGender } from '@/lib/neuralVoices';
import Colors from '@/constants/Colors';
import { ON_FILL } from '@/constants/GrammarPalettes';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalBox, Card } from '@/components/grammar/Brutal';
import { themedInputStyle } from '@/components/grammar/Themed';
import ResultBadge from '@/components/ResultBadge';
import DockedAction, { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { dockScrollInsets } from '@/components/learn/dockScrollInsets';
import SentenceGradeRow from '@/components/learn/SentenceGradeRow';
import { t } from '@/lib/i18n';
import { gradeSentenceAnswer, suggestedGrade, withoutLeadingSubjectPronoun } from '@/lib/pcicMatch';
import { charDiff } from '@/lib/charDiff';
import { useDiffStyles } from '@/lib/useDiffStyles';
import { stripSentencePunct } from '@/lib/sentenceCards';
import { answerInputProps } from '@/lib/inputProps';
import { keyboardDismissOnDrag } from '@/lib/keyboardTap';
import HintedSentence from '@/components/HintedSentence';
import SpeakButton from '@/components/SpeakButton';
import type { HintPiece } from '@/lib/sentenceHint';

interface Props {
  sourceSentence: string;
  targetSentence: string;
  // `typed` is the answer as typed (the Sentences tab credits its words one by one).
  onResult: (correct: boolean, typed: string) => void;
  // Speech locale of the learned language, the right sentence is read aloud.
  speechLocale?: string;
  // The prompt sentence (in the source language) is spoken when the card opens,
  // like the word card's prompt.
  sourceSpeechLocale?: string;
  // Same accent rule as the word card (Settings -> Difficulty).
  strictAccents?: boolean;
  // Code of the language the sentence is written in: Hungarian accents are never forgiven (lib/pcicMatch.ts).
  lang?: string;
  // the Check/Next bar is the same docked bar above the keyboard as on the
  // PCIC word card (DockedAction). The parent supplies the keyboard lift (useDockLift) and receives the
  // bar's height so that the 💬 button can sit above it; with default values it also renders on its own (in a test).
  dockLift?: number;
  // The keyboard is open: the scroller keeps its full height (see dockScrollInsets).
  keyboardOpen?: boolean;
  dockH?: number;
  onDockHeight?: (h: number) => void;
  // The word card's "Didn't know" / "Knew it" button row after Check (overrides the displayed grade).
  gradeButtons?: boolean;
  // Tap-a-word hints on the prompt sentence (Sentences tab, beta sentenceHint); see EasySentenceCard.
  sourceHints?: HintPiece[] | null;
  onSourceHint?: (ids: string[]) => void;
  // Listen-and-type step (Sentences tab, rung 2): the TARGET sentence is heard when the card opens and a big
  // 🔊 button replaces the prompt sentence, which (with its hints) is shown only once the answer is checked.
  listening?: boolean;
  // Sentences tab (FB569): no sentence is spoken by itself, only on a press of the 🔊 button (before Check the prompt, after it
  // the right sentence); the listening step still plays by itself. Off (default) = the Learn tab's behaviour: the prompt is
  // read when the card opens and the right sentence after Check.
  speakOnPress?: boolean;
  // Audio round B: every sentence this card speaks (target and source side) is spoken by this speaker, the sex of the
  // card's word voice (lib/cardSpeaker.ts), so the sentence pack finds its recording.
  speakerGender?: VoiceGender;
}

type Seg = { text: string; kind: 'ok' | 'wrong' | 'missing' };

// consecutive characters of the same kind become one segment (fewer nodes, one testID per mark).
function segments(chars: ReturnType<typeof charDiff>): Seg[] {
  const out: Seg[] = [];
  for (const d of chars) {
    const kind = d.missing ? 'missing' : d.wrong ? 'wrong' : 'ok';
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += d.ch;
    else out.push({ text: d.ch, kind });
  }
  return out;
}

// Where a wrong answer differs: `typed` = the learner's answer (wrong letters, and the dropped ones as
// `missing`), `correct` = the correct sentence (kind 'wrong' = the part the answer lacks). Case is always
// forgiven; accents follow the card's check (strictAccents). The subject pronoun is optional, so an
// answer without it is compared to the sentence without it and the pronoun is never flagged.
function sentenceDiff(typed: string, target: string, strictAccents: boolean) {
  const fold = { case: true, accents: !strictAccents };
  const short = withoutLeadingSubjectPronoun(target);
  const flaws = (ref: string) => charDiff(typed, ref, fold).filter((d) => d.wrong).length;
  const ref = short !== null && flaws(short) < flaws(target) ? short : target;
  const full = target.trim();
  const head = ref === target ? '' : full.slice(0, full.length - ref.length);
  return {
    typed: segments(charDiff(typed, ref, fold)),
    correct: segments([...[...head].map((ch) => ({ ch, wrong: false })), ...charDiff(ref, typed, fold).filter((d) => !d.missing)]),
  };
}

export default function TypedSentenceCard({
  sourceSentence,
  targetSentence,
  onResult,
  speechLocale,
  sourceSpeechLocale,
  strictAccents = false,
  lang,
  dockLift = 0,
  keyboardOpen = false,
  dockH = DOCK_RESERVE,
  onDockHeight,
  gradeButtons = false,
  sourceHints,
  onSourceHint,
  listening = false,
  speakOnPress = false,
  speakerGender,
}: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const diff = useDiffStyles();
  const s = t();
  const audio = useSpeechStatus();
  const audioActive = audio.text === targetSentence && speechBusy(audio.phase);
  const speakerIcon = audioActive ? (audio.phase === 'loading' ? '⏳' : '🔉') : '🔊';

  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  // Check judged the answer wrong; the correct sentence is also shown after an override ("Knew it").
  const [missed, setMissed] = useState(false);

  const say = (text: string, locale: string) => (speakerGender ? speak(text, locale, { gender: speakerGender }) : speak(text, locale));
  const sayAuto = (text: string, locale: string) => (speakerGender ? speakAuto(text, locale, { gender: speakerGender }) : speakAuto(text, locale));

  // A new sentence reads itself aloud, except right after the app opens (lib/speech.ts speakAuto).
  useEffect(() => {
    if (listening) {
      if (speechLocale) sayAuto(targetSentence, speechLocale);
    } else if (sourceSpeechLocale && !speakOnPress) sayAuto(sourceSentence, sourceSpeechLocale);
    return () => stopSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, sourceSentence, sourceSpeechLocale, targetSentence, speechLocale]);

  const replay = () => {
    if (!speechLocale) return;
    stopSpeech();
    say(targetSentence, speechLocale);
  };

  const handleCheck = () => {
    Keyboard.dismiss();
    // Graded like the word card, on the sentence without its punctuation (the
    // tile card drops it too).
    // An answer without the pronoun is also correct ("Como en casa." instead of "Yo como en casa.").
    const grade = gradeSentenceAnswer(stripSentencePunct(typed), stripSentencePunct(targetSentence), strictAccents, lang);
    const isCorrect = suggestedGrade(grade) === 'good';
    setResult(isCorrect ? 'correct' : 'wrong');
    setMissed(!isCorrect);
    // The correct sentence is ALWAYS spoken, after a good and after a wrong answer alike (not with speakOnPress, except when listening).
    if (speechLocale && (listening || !speakOnPress)) {
      stopSpeech();
      say(targetSentence, speechLocale);
    }
  };

  // speakOnPress: the 🔊 button speaks what is in front of the learner: the prompt, and once checked the right sentence.
  const speakShown = () => {
    stopSpeech();
    if (result || missed) {
      if (speechLocale) say(targetSentence, speechLocale);
    } else if (sourceSpeechLocale) say(sourceSentence, sourceSpeechLocale);
  };

  const dockInsets = dockScrollInsets(dockH, dockLift, keyboardOpen);
  const scroller = useRef<ScrollView>(null);

  // The correct sentence is shown after a miss; with something typed, it comes with the answer
  // marked up so the learner sees WHERE the mistake is (an empty answer has nothing to compare).
  const showCorrect = !!result && (result === 'wrong' || missed);
  const cmp = showCorrect && typed.trim().length > 0 ? sentenceDiff(typed, targetSentence, strictAccents) : null;
  // A listening step shows the prompt once the answer was checked (it stays after an edit that clears the verdict).
  const revealed = !listening || !!result || missed;

  // The input and the feedback stay in the scrollable card; Check / Next is
  // a bar docked to the bottom of the screen (a direct child of the parent's KeyboardAvoidingView,
  // like on the PCIC word card), on the keyboard's top edge.
  return (
    <>
      <ScrollView
        ref={scroller}
        style={[styles.scroll, { marginBottom: dockInsets.marginBottom }]}
        contentContainerStyle={{ paddingBottom: dockInsets.paddingBottom }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={keyboardDismissOnDrag()}
        // The answer field is the card's last row: with the keyboard open and a tall card above it, it sat behind the
        // docked bar and the learner typed blind. The bottom padding above keeps it just over the bar.
        onContentSizeChange={() => {
          if (keyboardOpen) scroller.current?.scrollToEnd({ animated: true });
        }}
      >
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          {listening && (
            <>
              {g.brutal ? (
                <BrutalBox testID="sentence-listen-play" accessibilityLabel={s.sentenceTab.listenPlay} fill="a" offset={3} onPress={replay} boxStyle={styles.listenBrutal}>
                  <Text style={styles.listenIcon}>{speakerIcon}</Text>
                </BrutalBox>
              ) : (
                <Pressable testID="sentence-listen-play" accessibilityRole="button" accessibilityLabel={s.sentenceTab.listenPlay} accessibilityState={{ busy: audioActive }} style={[styles.listenBtn, { backgroundColor: colors.accent }]} onPress={replay}>
                  <Text style={styles.listenIcon}>{speakerIcon}</Text>
                </Pressable>
              )}
              {!result && <Text style={[styles.listenHint, { color: colors.tabIconDefault }]}>{s.sentenceTab.listenTypeHint}</Text>}
            </>
          )}
          {revealed && <HintedSentence text={sourceSentence} pieces={sourceHints} onHint={onSourceHint} style={[styles.sourceText, { color: colors.text }]} />}
          {speakOnPress && !listening && <SpeakButton testID="sentence-speak" onPress={speakShown} style={styles.speakBtn} iconStyle={styles.speakIcon} brutalStyle={styles.speakBrutal} />}

          <TextInput
            style={[
              styles.input,
              { color: colors.text, borderColor: result === 'correct' ? colors.successFill : result === 'wrong' ? colors.danger : colors.tabIconDefault },
              themedInputStyle(g),
              g.brutal && result && { borderColor: result === 'correct' ? colors.successFill : colors.danger },
              // FB540: a right sentence turns the field green (dark text on the fill, as on the result badge).
              result === 'correct' && { backgroundColor: colors.successFill, color: ON_FILL },
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
            onSubmitEditing={result ? () => onResult(result === 'correct', typed) : handleCheck}
            editable={result !== 'correct'}
            autoFocus
            {...answerInputProps}
          />

          {showCorrect && !cmp && <Text style={[styles.correctLine, { color: colors.success }]}>{targetSentence}</Text>}
          {cmp && (
            <View style={styles.compare}>
              <Text style={[styles.compareLabel, { color: colors.tabIconDefault }]}>{s.grammar.yourAnswer}</Text>
              <Text testID="sentence-diff-typed" style={[styles.correctLine, { color: colors.text }]}>
                {cmp.typed.map((sg, i) => (
                  <Text key={i} testID={sg.kind === 'ok' ? undefined : `sentence-diff-${sg.kind}`} style={sg.kind === 'ok' ? undefined : diff[sg.kind]}>{sg.text}</Text>
                ))}
              </Text>
              <Text style={[styles.compareLabel, { color: colors.tabIconDefault }]}>{s.grammar.correctAnswer}</Text>
              <Text testID="sentence-diff-correct" style={[styles.correctLine, { color: colors.success }]}>
                {cmp.correct.map((sg, i) => (
                  <Text key={i} testID={sg.kind === 'ok' ? undefined : 'sentence-diff-correct-mark'} style={sg.kind === 'ok' ? undefined : diff.missing}>{sg.text}</Text>
                ))}
              </Text>
            </View>
          )}

          {/* the same correct / wrong indicator on every card (colour + shape + ✓/✗ + text). */}
          {result && <ResultBadge correct={result === 'correct'} label={result === 'correct' ? s.card.correct : s.card.wrong} align="center" />}

          {result && gradeButtons && <SentenceGradeRow colors={colors} result={result} onOverride={(ok) => setResult(ok ? 'correct' : 'wrong')} />}
        </Card>
      </ScrollView>

      <DockedAction
        label={result ? `${s.card.next} →` : `✓ ${s.card.check}`}
        onPress={result ? () => onResult(result === 'correct', typed) : handleCheck}
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
  listenBtn: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  listenBrutal: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  listenIcon: { fontSize: 44 },
  speakBtn: { alignSelf: 'center', padding: 4 },
  speakIcon: { fontSize: 22 },
  speakBrutal: { alignSelf: 'center' },
  listenHint: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  input: { width: '100%', borderWidth: 2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  correctLine: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  compare: { alignItems: 'center', gap: 2 },
  compareLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
});
