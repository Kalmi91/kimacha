import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, motion, radius, spacing, tapTarget } from '@/constants/Theme';
import { Card, textOnFill } from '@/components/grammar/Brutal';
import { ActionButton, BackButton, ProgressBar, themedEdgeStyle, themedInputStyle } from '@/components/grammar/Themed';
import { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';
import GameFrame from '@/components/practice/GameFrame';
import SpeakButton from '@/components/SpeakButton';
import type { PcicTarget } from '@/data/pcic';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { answerInputProps } from '@/lib/inputProps';
import type { Lang } from '@/lib/languagePair';
import { speechLang } from '@/lib/languages';
import type { SpokenMatch } from '@/lib/practice/situationMatch';
import { speak, stopSpeaking } from '@/lib/speech';
import { isMicOffError, isNothingHeardError, useRecognizer } from '@/lib/speechRecognition';
import { TOP_ROW, upperFooterMax } from '@/lib/speech/layout';
import { MAX_TRIES, answerTurn, bubbleOf, judgeAnswer, progressOf, skipTurn, speakable, turnById, type AnswerMode, type SpeechStory, type StoryRun } from '@/lib/speech/stories';
import { useTheme } from '@/lib/ThemeContext';

// The story itself: the character's lines as chat bubbles, the learner's answers as bubbles on the other side, and below, docked
// where it never needs scrolling to, what to do now (say it or type it), what was heard when it was wrong, the model after Help
// or two wrong tries. The answer is checked in the background (lib/practice/situationMatch.ts, `*` = a free word): a right one
// shows its bubble at once and, after motion.feedback, her reaction and the next line (one bubble) come by themselves and are read
// aloud. The run (lib/speech/stories.ts) is already one turn on while that bubble waits, so the screen keeps its own `shown`.
// Leaving keeps the run. Help (or two wrong tries) shows every line that can be said on this turn.
// The docked footer is two parts: a scrollable upper one (what was heard, the ask, the hint) that is capped to the room that is
// left (lib/speech/layout.ts), and a fixed lower one (input and Check, or the mic; Next; the links) that is always on screen.

interface Props {
  story: SpeechStory;
  run: StoryRun;
  target: PcicTarget;
  source: Lang;
  /** The accents setting of the app: it counts for typed answers only (a recognizer writes no accents). */
  strictAccents: boolean;
  /** The device has a speech recognizer. */
  micOk: boolean;
  /** The run was just started: its first line is read aloud. A resumed run is silent until 🔊 is pressed. */
  fresh: boolean;
  onRun: (next: StoryRun) => void;
  onMode: (mode: AnswerMode) => void;
  onBack: () => void;
  /** The last answer is in and its bubble has been seen. */
  onFinish: () => void;
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export default function SpeechPlay({ story, run, target, source, strictAccents, micOk, fresh, onRun, onMode, onBack, onFinish }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const sx = s.speechTab;
  const lang = speechLang(target);
  // The turns of the path whose line is on screen are 0..shown.
  const [shown, setShown] = useState(Math.min(run.answers.length, run.path.length - 1));
  const [translated, setTranslated] = useState<ReadonlySet<number>>(new Set());
  // the turn Help was pressed on
  const [helpAt, setHelpAt] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [heard, setHeard] = useState<{ text: string; match: SpokenMatch; typed: boolean } | null>(null);
  // the answer is in and its bubble is on screen, the next line is on its way
  const waiting = shown < run.answers.length;
  const turn = turnById(story, run.path[shown]) ?? story.turns[0];
  const progress = progressOf(story, run);
  const hintOn = !waiting && (helpAt === shown || run.tries >= MAX_TRIES);
  // the height of the fixed lower part of the footer, and what is left for the scrollable upper part
  const { height: windowH } = useWindowDimensions();
  const { dockLift, kbHeight } = useDockLift();
  const [fixedH, setFixedH] = useState(DOCK_RESERVE);
  // the measured height of the frame (below the navigator header, above the tab bar) and of the back / progress row
  const [frameH, setFrameH] = useState(0);
  const [topH, setTopH] = useState(TOP_ROW);
  const upper = useRef<ScrollView>(null);

  // What was said (the recognizer's final result) or typed is judged.
  const submit = (text: string, byTyping: boolean) => {
    const said = text.trim();
    if (waiting || run.done || !said) return;
    const { branch, match } = judgeAnswer(turn, said, { lang: story.target, strictAccents: byTyping && strictAccents });
    if (branch !== null) {
      setHeard(null);
      setTyped('');
      setHelpAt(null);
    } else {
      setHeard({ text: said, match, typed: byTyping });
    }
    onRun(answerTurn(run, story, { branch, text: said }));
  };
  const rec = useRecognizer(lang, (text) => submit(text, false));
  const { abort } = rec;
  // A typed answer closes the microphone: a result that is still on its way must not land on the next turn.
  const submitTyped = (text: string) => {
    abort();
    submit(text, true);
  };
  const skip = () => {
    abort();
    setHeard(null);
    setTyped('');
    setHelpAt(null);
    onRun(skipTurn(run, story));
  };
  const switchMode = (mode: AnswerMode) => {
    abort();
    rec.reset();
    setHeard(null);
    onMode(mode);
  };
  // the read-aloud on a bubble closes the microphone first: the phone must not hear itself (and the learner lose a try)
  const say = (text: string) => {
    abort();
    stopSpeaking();
    speak(text, lang);
  };

  // A new turn closes the microphone; leaving the tab (it stays mounted) stops the read-aloud and the microphone.
  useEffect(() => {
    abort();
  }, [run.answers.length, abort]);
  useFocusEffect(
    useCallback(
      () => () => {
        stopSpeaking();
        abort();
      },
      [abort],
    ),
  );
  useEffect(() => () => stopSpeaking(), []);

  // the first line of a run that was just started is read aloud
  const readFirst = useRef(fresh);
  useEffect(() => {
    if (readFirst.current) speak(story.turns[0][story.target], lang);
  }, [story, lang]);

  // after a right answer (or Next) the next line comes by itself; after the last one the story is done
  const finishRef = useRef(onFinish);
  const runRef = useRef(run);
  useEffect(() => {
    finishRef.current = onFinish;
    runRef.current = run;
  });
  useEffect(() => {
    if (!waiting) return;
    const id = setTimeout(() => {
      if (run.done) {
        finishRef.current();
        return;
      }
      const at = runRef.current.answers.length;
      setShown(at);
      speak(bubbleOf(story, runRef.current, at, story.target), lang);
    }, motion.feedback);
    return () => clearTimeout(id);
  }, [waiting, run.answers.length, run.done, story, lang]);

  // a new result or a new turn shows the upper part from its top (the red words first)
  useEffect(() => {
    upper.current?.scrollTo({ y: 0, animated: false });
  }, [heard, shown]);

  const micOff = rec.error !== null && isMicOffError(rec.error);
  const voice = run.mode === 'voice' && micOk && !micOff;
  const meText = g.brutal ? textOnFill(g, 'b') : colors.onTint;
  const mark = (right: boolean) => ({ color: right ? colors.success : colors.danger });
  // With the keyboard open the fixed part is just the input row and one link row: Next is a link then, in the place of Help
  const keyboardOpen = kbHeight > 0;
  const canSkip = !waiting && run.tries >= MAX_TRIES;

  const upperPart = (
    <>
      {!waiting && heard && (
        <View testID="speech-result" style={[styles.result, themedEdgeStyle(g), { borderColor: colors.danger, backgroundColor: colors.card }]}>
          <Text testID="speech-heard" style={[styles.resultText, { color: colors.text }]}>{heard.typed ? sx.wrote(heard.text) : sx.heard(heard.text)}</Text>
          <View style={styles.said}>
            {heard.match.words.map((w, n) => (
              <Text key={n} testID={w.right ? 'speech-said-right' : 'speech-said-wrong'} style={[styles.saidWord, mark(w.right), !w.right && styles.struck]}>
                {w.word}
              </Text>
            ))}
          </View>
          <Text style={[styles.resultText, { color: colors.textMuted }]}>{sx.missingWord}</Text>
        </View>
      )}
      <Text style={[styles.yourTurn, { color: colors.textMuted }]}>{sx.yourTurn}</Text>
      <Text testID="speech-ask" style={[styles.ask, { color: colors.text }]}>{sx.ask(story.speaker)}</Text>
      {hintOn && (
        <View testID="speech-hint" style={[styles.hint, themedEdgeStyle(g), { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.hintTitle, { color: colors.textMuted }]}>{`💡 ${sx.canSay}`}</Text>
          {turn.branches.flatMap((b, j) =>
            b.say.map((line, k) => (
              <View key={`${j}-${k}`} style={styles.hintRow}>
                <SpeakButton
                  testID={`speech-hint-listen-${j}-${k}`}
                  accessibilityLabel={sx.listen}
                  onPress={() => say(speakable(line[story.target]))}
                  style={styles.tool}
                  iconStyle={styles.toolIcon}
                />
                <View style={styles.hintTexts}>
                  <Text testID={`speech-hint-line-${j}-${k}`} style={[styles.hintText, { color: colors.text }]}>{line[story.target]}</Text>
                  <Text style={[styles.hintTranslation, { color: colors.textMuted }]}>{line[source]}</Text>
                </View>
              </View>
            )),
          )}
        </View>
      )}
      {rec.error && !waiting && (
        <Text testID="speech-mic-error" style={[styles.note, { color: colors.textMuted }]}>
          {micOff ? sx.micOff : isNothingHeardError(rec.error) ? sx.micMiss : sx.micRetry}
        </Text>
      )}
    </>
  );

  const lowerPart = (
    <>
      {voice ? (
        <View style={styles.micBox}>
          <Pressable
            testID="speech-mic"
            accessibilityRole="button"
            accessibilityLabel={rec.listening ? sx.listening : sx.pressToSpeak}
            disabled={waiting}
            onPress={() => {
              if (rec.listening) rec.stop();
              else {
                stopSpeaking();
                setHeard(null);
                void rec.start();
              }
            }}
            style={[styles.mic, { backgroundColor: rec.listening ? colors.danger : colors.tint }]}
          >
            <Text style={styles.micIcon}>🎤</Text>
          </Pressable>
          <Text style={[styles.micLabel, { color: colors.text }]}>{rec.listening ? sx.listening : sx.pressToSpeak}</Text>
        </View>
      ) : (
        <View style={styles.typeRow}>
          <TextInput
            testID="speech-type-input"
            style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault, backgroundColor: colors.card }, themedInputStyle(g)]}
            placeholder={s.card.typeIn(target)}
            placeholderTextColor={colors.tabIconDefault}
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={() => submitTyped(typed)}
            submitBehavior="submit"
            {...answerInputProps}
          />
          <ActionButton
            testID="speech-check"
            label={`✓ ${s.card.check}`}
            onPress={() => submitTyped(typed)}
            disabled={waiting || !typed.trim()}
            classicStyle={[styles.button, styles.classicButton, { backgroundColor: colors.tint, opacity: waiting || !typed.trim() ? 0.4 : 1 }]}
            classicTextStyle={[styles.classicButtonText, { color: colors.onTint }]}
          />
        </View>
      )}
      {canSkip && !keyboardOpen && (
        <ActionButton
          testID="speech-skip"
          label={`${s.card.next} →`}
          onPress={skip}
          fill="paper"
          brutalStyle={styles.skip}
          classicStyle={[styles.skip, styles.classicButton, { borderWidth: 1, borderColor: colors.tint }]}
          classicTextStyle={[styles.classicButtonText, { color: colors.tint }]}
        />
      )}
      <View style={styles.links}>
        {canSkip && keyboardOpen ? (
          <Pressable testID="speech-skip-link" accessibilityRole="button" onPress={skip} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.text }]}>{`${s.card.next} →`}</Text>
          </Pressable>
        ) : !hintOn ? (
          <Pressable testID="speech-help" accessibilityRole="button" onPress={() => setHelpAt(shown)} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.text }]}>{sx.help}</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {micOk && (
          <Pressable testID="speech-mode-toggle" accessibilityRole="button" onPress={() => switchMode(voice ? 'type' : 'voice')} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.text }]}>{voice ? sx.typeInstead : sx.sayInstead}</Text>
          </Pressable>
        )}
      </View>
    </>
  );

  const footer = (
    <>
      <ScrollView
        ref={upper}
        testID="speech-footer-scroll"
        style={[styles.upper, { maxHeight: upperFooterMax({ room: (frameH > 0 ? frameH : windowH) - dockLift, windowH, kbHeight, topH, fixedH, voice }) }]}
        keyboardShouldPersistTaps="handled"
      >
        {upperPart}
      </ScrollView>
      <View testID="speech-footer-fixed" onLayout={(e) => setFixedH(Math.round(e.nativeEvent.layout.height))}>
        {lowerPart}
      </View>
    </>
  );

  return (
    <GameFrame
      testID="speech-screen"
      target={target}
      currentCard={`speech:${story.id}:${shown}`}
      hideLevelCounter
      scrollKey={`${shown}:${run.answers.length}:${heard ? 1 : 0}`}
      onFrameLayout={setFrameH}
      top={
        <View style={styles.top} onLayout={(e) => setTopH(Math.round(e.nativeEvent.layout.height))}>
          <BackButton testID="speech-back" onPress={onBack} pressStyle={styles.backPress} arrowStyle={[styles.backArrow, { color: colors.text }]} />
          <View accessible accessibilityLabel={sx.progressLabel(progress.n, progress.total)} style={styles.progress}>
            <ProgressBar
              testID="speech-progress"
              pct={(run.answers.length / progress.total) * 100}
              filled={run.answers.length}
              segments={progress.total}
              brutalStyle={styles.bar}
              trackStyle={styles.track}
              trackColor={colors.border}
              fillStyle={styles.fill}
              fillColor={colors.tint}
            />
          </View>
        </View>
      }
      footer={footer}
    >
      <View style={styles.chat}>
        <Text testID="speech-narration" style={[styles.narration, { color: colors.textMuted }]}>{story.intro[source]}</Text>
        {run.path.slice(0, shown + 1).map((_id, n) => {
          const answer = run.answers[n];
          return (
            <View key={n} style={styles.exchange}>
              <Card style={styles.left} classicStyle={styles.bubble} boxStyle={styles.brutalBubble}>
                <View style={styles.bubbleHead}>
                  <Text style={[styles.who, { color: colors.textMuted }]}>{story.speaker}</Text>
                  <View style={styles.tools}>
                    <SpeakButton
                      testID={`speech-listen-${n}`}
                      onPress={() => say(bubbleOf(story, run, n, story.target))}
                      style={styles.tool}
                      iconStyle={styles.toolIcon}
                    />
                    <Pressable
                      testID={`speech-translate-${n}`}
                      accessibilityRole="button"
                      accessibilityLabel={sx.showTranslation}
                      accessibilityState={{ expanded: translated.has(n) }}
                      onPress={() => setTranslated((all) => (all.has(n) ? new Set([...all].filter((x) => x !== n)) : new Set([...all, n])))}
                      style={styles.tool}
                    >
                      <Text style={[styles.toolLetter, { color: colors.text }]}>F</Text>
                    </Pressable>
                  </View>
                </View>
                <Text testID={`speech-line-${n}`} style={[styles.line, { color: colors.text }]}>{bubbleOf(story, run, n, story.target)}</Text>
                {translated.has(n) && <Text testID={`speech-translation-${n}`} style={[styles.translation, { color: colors.textMuted }]}>{bubbleOf(story, run, n, source)}</Text>}
              </Card>
              {answer && (
                <Card
                  fill="b"
                  style={styles.right}
                  classicStyle={[styles.bubble, { backgroundColor: colors.tint }]}
                  boxStyle={styles.brutalBubble}
                >
                  <Text testID={`speech-answer-who-${n}`} style={[styles.who, { color: meText }]}>{answer.ok ? `${sx.you} ✓` : sx.youModel}</Text>
                  <Text testID={`speech-answer-${n}`} style={[styles.line, { color: meText }]}>{cap(answer.text)}</Text>
                </Card>
              )}
            </View>
          );
        })}
      </View>
    </GameFrame>
  );
}

const BIG = tapTarget * 2;

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backPress: { minHeight: tapTarget, minWidth: tapTarget, justifyContent: 'center' },
  backArrow: { fontSize: fontSize.xxl },
  progress: { flex: 1 },
  bar: { flex: 1 },
  track: { height: 8, borderRadius: radius.xs, overflow: 'hidden' },
  fill: { height: '100%' },
  chat: { marginHorizontal: spacing.xl, gap: spacing.md },
  narration: { fontSize: fontSize.sm, fontStyle: 'italic' },
  exchange: { gap: spacing.sm },
  left: { alignSelf: 'flex-start', maxWidth: '88%' },
  right: { alignSelf: 'flex-end', maxWidth: '88%' },
  bubble: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  brutalBubble: { padding: spacing.md, gap: spacing.xs },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  who: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  tools: { flexDirection: 'row', alignItems: 'center' },
  tool: { minHeight: tapTarget, minWidth: tapTarget, alignItems: 'center', justifyContent: 'center' },
  toolIcon: { fontSize: fontSize.lg },
  toolLetter: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  line: { fontSize: fontSize.md },
  translation: { fontSize: fontSize.sm },
  result: { borderWidth: 2, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs, marginBottom: spacing.sm },
  resultText: { fontSize: fontSize.sm },
  said: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  saidWord: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  struck: { textDecorationLine: 'underline', fontWeight: fontWeight.bold },
  upper: { flexGrow: 0 },
  yourTurn: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  ask: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  hint: { borderWidth: 2, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  hintTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  hintTexts: { flex: 1 },
  hintText: { fontSize: fontSize.md },
  hintTranslation: { fontSize: fontSize.sm },
  micBox: { alignItems: 'center', gap: spacing.xs },
  mic: { width: BIG, height: BIG, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  micIcon: { fontSize: fontSize.xxl },
  micLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textTransform: 'uppercase' },
  typeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: { flex: 1, minHeight: tapTarget, borderWidth: 2, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: fontSize.md },
  button: { minHeight: tapTarget, paddingHorizontal: spacing.lg },
  skip: { minHeight: tapTarget, marginTop: spacing.sm },
  classicButton: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  classicButtonText: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  note: { fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.xs },
  links: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { minHeight: tapTarget, justifyContent: 'center' },
  linkText: { fontSize: fontSize.sm, textDecorationLine: 'underline' },
});
