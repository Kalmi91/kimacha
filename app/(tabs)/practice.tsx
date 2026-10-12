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
import ResultBadge from '@/components/ResultBadge';
import SpeakButton from '@/components/SpeakButton';
import { findPcicItem, setPcicTarget, type PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { t } from '@/lib/i18n';
import { answerInputProps } from '@/lib/inputProps';
import { speechLang } from '@/lib/languages';
import { buildGapQueue, checkGap, type GapTask } from '@/lib/practice/gapFill';
import { recordPracticeResult } from '@/lib/practice/halfStep';
import { speak, stopSpeaking } from '@/lib/speech';
import { localDateString } from '@/lib/usageStats';

// Beta tab (Settings -> Beta -> Practice tab): "missing word", a sentence of a learned word with the
// word blanked out (lib/practice/gapFill.ts). A right answer is one half-step of the word, a wrong typed
// one counts towards a step back (lib/practice/halfStep.ts, spec HAROM-JATEK.md 5.1).

// A right answer shows its feedback this long, then the next sentence comes by itself.
const CORRECT_PAUSE_MS = 900;
const BLANK = '_____';

export default function PracticeScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const { dockLift } = useDockLift();
  const [dockH, setDockH] = useState(DOCK_RESERVE);

  const [loaded, setLoaded] = useState(false);
  const [tasks, setTasks] = useState<GapTask[]>([]);
  const [target, setTarget] = useState<PcicTarget>('es');
  const [strictAccents, setStrictAccents] = useState(false);
  const [index, setIndex] = useState(0);
  const [right, setRight] = useState(0);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const pause = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const db = getDb();
    // The deck of the active direction has to be set before findPcicItem (same as the Learn tab).
    const onboarding = await db.getOnboarding();
    const dir = (onboarding?.target as PcicTarget) ?? 'es';
    setPcicTarget(dir);
    const [cards, strict] = await Promise.all([db.getPcicCards(), db.getStrictAccents()]);
    setTarget(dir);
    setStrictAccents(strict);
    setTasks(buildGapQueue(cards, { target: dir, findItem: findPcicItem, today: localDateString(), seed: Date.now() }));
    setIndex(0);
    setRight(0);
    setTyped('');
    setResult(null);
    setLoaded(true);
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

  const advance = () => {
    clearPause();
    setIndex((i) => i + 1);
    setTyped('');
    setResult(null);
  };

  const handleCheck = () => {
    if (!task || result || !typed.trim()) return;
    Keyboard.dismiss();
    const ok = checkGap(typed, task, strictAccents);
    setResult(ok ? 'correct' : 'wrong');
    // A failing save must not break the round.
    if (ok) {
      setRight((n) => n + 1);
      // xp: xpForHalf (6. lépés)
      void recordPracticeResult(task.itemId, 'correct').catch(() => {});
      pause.current = setTimeout(advance, CORRECT_PAUSE_MS);
    } else {
      void recordPracticeResult(task.itemId, 'wrongTyped').catch(() => {});
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
        onPress={() => void load()}
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
