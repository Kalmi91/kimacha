import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import { speechLang } from '@/lib/languages';
import { playChime } from '@/lib/chime';
import { speak, stopSpeaking } from '@/lib/speech';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import type { LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { Card } from '@/components/grammar/Brutal';
import LevelTestFeedback, { TableView } from '@/components/grammar/LevelTestFeedback';
import TestQuestionView from '@/components/grammar/TestQuestionView';
import ExamButton from '@/components/exam/ExamButton';
import { DockSlotProvider, useDockSlot } from '@/components/learn/DockSlot';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';
import ScreenFeedback from '@/lib/screenFeedback';
import XpChip from '@/components/XpChip';
import { awardXpThen } from '@/lib/xpAward';

// The Practice run after a wrong answer in the level test (FB574, FB575): the rule on top, then the tasks one by one, each
// with the same result card as the test (no Practice button). A wrong task comes back once, 3 places later, and the total
// grows by one so the counter stays true. Practice keeps no state of its own and writes no evidence: the level percent and
// the test's round do not move. ✕ and the end screen both hand control back to the test.
const COME_BACK_AFTER = 3;
// the rule box height; with the keyboard open the box is not drawn at all (FB590): the app pans the window for the
// keyboard (app.json softwareKeyboardLayoutMode), so a box above the question pushed the question off the top
const RULE_MAX = 220;

interface Item {
  q: LessonTestQuestion;
  retry: boolean;
}

export default function LevelPractice({
  missed,
  tasks,
  level,
  userLevel,
  languagePair,
  learnedLang,
  strictAccents,
  topicTitle,
  onRule,
  onExit,
}: {
  missed: LessonTestQuestion;
  tasks: LessonTestQuestion[];
  level: string;
  userLevel: string;
  languagePair: string;
  learnedLang: string;
  strictAccents: boolean;
  topicTitle: string;
  onRule: () => void;
  onExit: () => void;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().levelTest;
  const dock = useDockSlot(colors);
  const [queue, setQueue] = useState<Item[]>(() => tasks.map((q) => ({ q, retry: false })));
  const [index, setIndex] = useState(0);
  const [right, setRight] = useState(0);
  // the XP the answer on screen gave (FB591); 0 shows nothing
  const [earned, setEarned] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; given?: string } | null>(null);
  const retried = useRef(new Set<string>());
  const ruleScroll = useRef<ScrollView>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  useEffect(() => () => stopSpeaking(), []);

  const done = index >= queue.length;
  const cur = done ? null : queue[index];

  const answered = (ok: boolean, given?: string) => {
    if (!cur) return;
    Keyboard.dismiss();
    setResult({ ok, given });
    setEarned(0);
    if (ok) {
      setRight((n) => n + 1);
      awardXpThen('levelPractice', cur.q.id, setEarned);
    }
    const say = () => {
      if (cur.q.say) speak(cur.q.say, speechLang(learnedLang));
    };
    if (ok) playChime(say);
    else say();
  };

  const next = () => {
    if (cur && result && !result.ok && !retried.current.has(cur.q.id)) {
      retried.current.add(cur.q.id);
      const at = Math.min(index + COME_BACK_AFTER, queue.length);
      const copy = [...queue];
      copy.splice(at, 0, { q: cur.q, retry: true });
      setQueue(copy);
    }
    setResult(null);
    setIndex(index + 1);
  };

  const header = (
    <View style={styles.header}>
      <Pressable testID="level-practice-close" accessibilityRole="button" accessibilityLabel={s.leave} hitSlop={12} onPress={onExit}>
        <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
      </Pressable>
      <Text testID="level-practice-header" style={[styles.counter, { color: colors.textMuted }]}>
        {s.practiceHeader(Math.min(index + 1, queue.length), queue.length)}
      </Text>
      <ScreenFeedback
        placement="inline"
        level={userLevel}
        languagePair={languagePair}
        currentCard={`grammar-level-practice:${level}:${missed.id}`}
      />
    </View>
  );

  const d = missed.detail;
  // the table of the CURRENT task: its asked cell is the highlighted one (a later task asks another row)
  const table = cur?.q.detail?.table ?? d?.table;
  const hasRule = !!table || !!missed.review.why || (d?.examples ?? []).length > 0;
  // the rule stays on screen while typing: compact rows, a height cap that leaves the input and Check visible, and the
  // asked row scrolled into view
  const ruleBox = hasRule ? (
    <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{s.practiceRule}</Text>
      <ScrollView ref={ruleScroll} testID="level-practice-rule-box" style={{ maxHeight: RULE_MAX }} nestedScrollEnabled>
        {table ? (
          <TableView table={table} compact onHighlightLayout={(y) => ruleScroll.current?.scrollTo({ y: Math.max(0, y - 24), animated: false })} />
        ) : (
          <>
            {missed.review.why ? (
              <Text testID="level-practice-rule" style={[styles.text, { color: colors.text }]}>
                {missed.review.why}
              </Text>
            ) : null}
            {(d?.examples ?? []).map((e) => (
              <Text key={e} style={[styles.example, { color: colors.textMuted }]}>
                {e}
              </Text>
            ))}
          </>
        )}
      </ScrollView>
    </Card>
  ) : null;

  let body;
  if (done) {
    body = (
      <View style={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text testID="level-practice-end" style={[styles.title, { color: colors.text }]}>
            {s.practiceEnd(right, queue.length)}
          </Text>
        </Card>
        <ExamButton testID="level-practice-back" label={s.backToTest} onPress={onExit} />
      </View>
    );
  } else if (result && cur) {
    body = (
      <LevelTestFeedback q={cur.q} topicTitle={topicTitle} ok={result.ok} given={result.given} onNext={next} onRule={onRule} />
    );
  } else if (cur) {
    body = (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {ruleBox && !keyboardOpen ? <View style={styles.rule}>{ruleBox}</View> : null}
        <DockSlotProvider host={dock}>
          <TestQuestionView key={`${index}:${cur.q.id}`} q={cur.q} learnedLang={learnedLang} strictAccents={strictAccents} instant bottomPad={FAB_CLEARANCE} onDone={answered} />
        </DockSlotProvider>
        {dock.node}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {header}
      {!keyboardOpen && <XpChip earned={earned} />}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: spacing.xl },
  flex: { flex: 1 },
  body: { padding: spacing.lg, paddingBottom: FAB_CLEARANCE, gap: spacing.md },
  rule: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  brutalCard: { padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  label: { fontSize: fontSize.sm },
  text: { fontSize: fontSize.sm },
  example: { fontSize: fontSize.sm, fontStyle: 'italic' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  close: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  closeSpacer: { width: fontSize.xl },
  counter: { fontSize: fontSize.sm },
});
