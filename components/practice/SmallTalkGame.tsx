import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/KText';
import EasySentenceCard from '@/components/EasySentenceCard';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import { themedEdgeStyle, themedInputStyle } from '@/components/grammar/Themed';
import GameFrame, { GameEmpty, type GameDock } from '@/components/practice/GameFrame';
import ResultBadge from '@/components/ResultBadge';
import SpeakButton from '@/components/SpeakButton';
import type { PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { useGrammarColors } from '@/lib/grammarColors';
import { currentLanguage, t } from '@/lib/i18n';
import { answerInputProps } from '@/lib/inputProps';
import { speechLang } from '@/lib/languages';
import { useLearner } from '@/lib/learner';
import {
  SMALLTALK_MODE,
  answerBank,
  answerSmallTalk,
  buildItemText,
  buildItems,
  buildTraps,
  judgeAnswer,
  judgeQuestion,
  nextSmallTalk,
  parseSmallTalk,
  questionBank,
  savedSmallTalk,
  smalltalkTopics,
  smalltalkTotals,
  startSmallTalk,
  swapAnswerIndex,
  type SmallTalkPart,
  type SmallTalkState,
  type SmallTalkTopic,
} from '@/lib/practice/smalltalk';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { tileWords } from '@/lib/sentenceCards';
import { speak, stopSpeaking } from '@/lib/speech';
import { isMicOffError, isNothingHeardError, recognitionAvailable, useRecognizer } from '@/lib/speechRecognition';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { useTheme } from '@/lib/ThemeContext';

// Small talk (lib/practice/smalltalk.ts has the parts and the scores): a fixed phrase pack, Spanish only. Build every question and
// answer from tiles, then "The app asks" (the app reads a question, the learner answers it with tiles, voice or typing) and "You ask"
// (the learner asks the question, the app answers with a random valid answer), then the summary. The run is kept in the resume store
// after every answer and dropped on the summary. No SRS writes.

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export default function SmallTalkGame() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const sx = s.practiceTab.smalltalk;
  const { refresh } = useLearner();
  const [loaded, setLoaded] = useState(false);
  const [target, setTarget] = useState<PcicTarget>('es');
  const [topic, setTopic] = useState<SmallTalkTopic | null>(null);
  const [state, setState] = useState<SmallTalkState | null>(null);
  const [micOk, setMicOk] = useState(true);
  const [typingOpen, setTypingOpen] = useState(false);
  const [typed, setTyped] = useState('');
  // the bank words placed so far (indexes into the bank), in order
  const [placed, setPlaced] = useState<number[]>([]);
  const [heard, setHeard] = useState<string | null>(null);
  const [cardH, setCardH] = useState(0);
  // the direction of the run on screen: a refocus keeps the run, another direction replaces it
  const shownTarget = useRef<PcicTarget | null>(null);

  const load = useCallback(async () => {
    const db = getDb();
    const { target: dir } = await refresh(['direction']);
    if (shownTarget.current === dir) return;
    const topics = smalltalkTopics(dir);
    const saved = topics.length ? parseSmallTalk(await loadResumeValue(db, SMALLTALK_MODE), topics) : null;
    const run = saved ?? (topics[0] ? startSmallTalk(topics[0], newSeed()) : null);
    shownTarget.current = dir;
    setTarget(dir);
    setTopic(topics.find((x) => x.id === run?.id) ?? null);
    setState(run);
    setLoaded(true);
  }, [refresh]);
  // Leaving the tab stops the read-aloud (the tab stays mounted).
  useScreenLoad(load, { onBlur: stopSpeaking });
  useEffect(() => () => stopSpeaking(), []);
  const checkMic = useCallback(async () => {
    setMicOk(await recognitionAvailable());
  }, []);
  useLoadOnMount(checkMic);

  const apply = (next: SmallTalkState) => {
    setState(next);
    // the run is dropped on the summary, so the next visit starts a new one
    void saveResumeValue(getDb(), SMALLTALK_MODE, next.step === 'summary' ? null : savedSmallTalk(next));
  };

  const step = state?.step;
  const pair = topic && state && step && step !== 'build' && step !== 'summary' ? topic.pairs[state.index] : null;
  // "The app asks": the question is read aloud when it comes up
  const asking = step === 'asks' && state && !state.done && pair ? pair.q.es : null;
  useEffect(() => {
    if (asking) speak(asking, speechLang(target));
  }, [asking, target]);
  // "You ask": the app's answer is read aloud once the question is finished
  const swapAnswer = topic && state && step === 'swap' && state.done ? topic.pairs[state.index].answers[swapAnswerIndex(topic, state.index, state.seed)] : null;
  useEffect(() => {
    if (swapAnswer) speak(swapAnswer.es, speechLang(target));
  }, [swapAnswer, target]);

  const bank =
    topic && state && !state.done
      ? step === 'asks'
        ? answerBank(topic, state.index, state.seed)
        : step === 'swap'
          ? questionBank(topic, state.index, state.seed)
          : []
      : [];
  const judge = (tp: SmallTalkTopic, st: SmallTalkState, text: string) => (st.step === 'swap' ? judgeQuestion(tp, st.index, text) : judgeAnswer(tp, st.index, text));

  // What was said (the recognizer's final result), typed or built from tiles is judged.
  const submitText = (text: string) => {
    if (!topic || !state || !pair || state.done || !text.trim()) return;
    Keyboard.dismiss();
    const j = judge(topic, state, text);
    setHeard(text);
    apply(answerSmallTalk(state, topic, j.right, j.answer));
  };
  const rec = useRecognizer(speechLang(target), submitText);
  // A typed or built answer closes the microphone: a result that is still on its way must not land on the next question.
  const submitOwn = (text: string) => {
    rec.abort();
    submitText(text);
  };
  // a new item: the tiles, the typed text, the verdict, the microphone and its error are cleared
  const reset = () => {
    rec.abort();
    rec.reset();
    setPlaced([]);
    setTyped('');
    setHeard(null);
  };

  if (!loaded) return null;
  if (!topic || !state) return <GameEmpty mode={SMALLTALK_MODE} target={target} text={sx.empty} />;

  const say = (text: string) => {
    stopSpeaking();
    speak(text, speechLang(target));
  };
  const goNext = () => {
    stopSpeaking();
    reset();
    apply(nextSmallTalk(state, topic));
  };
  const titles: Record<SmallTalkPart, string> = { build: sx.stepBuild, asks: sx.stepAsks, swap: sx.stepSwap };
  const nextDock: GameDock = { testID: 'smalltalk-next', label: `${s.card.next} →`, tone: 'next', onPress: goNext };
  const frame = { testID: 'smalltalk-screen', target, currentCard: `practice-smalltalk:${state.id}:${state.step}${state.index}` };

  if (state.step === 'summary') {
    const totals = smalltalkTotals(topic);
    return (
      <GameFrame
        {...frame}
        centered
        dock={{ testID: 'smalltalk-again', label: sx.again, tone: 'next', onPress: () => { reset(); apply(startSmallTalk(topic, newSeed())); } }}
      >
        <View testID="smalltalk-summary" style={styles.summary}>
          <Text testID="smalltalk-done" variant="title" style={[styles.doneTitle, { color: colors.text }]}>{sx.done}</Text>
          {(['build', 'asks', 'swap'] as const).map((part) => (
            <Text key={part} testID={`smalltalk-score-${part}`} style={[styles.score, { color: colors.text }]}>
              {sx.partScore(titles[part], state.scores[part], totals[part])}
            </Text>
          ))}
        </View>
      </GameFrame>
    );
  }

  const part = state.step;
  const size = smalltalkTotals(topic)[part];
  const position = Math.min(state.index + 1, size);
  // typing is offered at once when the microphone cannot be used; any other error is just a hint to try again
  const micOff = rec.error !== null && isMicOffError(rec.error);
  const typing = typingOpen || !micOk || micOff;
  const answering = part !== 'build' && !state.done;
  const builtText = placed.map((n) => bank[n]).join(' ');
  const ownText = typing && typed.trim() ? typed : builtText;
  let dock: GameDock | undefined;
  if (part !== 'build' && state.done) dock = nextDock;
  else if (answering) dock = { testID: 'smalltalk-check', label: `✓ ${s.card.check}`, tone: 'check', onPress: () => submitOwn(ownText), disabled: !ownText.trim() };

  const card = { classicStyle: styles.card, boxStyle: styles.brutalCard };
  const item = part === 'build' ? buildItems(topic)[state.index] : null;
  const buildText = item ? buildItemText(topic, item) : null;
  const picked = part === 'asks' && state.done && pair ? pair.answers[state.pick ?? 0] : null;

  const tiles = answering ? (
    <View style={styles.tilesBox}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{sx.tilesHint}</Text>
      <View testID="smalltalk-placed" style={[styles.bank, styles.placedRow, { borderColor: colors.tabIconDefault }]}>
        {placed.map((n, k) => (
          <Pressable
            key={`${n}-${k}`}
            testID={`smalltalk-placed-${k}`}
            accessibilityRole="button"
            onPress={() => setPlaced(placed.filter((_, i) => i !== k))}
            style={[styles.chip, themedEdgeStyle(g), { backgroundColor: colors.tint, borderColor: colors.tint }]}
          >
            <Text style={[styles.chipText, { color: colors.onTint }]}>{bank[n]}</Text>
          </Pressable>
        ))}
      </View>
      <View testID="smalltalk-bank" style={styles.bank}>
        {bank.map((w, n) => {
          const used = placed.includes(n);
          return (
            <Pressable
              key={n}
              testID={`smalltalk-word-${n}`}
              accessibilityRole="button"
              disabled={used}
              onPress={() => setPlaced([...placed, n])}
              style={[styles.chip, themedEdgeStyle(g), used ? { borderStyle: 'dashed', borderColor: colors.tabIconDefault } : { backgroundColor: colors.tint, borderColor: colors.tint }]}
            >
              <Text style={[styles.chipText, { color: used ? colors.tabIconDefault : colors.onTint }, used && styles.hidden]}>{w}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  ) : null;

  return (
    <GameFrame
      // a new question opens at its top, so the question stays in view while the tiles are tapped (emulator 2026-11-19)
      key={part === 'build' ? part : `${part}${state.index}`}
      {...frame}
      progress={{ text: s.practiceTab.progress(position, size), label: sx.stepLabel(titles[part], position, size) }}
      dock={dock}
      scrollKey={part === 'build' ? `${state.index}:${cardH}` : undefined}
      scrollToEndOnDock={!answering}
    >
      <View style={styles.box}>
        <Text style={[styles.caption, { color: colors.tint }]}>{titles[part]}</Text>
        <Text style={[styles.setting, { color: colors.textMuted }]}>{topic.title[currentLanguage() as keyof SmallTalkTopic['title']] ?? topic.title.en}</Text>

        {part === 'build' && item && buildText && (
          <View testID="smalltalk-build-card" onLayout={(e) => setCardH(Math.round(e.nativeEvent.layout.height))}>
            <EasySentenceCard
              key={state.index}
              sourceSentence={buildText.en}
              targetWords={tileWords(buildText.es)}
              trapWords={buildTraps(topic, state.index, state.seed)}
              speechLocale={speechLang(target)}
              onResult={(right) => apply(answerSmallTalk(state, topic, right))}
            />
          </View>
        )}

        {pair && (
          <>
            <Card {...card}>
              <Text style={[styles.caption, { color: colors.tint }]}>{part === 'asks' ? sx.answerIt : sx.askIt}</Text>
              {part === 'asks' ? (
                <>
                  <Text testID="smalltalk-question" style={[styles.big, { color: colors.text }]}>{pair.q.es}</Text>
                  <Text style={[styles.meaning, { color: colors.textMuted }]}>{pair.q.en}</Text>
                  <SpeakButton testID="smalltalk-listen" accessibilityLabel={sx.listen} onPress={() => say(pair.q.es)} style={styles.speakBtn} iconStyle={styles.speakIcon} />
                </>
              ) : (
                <Text testID="smalltalk-question" style={[styles.big, { color: colors.text }]}>{pair.q.en}</Text>
              )}
              {answering && <Text style={[styles.hint, { color: colors.textMuted }]}>{sx.answerHint}</Text>}
            </Card>

            {state.done && state.right !== null && (
              <View style={styles.feedback}>
                <ResultBadge testID="smalltalk-result" correct={state.right} label={state.right ? s.card.correct : s.card.wrong} align="center" />
                {heard !== null && <Text testID="smalltalk-heard" style={[styles.meaning, { color: colors.textMuted }]}>{sx.heard(heard)}</Text>}
              </View>
            )}
            {picked && (
              <Card {...card}>
                <Text style={[styles.hint, { color: colors.textMuted }]}>{state.right ? sx.matched : sx.rightAnswers}</Text>
                {state.right ? (
                  <View testID="smalltalk-matched">
                    <Text style={[styles.big, { color: colors.success }]}>{picked.es}</Text>
                    <Text style={[styles.meaning, { color: colors.textMuted }]}>{picked.en}</Text>
                  </View>
                ) : (
                  pair.answers.map((a, n) => (
                    <View key={n} testID={`smalltalk-right-${n}`}>
                      <Text style={[styles.lineText, { color: colors.success }]}>{a.es}</Text>
                      <Text style={[styles.meaning, { color: colors.textMuted }]}>{a.en}</Text>
                    </View>
                  ))
                )}
              </Card>
            )}
            {part === 'swap' && state.done && state.right === false && (
              <Card {...card}>
                <Text style={[styles.hint, { color: colors.textMuted }]}>{sx.rightQuestion}</Text>
                <Text testID="smalltalk-right-question" style={[styles.big, { color: colors.success }]}>{pair.q.es}</Text>
                <SpeakButton testID="smalltalk-listen-question" accessibilityLabel={sx.listen} onPress={() => say(pair.q.es)} style={styles.speakBtn} iconStyle={styles.speakIcon} />
              </Card>
            )}
            {swapAnswer && (
              <Card {...card}>
                <Text style={[styles.hint, { color: colors.textMuted }]}>{sx.answered}</Text>
                <Text testID="smalltalk-app-answer" style={[styles.big, { color: colors.text }]}>{swapAnswer.es}</Text>
                <Text style={[styles.meaning, { color: colors.textMuted }]}>{swapAnswer.en}</Text>
                <SpeakButton testID="smalltalk-listen-answer" accessibilityLabel={sx.listen} onPress={() => say(swapAnswer.es)} style={styles.speakBtn} iconStyle={styles.speakIcon} />
              </Card>
            )}

            {tiles}
            {answering && typing && (
              <TextInput
                testID="smalltalk-type-input"
                style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }, themedInputStyle(g)]}
                placeholder={s.card.typeIn(target)}
                placeholderTextColor={colors.tabIconDefault}
                value={typed}
                onChangeText={setTyped}
                onSubmitEditing={() => submitOwn(typed)}
                {...answerInputProps}
              />
            )}
            {answering && micOk && (
              <View style={styles.micBox}>
                <Pressable
                  testID="smalltalk-mic"
                  accessibilityRole="button"
                  accessibilityLabel={rec.listening ? sx.listening : sx.sayIt}
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
                <Text style={[styles.micLabel, { color: colors.text }]}>{rec.listening ? sx.listening : sx.sayIt}</Text>
              </View>
            )}
            {rec.error && answering && (
              <Text testID="smalltalk-mic-error" style={[styles.hint, { color: colors.textMuted }]}>
                {micOff ? sx.micOff : isNothingHeardError(rec.error) ? sx.micMiss : sx.micRetry}
              </Text>
            )}
            {answering && micOk && !typing && (
              <Pressable testID="smalltalk-type" accessibilityRole="button" onPress={() => setTypingOpen(true)} style={styles.link}>
                <Text style={[styles.linkText, { color: colors.tint }]}>{sx.typeInstead}</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </GameFrame>
  );
}

const BIG = tapTarget * 2;

const styles = StyleSheet.create({
  box: { marginHorizontal: spacing.xl, gap: spacing.lg },
  caption: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  setting: { fontSize: fontSize.sm },
  card: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, alignItems: 'center' },
  brutalCard: { padding: spacing.xl, gap: spacing.md, alignItems: 'center' },
  big: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  meaning: { fontSize: fontSize.md, textAlign: 'center' },
  speakBtn: { minHeight: tapTarget, minWidth: tapTarget, alignItems: 'center', justifyContent: 'center' },
  speakIcon: { fontSize: fontSize.xl },
  lineText: { fontSize: fontSize.lg, textAlign: 'center' },
  hint: { fontSize: fontSize.sm, textAlign: 'center' },
  tilesBox: { gap: spacing.md },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  placedRow: { minHeight: tapTarget + spacing.md, borderBottomWidth: 1, paddingBottom: spacing.sm },
  chip: { minHeight: tapTarget, justifyContent: 'center', borderRadius: radius.md, borderWidth: 2, paddingHorizontal: spacing.lg },
  chipText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  hidden: { opacity: 0 },
  micBox: { alignItems: 'center', gap: spacing.sm },
  mic: { width: BIG, height: BIG, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  micIcon: { fontSize: fontSize.xxl },
  micLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  link: { minHeight: tapTarget, justifyContent: 'center', alignItems: 'center' },
  linkText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  input: { borderWidth: 2, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: fontSize.md },
  feedback: { alignItems: 'center', gap: spacing.sm },
  summary: { alignItems: 'center', gap: spacing.md },
  doneTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, textAlign: 'center' },
  score: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, textAlign: 'center' },
});
