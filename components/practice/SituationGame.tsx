import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/KText';
import EasySentenceCard from '@/components/EasySentenceCard';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, motion, radius, spacing, tapTarget } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import { themedEdgeStyle, themedInputStyle } from '@/components/grammar/Themed';
import GameFrame, { GameEmpty, type GameDock } from '@/components/practice/GameFrame';
import ResultBadge from '@/components/ResultBadge';
import SpeakButton from '@/components/SpeakButton';
import { findPcicItem, type PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { GRAMMAR_PROGRESS_KEY, doneGrammarTopicProgress } from '@/lib/grammar/syllabus';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { answerInputProps } from '@/lib/inputProps';
import { knownTokens, resolvedTensesFromLessons } from '@/lib/knownSentence';
import { activeSourceFor } from '@/lib/languagePair';
import { speechLang } from '@/lib/languages';
import { useLearner } from '@/lib/learner';
import { dropOrphanCards } from '@/lib/pcicSession';
import { gapByWord } from '@/lib/practice/gapFill';
import { matchSpoken, type SpokenMatch } from '@/lib/practice/situationMatch';
import {
  SITUATIONS_MODE,
  answerSituation,
  buildTraps,
  fillBank,
  fillGaps,
  isSituationOpen,
  nextSituation,
  parseSituation,
  questionLines,
  savedSituation,
  situationTotals,
  situationsFor,
  stepSize,
  startSituation,
  type Situation,
  type SituationPart,
  type SituationState,
} from '@/lib/practice/situations';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { learnedEntries, tileWords } from '@/lib/sentenceCards';
import { speak, stopSpeaking } from '@/lib/speech';
import { isMicOffError, isNothingHeardError, recognitionAvailable, useRecognizer } from '@/lib/speechRecognition';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { useTheme } from '@/lib/ThemeContext';

// Situations (beta practiceSituations, PLAN-szituaciok): a short dialogue the learner learns and then uses, step by step: new words,
// structures, fill in the gaps, build the own lines, say every line, answer the questions, summary (lib/practice/situations.ts has
// the steps and the scores, lib/practice/situationMatch.ts checks what was said). The run is kept in the resume store after every
// answer, so leaving the tab and coming back continues where the learner was; it is dropped on the summary. No SRS writes.
// What is said comes from the microphone (lib/speechRecognition.ts) or, always available, from a text field.

const newSeed = () => Math.floor(Math.random() * 2 ** 31);
const BLANK = '_____';

export default function SituationGame() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const sx = s.practiceTab.situations;
  const source = activeSourceFor('es');
  const { refresh } = useLearner();
  const [loaded, setLoaded] = useState(false);
  const [target, setTarget] = useState<PcicTarget>('es');
  const [situation, setSituation] = useState<Situation | null>(null);
  const [state, setState] = useState<SituationState | null>(null);
  const [micOk, setMicOk] = useState(true);
  // the word tapped wrong in Fill in (red for a moment)
  const [flash, setFlash] = useState<number | null>(null);
  const [typingOpen, setTypingOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [heard, setHeard] = useState<{ text: string; match: SpokenMatch } | null>(null);
  // the height of the Build card: it grows with every tile placed, and the frame follows its end
  const [cardH, setCardH] = useState(0);
  const known = useRef<ReadonlySet<string>>(new Set());
  // the direction of the run on screen: a refocus keeps the run, another direction replaces it
  const shownTarget = useRef<PcicTarget | null>(null);

  const load = useCallback(async () => {
    const db = getDb();
    // The deck of the active direction has to be set before findPcicItem (same as the Learn tab).
    const { target: dir } = await refresh(['direction']);
    if (shownTarget.current === dir) return;
    let set: ReadonlySet<string> = new Set();
    if (dir === 'es') {
      const cards = dropOrphanCards(await db.getPcicCards(), (id) => findPcicItem(id) !== undefined);
      const rows = await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
      set = knownTokens('es', {
        learned: learnedEntries(cards, 'es', findPcicItem),
        tenses: resolvedTensesFromLessons(doneGrammarTopicProgress('es', rows).keys()),
      });
    }
    const open = situationsFor(dir).filter((x) => isSituationOpen(x, set));
    const saved = open.length ? parseSituation(await loadResumeValue(db, SITUATIONS_MODE), open) : null;
    const run = saved ?? (open[0] ? startSituation(open[0], set, newSeed()) : null);
    known.current = set;
    shownTarget.current = dir;
    setTarget(dir);
    setSituation(open.find((x) => x.id === run?.id) ?? null);
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

  useEffect(() => {
    if (flash === null) return;
    const id = setTimeout(() => setFlash(null), motion.feedback);
    return () => clearTimeout(id);
  }, [flash]);

  const apply = (next: SituationState) => {
    setState(next);
    // the run is dropped on the summary, so the next visit starts a new one
    void saveResumeValue(getDb(), SITUATIONS_MODE, next.step === 'summary' ? null : savedSituation(next));
  };
  // The line of the current Build / Say it / Questions item, and what may be said to it.
  const lineIndex = (() => {
    if (!situation || !state) return -1;
    if (state.step === 'build') return situation.build[state.index];
    if (state.step === 'say') return state.index;
    return state.step === 'questions' ? questionLines(situation)[state.index] : -1;
  })();
  const line = situation && lineIndex >= 0 ? situation.lines[lineIndex] : null;
  const asking = state?.step === 'questions' && !state.done && line ? line.es : null;
  // the question is read aloud when it comes up
  useEffect(() => {
    if (asking) speak(asking, speechLang('es'));
  }, [asking]);

  // What was said (the recognizer's final result) or typed is judged.
  const submitSpoken = (text: string) => {
    if (!situation || !state || !line || state.done || !text.trim()) return;
    Keyboard.dismiss();
    // Say it wants the number of the line, Questions take any number
    const match = matchSpoken(text, state.step === 'questions' ? (line.answers ?? []) : [line.es], { anyNumber: state.step === 'questions' });
    setHeard({ text, match });
    apply(answerSituation(state, situation, match.right));
  };
  const rec = useRecognizer(speechLang('es'), submitSpoken);
  // A typed answer closes the microphone: a result that is still on its way must not land on the next line.
  const submitTyped = (text: string) => {
    rec.abort();
    submitSpoken(text);
  };
  // a new item: the typed text, the verdict, the microphone and its error are cleared
  const reset = () => {
    rec.abort();
    rec.reset();
    setTyped('');
    setHeard(null);
  };

  if (!loaded) return null;
  if (!situation || !state) return <GameEmpty mode={SITUATIONS_MODE} target={target} text={sx.empty} />;

  const say = (text: string) => {
    stopSpeaking();
    speak(text, speechLang('es'));
  };
  const goNext = () => {
    stopSpeaking();
    reset();
    apply(nextSituation(state, situation));
  };
  const speaker = (l: { speaker: 'other' | 'me' }) => (l.speaker === 'me' ? sx.speakerMe : sx.speakerOther);
  const titles: Record<SituationPart | 'words' | 'patterns', string> = {
    words: sx.stepWords,
    patterns: sx.stepPatterns,
    fill: sx.stepFill,
    build: sx.stepBuild,
    say: sx.stepSay,
    questions: sx.stepQuestions,
  };
  const step = state.step;
  const nextDock: GameDock = { testID: 'situations-next', label: `${s.card.next} →`, tone: 'next', onPress: goNext };
  const frame = { testID: 'situations-screen', target, currentCard: `practice-situations:${state.id}:${step}${state.index}` };

  if (step === 'summary') {
    const totals = situationTotals(situation);
    return (
      <GameFrame
        {...frame}
        centered
        dock={{ testID: 'situations-again', label: sx.again, tone: 'next', onPress: () => { reset(); apply(startSituation(situation, known.current, newSeed())); } }}
      >
        <View testID="situations-summary" style={styles.summary}>
          <Text testID="situations-done" variant="title" style={[styles.doneTitle, { color: colors.text }]}>{sx.done}</Text>
          {(['fill', 'build', 'say', 'questions'] as const).map((part) => (
            <Text key={part} testID={`situations-score-${part}`} style={[styles.score, { color: colors.text }]}>
              {sx.partScore(titles[part], state.scores[part], totals[part])}
            </Text>
          ))}
        </View>
      </GameFrame>
    );
  }

  const size = stepSize(state, situation, step);
  const position = Math.min(state.index + 1, size);
  // typing is offered at once when the microphone cannot be used; any other error is just a hint to try again
  const micOff = rec.error !== null && isMicOffError(rec.error);
  const typing = typingOpen || !micOk || micOff;
  const speaking = step === 'say' || step === 'questions';
  let dock: GameDock | undefined;
  if (step === 'words' || step === 'patterns' || state.done) dock = nextDock;
  else if (speaking && typing) {
    dock = { testID: 'situations-check', label: `✓ ${s.card.check}`, tone: 'check', onPress: () => submitTyped(typed), disabled: !typed.trim() };
  }

  const card = { classicStyle: styles.card, boxStyle: styles.brutalCard };
  const gaps = fillGaps(situation);
  const bank = step === 'fill' ? fillBank(situation, state.seed) : [];
  const usedBank = new Set<number>();
  for (const gap of gaps.slice(0, state.index)) {
    const at = bank.findIndex((w, n) => w === gap.word.toLowerCase() && !usedBank.has(n));
    if (at >= 0) usedBank.add(at);
  }
  const pickWord = (n: number) => {
    const open = gaps[state.index];
    if (!open || state.done || usedBank.has(n)) return;
    const right = bank[n] === open.word.toLowerCase();
    setFlash(right ? null : n);
    apply(answerSituation(state, situation, right));
  };

  // The word bank sits docked above the tab bar (GameFrame footer), so it is on screen without scrolling; it goes with the last gap.
  const footer =
    step === 'fill' && !state.done ? (
      <>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{sx.fillHint}</Text>
        <View style={styles.bank}>
          {bank.map((w, n) => {
            const used = usedBank.has(n);
            const wrong = flash === n;
            return (
              <Pressable
                key={n}
                testID={`situations-word-${n}`}
                accessibilityRole="button"
                disabled={used || state.done}
                onPress={() => pickWord(n)}
                style={[
                  styles.chip,
                  themedEdgeStyle(g),
                  used ? { borderStyle: 'dashed', borderColor: colors.tabIconDefault } : { backgroundColor: colors.tint, borderColor: wrong ? colors.danger : colors.tint },
                  wrong && styles.chipWrong,
                ]}
              >
                <Text style={[styles.chipText, { color: used ? colors.tabIconDefault : wrong ? colors.danger : colors.onTint }, used && styles.hidden]}>{wrong ? `✗ ${w}` : w}</Text>
              </Pressable>
            );
          })}
        </View>
      </>
    ) : undefined;

  const word = step === 'words' ? situation.words.find((w) => w.es === state.words[state.index]) : undefined;
  const pattern = step === 'patterns' ? situation.patterns[state.index] : undefined;

  return (
    <GameFrame
      {...frame}
      progress={{ text: s.practiceTab.progress(position, size), label: sx.stepLabel(titles[step], position, size) }}
      dock={dock}
      footer={footer}
      scrollKey={step === 'build' ? `${state.index}:${cardH}` : undefined}
    >
      <View style={styles.box}>
        <Text style={[styles.caption, { color: colors.tint }]}>{titles[step]}</Text>
        <Text style={[styles.setting, { color: colors.textMuted }]}>{`${situation.title[source]}: ${situation.setting[source]}`}</Text>

        {word && (
          <Card {...card}>
            <Text testID="situations-card-word" style={[styles.big, { color: colors.text }]}>{word.es}</Text>
            <SpeakButton testID="situations-speak" accessibilityLabel={sx.listen} onPress={() => say(word.es)} style={styles.speakBtn} iconStyle={styles.speakIcon} />
            <Text testID="situations-card-meaning" style={[styles.meaning, { color: colors.textMuted }]}>{word[source]}</Text>
          </Card>
        )}

        {pattern && (
          <Card {...card}>
            <Text testID="situations-card-pattern" style={[styles.big, { color: colors.text }]}>{pattern.title[source]}</Text>
            <Text testID="situations-card-explanation" style={[styles.meaning, { color: colors.textMuted }]}>{source === 'hu' ? pattern.hu : pattern.en}</Text>
            <Text testID="situations-card-example" style={[styles.lineText, { color: colors.text }]}>{pattern.example}</Text>
            <SpeakButton testID="situations-speak" accessibilityLabel={sx.listen} onPress={() => say(pattern.example)} style={styles.speakBtn} iconStyle={styles.speakIcon} />
          </Card>
        )}

        {step === 'fill' && (
          <Card {...card}>
            {situation.lines.map((l, i) => {
              const gapNo = gaps.findIndex((x) => x.line === i);
              const parts = l.gap ? gapByWord(l.es, l.gap) : null;
              const filled = gapNo >= 0 && gapNo < state.index;
              return (
                <View key={i} testID={`situations-line-${i}`} style={styles.lineRow}>
                  <Text style={[styles.speaker, { color: colors.textMuted }]}>{speaker(l)}</Text>
                  <Text style={[styles.lineText, styles.lineBody, { color: colors.text }]}>
                    {parts ? parts.before : l.es}
                    {parts && (
                      <Text style={{ color: filled ? colors.success : gapNo === state.index ? colors.tint : colors.tabIconDefault, fontWeight: fontWeight.bold }}>
                        {filled ? parts.answer : BLANK}
                      </Text>
                    )}
                    {parts ? parts.after : ''}
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        {step === 'build' && line && (
          <View testID="situations-build-card" onLayout={(e) => setCardH(Math.round(e.nativeEvent.layout.height))}>
            <EasySentenceCard
              key={state.index}
              sourceSentence={line[source]}
              targetWords={tileWords(line.es)}
              trapWords={buildTraps(situation, lineIndex, state.seed)}
              speechLocale={speechLang('es')}
              onResult={(right) => apply(answerSituation(state, situation, right))}
            />
          </View>
        )}

        {speaking && line && (
          <>
            <Card {...card}>
              <Text style={[styles.speaker, { color: colors.textMuted }]}>{speaker(line)}</Text>
              <Text testID="situations-line-text" style={[styles.big, { color: colors.text }]}>{line.es}</Text>
              <Text style={[styles.meaning, { color: colors.textMuted }]}>{line[source]}</Text>
              <SpeakButton testID="situations-listen" accessibilityLabel={sx.listen} onPress={() => say(line.es)} style={styles.speakBtn} iconStyle={styles.speakIcon} />
              {step === 'questions' && !state.done && <Text style={[styles.hint, { color: colors.textMuted }]}>{sx.answerHint}</Text>}
            </Card>
            {step === 'questions' && state.wrong > 0 && line.answers && (
              <Text testID="situations-model" style={[styles.model, { color: colors.success }]}>{sx.model(line.answers[0])}</Text>
            )}
            {heard && (
              <View style={styles.feedback}>
                <ResultBadge testID="situations-result" correct={heard.match.right} label={heard.match.right ? s.card.correct : s.card.wrong} align="center" />
                <Text testID="situations-heard" style={[styles.meaning, { color: colors.textMuted }]}>{sx.heard(heard.text)}</Text>
                {step === 'say' && (
                  <View style={styles.said}>
                    {heard.match.words.map((w, n) => (
                      <Text
                        key={n}
                        testID={w.right ? 'situations-said-right' : 'situations-said-wrong'}
                        style={[styles.saidWord, { color: w.right ? colors.success : colors.danger }, !w.right && styles.struck]}
                      >
                        {w.word}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}
            {typing && !state.done && (
              <TextInput
                testID="situations-type-input"
                style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }, themedInputStyle(g)]}
                placeholder={s.card.typeIn('es')}
                placeholderTextColor={colors.tabIconDefault}
                value={typed}
                onChangeText={setTyped}
                onSubmitEditing={() => submitTyped(typed)}
                {...answerInputProps}
              />
            )}
            {!state.done && micOk && (
              <View style={styles.micBox}>
                <Pressable
                  testID="situations-mic"
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
            {rec.error && !state.done && (
              <Text testID="situations-mic-error" style={[styles.hint, { color: colors.textMuted }]}>
                {micOff ? sx.micOff : isNothingHeardError(rec.error) ? sx.micMiss : sx.micRetry}
              </Text>
            )}
            {!state.done && micOk && !typing && (
              <Pressable testID="situations-type" accessibilityRole="button" onPress={() => setTypingOpen(true)} style={styles.link}>
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
  lineRow: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch', alignItems: 'flex-start' },
  lineBody: { flex: 1 },
  speaker: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, minWidth: tapTarget + spacing.lg },
  lineText: { fontSize: fontSize.lg, textAlign: 'left' },
  hint: { fontSize: fontSize.sm, textAlign: 'center' },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  chip: { minHeight: tapTarget, justifyContent: 'center', borderRadius: radius.md, borderWidth: 2, paddingHorizontal: spacing.lg },
  chipWrong: { backgroundColor: 'transparent' },
  chipText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  hidden: { opacity: 0 },
  model: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  micBox: { alignItems: 'center', gap: spacing.sm },
  mic: { width: BIG, height: BIG, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  micIcon: { fontSize: fontSize.xxl },
  micLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  link: { minHeight: tapTarget, justifyContent: 'center', alignItems: 'center' },
  linkText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  input: { borderWidth: 2, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: fontSize.md },
  feedback: { alignItems: 'center', gap: spacing.sm },
  said: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  saidWord: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  struck: { textDecorationLine: 'line-through' },
  summary: { alignItems: 'center', gap: spacing.md },
  doneTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, textAlign: 'center' },
  score: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, textAlign: 'center' },
});
