import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { Text } from '@/components/KText';
import FitText from '@/components/FitText';
import CardShell from '@/components/learn/CardShell';
import ExamButton from '@/components/exam/ExamButton';
import { BackButton, themedInputStyle } from '@/components/grammar/Themed';
import { softTitleStyle } from '@/components/grammar/Brutal';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';
import { FEEDBACK_CORNER_CLEAR } from '@/components/learn/pcicStyles';
import { useDockLift } from '@/components/learn/useDockLift';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { brutalHeaderRowStyle } from '@/lib/brutalHeader';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { useLearner } from '@/lib/learner';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import { useSessionProgress } from '@/lib/useSessionProgress';
import { countLearningToday } from '@/lib/learningDay';
import { awardXpThen } from '@/lib/xpAward';
import { strictAnswerMatch } from '@/lib/answerMatch';
import { answerInputProps } from '@/lib/inputProps';
import { dismissKeyboardOnTap, keyboardDismissOnDrag } from '@/lib/keyboardTap';
import { useFocusOnNewCard } from '@/lib/learn/useFocusOnNewCard';
import { useWebKeyboardOpen, WEB_TYPING_PADDING } from '@/lib/webKeyboard';
import { pairOf, type Lang } from '@/lib/languagePair';
import type { Level } from '@/data/words';
import { GRAMMAR_PROGRESS_KEY, lessonFor } from '@/lib/grammar/syllabus';
import {
  answerFormCheck, formCheckCells, formCheckEnabled, formCheckProgressKey,
  freshFormCheckState, parseFormCheckState, startFormCheckPractice,
  type FormCheckCell, type FormCheckState,
} from '@/lib/grammar/formCheck';
import ScreenFeedback from '@/lib/screenFeedback';

export default function FormCheckScreen() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const topicId = String(topic);
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const labels = s.grammar.formCheck;
  const { refresh, strictAccents } = useLearner();
  const { persistRow } = useSessionProgress();
  const [loading, setLoading] = useState(true);
  const [learnedLang, setLearnedLang] = useState('es');
  const [level, setLevel] = useState<Level>('A1');
  const [cells, setCells] = useState<FormCheckCell[]>([]);
  const [state, setState] = useState<FormCheckState>(() => freshFormCheckState([]));
  const [typed, setTyped] = useState('');
  const [sequence, setSequence] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const { dockLift } = useDockLift();
  const webKeyboardOpen = useWebKeyboardOpen();

  const load = useCallback(async () => {
    const { target } = await refresh(['direction', 'strictAccents']);
    const db = getDb();
    const levelData = await db.getLevel();
    const items = formCheckEnabled(topicId, target) ? formCheckCells(lessonFor(target, topicId)) : [];
    const rows = await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
    const saved = parseFormCheckState(rows.find((row) => row.itemId === formCheckProgressKey(topicId))?.data, items);
    const next = saved.phase === 'practiceEnd' || (saved.phase === 'checkEnd' && saved.wrong.length === 0) ? freshFormCheckState(items) : saved;
    setLearnedLang(target);
    setLevel((levelData.level as Level) ?? 'A1');
    setCells(items);
    setState(next);
    setTyped(next.result?.typed ?? '');
    setLoading(false);
  }, [refresh, topicId, setTyped]);
  useLoadOnMount(load);

  const currentId = state.phase === 'check' ? state.order[state.index] : state.phase === 'practice' ? state.queue[0] : undefined;
  const current = cells.find((cell) => cell.id === currentId);
  useFocusOnNewCard(inputRef, !loading && !!current && !state.result, `${currentId}-${sequence}`);

  const save = (next: FormCheckState) => {
    setState(next);
    persistRow(GRAMMAR_PROGRESS_KEY, formCheckProgressKey(topicId), 'progress', next);
  };
  // a second tap before the re-render still sees the old state, so the item key guards the XP
  const checkedKey = useRef('');
  const handleCheck = () => {
    const key = `${currentId}-${sequence}`;
    if (!current || state.result || checkedKey.current === key) return;
    checkedKey.current = key;
    const correct = typed.trim().length > 0 && strictAnswerMatch(typed, current.answer, { strictAccents, lang: learnedLang });
    save({ ...state, result: { id: current.id, typed, correct } });
    if (correct) awardXpThen('grammar', `formcheck:${current.id}`, () => {});
    void countLearningToday();
  };
  const advance = (asCorrect = false) => {
    if (!state.result) return;
    save(answerFormCheck(state, asCorrect || state.result.correct, state.result.typed));
    setTyped('');
    setSequence((value) => value + 1);
  };
  const startAgain = () => {
    save(freshFormCheckState(cells));
    setTyped('');
    setSequence((value) => value + 1);
  };
  const suffix = state.phase === 'checkEnd' ? ':end' : state.phase === 'practice' ? ':practice' : state.phase === 'practiceEnd' ? ':practice-end' : '';
  const feedback = <ScreenFeedback level={level} languagePair={pairOf(learnedLang as Lang)} currentCard={`grammar:${topicId}:formcheck${suffix}`} />;
  const header = (
    <View style={[styles.header, brutalHeaderRowStyle(g)]}>
      {g.brutal ? <BackButton testID="formcheck-back" onPress={() => router.back()} /> : (
        <Pressable testID="formcheck-back" accessibilityRole="button" accessibilityLabel={s.a11y.back} onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.text, fontSize: 22 }}>←</Text>
        </Pressable>
      )}
      <FitText variant="title" base={17} maxLines={1} numberOfLines={1} reserve={90 + FEEDBACK_CORNER_CLEAR} style={[styles.title, { color: colors.text }, softTitleStyle(g)]}>
        {labels.title}
      </FitText>
      <View style={styles.cornerClear} />
    </View>
  );

  if (loading) return <View style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.tint} />{feedback}</View>;

  if (!current) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <ScrollView contentContainerStyle={styles.endBody}>
          {state.phase === 'checkEnd' ? (
            <>
              <Text testID="formcheck-progress" variant="title" style={[styles.score, { color: colors.text }]}>{`${cells.length - state.wrong.length}/${cells.length}`}</Text>
              {state.wrong.map((miss) => {
                const cell = cells.find((item) => item.id === miss.id)!;
                return <Text key={cell.id} testID="formcheck-missing" style={[styles.missing, { color: colors.text }]}>{`${cell.verb} · ${cell.person} → ${cell.answer}`}</Text>;
              })}
              {state.wrong.length > 0 ? (
                <ExamButton testID="formcheck-practice" accent label={labels.practice(state.wrong.length)} onPress={() => save(startFormCheckPractice(state))} />
              ) : <Text style={{ color: colors.text }}>{labels.allKnown}</Text>}
            </>
          ) : state.phase === 'practiceEnd' ? <Text style={[styles.score, { color: colors.text }]}>{labels.complete}</Text> : null}
          {state.phase === 'practiceEnd' || (state.phase === 'checkEnd' && state.wrong.length === 0) ? (
            <ExamButton testID="formcheck-start-again" accent label={labels.startAgain} onPress={startAgain} />
          ) : null}
        </ScrollView>
        {feedback}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }, webKeyboardOpen && WEB_TYPING_PADDING]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <Text testID="formcheck-progress" style={[styles.progress, { color: colors.tabIconDefault }]}>
        {state.phase === 'check' ? `${state.index + 1}/${cells.length}` : `${state.done.length}/${state.wrong.length}`}
      </Text>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.cardBody, { paddingBottom: FAB_CLEARANCE + dockLift }]} keyboardShouldPersistTaps="handled" keyboardDismissMode={keyboardDismissOnDrag()}>
        <CardShell compact colors={colors} onPress={dismissKeyboardOnTap}>
          <FitText variant="word" base={32} maxLines={3} reserve={100} style={[styles.prompt, { color: colors.text }]}>{`${current.verb} · ${current.person}`}</FitText>
          <TextInput
            key={`${current.id}-${sequence}`}
            ref={inputRef}
            testID="formcheck-input"
            style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }, themedInputStyle(g)]}
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={state.result ? () => advance() : handleCheck}
            editable={!state.result}
            placeholder={s.card.typeIn(learnedLang)}
            placeholderTextColor={colors.tabIconDefault}
            {...answerInputProps}
          />
          {state.result ? (
            <Text testID="formcheck-result" style={[styles.result, { color: state.result.correct ? colors.success : colors.danger }]}>
              {`${state.result.correct ? `✓ ${s.grammar.correct}` : `✕ ${s.randomRound.wrong}`} · ${current.answer}`}
            </Text>
          ) : null}
        </CardShell>
        <View style={styles.buttonRow}>
          {state.result && !state.result.correct ? <View style={styles.secondary}><ExamButton testID="grammar-mistyped" secondary label={s.smallTest.acceptRight} onPress={() => advance(true)} /></View> : null}
          <View style={styles.primary}><ExamButton testID="formcheck-check" accent label={state.result ? `${s.grammar.next} →` : `✓ ${s.card.check}`} onPress={state.result ? () => advance() : handleCheck} /></View>
        </View>
      </ScrollView>
      {feedback}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { flex: 1, textAlign: 'center', fontWeight: '700', paddingHorizontal: 8 },
  cornerClear: { width: FEEDBACK_CORNER_CLEAR },
  progress: { fontSize: 13, fontVariant: ['tabular-nums'], marginBottom: 8 },
  scroll: { flex: 1 },
  cardBody: { flexGrow: 1, paddingTop: 8 },
  prompt: { fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 22, textAlign: 'center' },
  result: { fontSize: 18, textAlign: 'center', marginTop: 14 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primary: { flex: 1 },
  secondary: { flex: 1 },
  endBody: { gap: 16, paddingBottom: 40 },
  score: { fontSize: 24, textAlign: 'center', marginVertical: 16 },
  missing: { fontSize: 17 },
});
