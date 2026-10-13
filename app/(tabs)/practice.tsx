import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { SkinBackdrop } from '@/components/skins/Slots';
import { Card, brutalInputStyle } from '@/components/grammar/Brutal';
import DockedAction, { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';
import FeedbackButton from '@/components/FeedbackModal';
import ResultBadge from '@/components/ResultBadge';
import SpeakButton from '@/components/SpeakButton';
import { findPcicItem, setPcicTarget, type PcicTarget } from '@/data/pcic';
import { useBeta } from '@/lib/beta';
import { getDb } from '@/lib/database';
import { t } from '@/lib/i18n';
import { answerInputProps } from '@/lib/inputProps';
import { speechLang } from '@/lib/languages';
import { buildGapQueue, checkGap, gapTaskFor, type GapTask } from '@/lib/practice/gapFill';
import { recordPracticeResult } from '@/lib/practice/halfStep';
import { recordCorrectHalf } from '@/lib/practice/halfXp';
import {
  loadPracticeRound,
  newPracticeRound,
  restorePracticeRound,
  savePracticeRound,
  type PracticeRound,
  type RoundAnswer,
} from '@/lib/practice/practiceRound';
import { speak, stopSpeaking } from '@/lib/speech';
import { localDateString } from '@/lib/usageStats';

// Beta tab (Settings -> Beta -> Practice tab): "missing word", a sentence of a learned word with the
// word blanked out (lib/practice/gapFill.ts). A right answer is one half-step of the word, a wrong typed
// one counts towards a step back (lib/practice/halfStep.ts, spec HAROM-JATEK.md 5.1). The unfinished
// round is saved after every step (lib/practice/practiceRound.ts) and resumed on the same day.

// A right answer shows its feedback this long, then the next sentence comes by itself.
const CORRECT_PAUSE_MS = 900;
const BLANK = '_____';

export default function PracticeScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  // beta: xpV2, a correct answer (one half) earns XP; off = no XP, the old behavior.
  const xpV2 = useBeta('xpV2');
  const { dockLift } = useDockLift();
  const [dockH, setDockH] = useState(DOCK_RESERVE);

  const [loaded, setLoaded] = useState(false);
  const [tasks, setTasks] = useState<GapTask[]>([]);
  const [target, setTarget] = useState<PcicTarget>('es');
  const [strictAccents, setStrictAccents] = useState(false);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<RoundAnswer[]>([]);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const pause = useRef<ReturnType<typeof setTimeout> | null>(null);
  // the local day the shown round was built on (a saved round is only resumed on the same day).
  const roundDate = useRef('');
  const right = results.filter((r) => r === 'right').length;

  // `fresh`: a new round even if one is saved (the "again" button).
  const load = useCallback(async (fresh = false) => {
    const db = getDb();
    // The deck of the active direction has to be set before findPcicItem (same as the Learn tab).
    const onboarding = await db.getOnboarding();
    const dir = (onboarding?.target as PcicTarget) ?? 'es';
    setPcicTarget(dir);
    const [cards, strict] = await Promise.all([db.getPcicCards(), db.getStrictAccents()]);
    const today = localDateString();
    // an answer's pause must not move a round that is being replaced or resumed.
    if (pause.current) clearTimeout(pause.current);
    pause.current = null;
    const saved = fresh ? null : await loadPracticeRound().catch(() => null);
    const resumed = restorePracticeRound(saved, today, dir, (id) => {
      const item = findPcicItem(id);
      return item ? gapTaskFor(item, dir) : null;
    });
    const queue = resumed?.tasks ?? buildGapQueue(cards, { target: dir, findItem: findPcicItem, today });
    const done = resumed?.results ?? queue.map((): RoundAnswer => null);
    const at = resumed?.index ?? 0;
    roundDate.current = today;
    setTarget(dir);
    setStrictAccents(strict);
    setTasks(queue);
    setResults(done);
    setIndex(at);
    setTyped('');
    setResult(done[at] === 'wrong' ? 'wrong' : null);
    setLoaded(true);
    // a new round is saved at once; a resumed one that was already over is deleted.
    if (!resumed && queue.length > 0) void savePracticeRound(newPracticeRound(queue, dir, today)).catch(() => {});
    else if (resumed && at >= queue.length) void savePracticeRound(null).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const clearPause = () => {
    if (pause.current) clearTimeout(pause.current);
    pause.current = null;
  };
  useEffect(() => () => {
    clearPause();
    stopSpeaking();
  }, []);

  const task: GapTask | undefined = tasks[index];
  const finished = loaded && tasks.length > 0 && index >= tasks.length;

  // The round after this step is saved before the screen moves on (the last step deletes it).
  const persist = (at: number, done: RoundAnswer[]): Promise<void> => {
    if (at >= tasks.length) return savePracticeRound(null).catch(() => {});
    const round: PracticeRound = { v: 1, date: roundDate.current, target, ids: tasks.map((t) => t.itemId), index: at, results: done };
    return savePracticeRound(round).catch(() => {});
  };

  // `at` / `done` are passed in: the pause timer is set in handleCheck, before the state it needs is rendered.
  const goTo = (at: number, done: RoundAnswer[]) => {
    clearPause();
    void persist(at, done);
    setIndex(at);
    setTyped('');
    setResult(null);
  };
  const advance = () => goTo(index + 1, results);

  const handleCheck = () => {
    if (!task || result || !typed.trim()) return;
    Keyboard.dismiss();
    const ok = checkGap(typed, task, strictAccents);
    setResult(ok ? 'correct' : 'wrong');
    const done = results.map((r, i) => (i === index ? (ok ? 'right' : 'wrong') : r));
    setResults(done);
    // The answer is saved BEFORE its half is recorded: if the app dies in between, a half is lost, but a
    // resumed round never gives it (or its XP) a second time. A failing save must not break the round.
    const saved = persist(index, done);
    if (ok) {
      void saved.then(() => recordCorrectHalf(task.itemId, xpV2)).catch(() => {});
      pause.current = setTimeout(() => goTo(index + 1, done), CORRECT_PAUSE_MS);
    } else {
      void saved.then(() => recordPracticeResult(task.itemId, 'wrongTyped')).catch(() => {});
    }
    // The whole sentence is read aloud, after a right and a wrong answer alike.
    stopSpeaking();
    speak(`${task.before}${task.answer}${task.after}`, speechLang(target));
  };

  const header = (
    <View style={styles.header}>
      <Text accessibilityRole="header" variant="title" style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle]}>
        {s.tabs.practice}
      </Text>
      {task && (
        <Text accessibilityLabel={s.practiceTab.progressLabel(index + 1, tasks.length)} style={[styles.progress, { color: colors.tabIconDefault }]}>
          {s.practiceTab.progress(index + 1, tasks.length)}
        </Text>
      )}
    </View>
  );

  const shell = (children: ReactNode, dock?: ReactNode) => (
    <KeyboardAvoidingView
      testID="practice-screen"
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SkinBackdrop />
      {header}
      {children}
      {dock}
      <FeedbackButton level="-" languagePair={target === 'es' ? 'en-es' : 'es-en'} currentCard="practice-tab" bottomOffset={dock ? dockH + dockLift : 0} />
    </KeyboardAvoidingView>
  );

  if (!loaded) return shell(null);

  if (tasks.length === 0) {
    return shell(
      <View style={styles.center}>
        <Text testID="practice-empty" style={[styles.emptyText, { color: colors.text }]}>{s.practiceTab.emptyTitle}</Text>
      </View>,
    );
  }

  if (finished) {
    return shell(
      <View style={styles.center}>
        <Text variant="title" style={[styles.doneTitle, { color: colors.text }]}>{s.practiceTab.roundDone}</Text>
        <Text testID="practice-score" style={[styles.emptyText, { color: colors.text }]}>{s.practiceTab.roundScore(right, tasks.length)}</Text>
      </View>,
      <DockedAction
        testID="practice-again"
        label={s.practiceTab.again}
        onPress={() => void load(true)}
        tone="check"
        bottom={dockLift}
        colors={colors}
        onHeight={setDockH}
      />,
    );
  }

  const sourceLang = target === 'es' ? 'en' : 'es';
  const gapColor = result === 'correct' ? colors.success : result === 'wrong' ? colors.danger : colors.tint;
  return shell(
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: dockH + dockLift + 16 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Card style={styles.cardMargin} classicStyle={styles.card} boxStyle={styles.brutalCard}>
        <Text
          testID="practice-sentence"
          accessibilityLabel={result ? undefined : `${task!.before}${s.practiceTab.blankLabel}${task!.after}`}
          style={[styles.sentence, { color: colors.text }]}
        >
          {task!.before}
          <Text testID="practice-gap" style={{ color: gapColor, fontWeight: '800' }}>{result ? task!.answer : BLANK}</Text>
          {task!.after}
        </Text>

        <View style={styles.translationRow}>
          <Text testID="practice-translation" style={[styles.translation, { color: colors.tabIconDefault }]}>{task!.translation}</Text>
          <SpeakButton onPress={() => speak(task!.translation, speechLang(sourceLang))} style={styles.speakBtn} iconStyle={styles.speakIcon} />
        </View>
        <Text testID="practice-hint" style={[styles.hint, { color: colors.tabIconDefault }]}>{s.practiceTab.meaningHint(task!.meaning)}</Text>

        <TextInput
          key={index}
          testID="practice-input"
          accessibilityLabel={s.practiceTab.inputLabel}
          style={[
            styles.input,
            { color: colors.text, borderColor: result === 'correct' ? colors.successFill : result === 'wrong' ? colors.danger : colors.tabIconDefault },
            g.brutal && brutalInputStyle(g),
            g.brutal && result && { borderColor: result === 'correct' ? colors.successFill : colors.danger },
          ]}
          placeholder={s.practiceTab.inputPlaceholder}
          placeholderTextColor={colors.tabIconDefault}
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={result ? advance : handleCheck}
          editable={!result}
          autoFocus
          {...answerInputProps}
        />

        {result && <ResultBadge correct={result === 'correct'} label={result === 'correct' ? s.card.correct : s.card.wrong} />}
        {result === 'wrong' && <Text testID="practice-correct-form" style={[styles.correctLine, { color: colors.success }]}>{s.practiceTab.correctForm(task!.answer)}</Text>}
      </Card>
    </ScrollView>,
    <DockedAction
      testID="practice-action"
      label={result ? `${s.card.next} →` : `✓ ${s.card.check}`}
      onPress={result ? advance : handleCheck}
      tone={result ? 'next' : 'check'}
      color={result === 'wrong' ? colors.danger : result === 'correct' ? colors.successFill : undefined}
      disabled={!result && !typed.trim()}
      bottom={dockLift}
      colors={colors}
      onHeight={setDockH}
    />,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
  progress: { fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyText: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  doneTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  scroll: { flex: 1 },
  cardMargin: { marginHorizontal: 20 },
  card: { borderRadius: 20, padding: 24, alignItems: 'center', minHeight: 280, gap: 16 },
  brutalCard: { padding: 24, alignItems: 'center', minHeight: 280, gap: 16 },
  sentence: { fontSize: 22, fontWeight: '700', textAlign: 'center', lineHeight: 32 },
  translationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  translation: { fontSize: 16, textAlign: 'center', flexShrink: 1 },
  speakBtn: { padding: 4, flexShrink: 0 },
  speakIcon: { fontSize: 22 },
  hint: { fontSize: 14, textAlign: 'center' },
  input: { width: '100%', borderWidth: 2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  correctLine: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
