import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, lineHeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { SkinBackdrop } from '@/components/skins/Slots';
import { Card } from '@/components/grammar/Brutal';
import DockedAction, { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';
import ScreenFeedback from '@/lib/screenFeedback';
import ResultBadge from '@/components/ResultBadge';
import SpeakButton from '@/components/SpeakButton';
import LevelCounter from '@/components/practice/LevelCounter';
import { findPcicItem, setPcicTarget, type PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { GRAMMAR_PROGRESS_KEY, doneGrammarTopicProgress } from '@/lib/grammar/syllabus';
import { t } from '@/lib/i18n';
import { pairOf } from '@/lib/languagePair';
import { speechLang } from '@/lib/languages';
import { countLearningToday } from '@/lib/learningDay';
import { resolvedTensesFromLessons } from '@/lib/knownSentence';
import { dropOrphanCards } from '@/lib/pcicSession';
import {
  loadPracticeRound,
  newPracticeRound,
  restorePracticeRound,
  savePracticeRound,
  type PracticeRound,
} from '@/lib/practice/practiceRound';
import { buildReadingSet, readingWordFor, type ReadingSet } from '@/lib/practice/reading';
import { speak, stopSpeaking } from '@/lib/speech';
import { localDateString } from '@/lib/usageStats';

// Beta tab (Settings -> Beta -> Practice tab), spec HAROM-JATEK.md 5: a short text of five sentences with a due
// word each (highlighted, read aloud on request), five questions about it, then a button to the Sentences tab
// for the same words (lib/practice/reading.ts builds the round). The questions give no half and no XP: the
// repetition comes from the sentences. The unfinished round is saved after every step
// (lib/practice/practiceRound.ts) and resumed on the same day.

export default function PracticeScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const { dockLift } = useDockLift();
  const [dockH, setDockH] = useState(DOCK_RESERVE);

  const [loaded, setLoaded] = useState(false);
  const [set, setSet] = useState<ReadingSet | null>(null);
  const [target, setTarget] = useState<PcicTarget>('es');
  // 0 = the text, 1..n = question n, n + 1 = the step that sends the words to the Sentences tab.
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>([]);
  // the local day the shown round was built on (a saved round is only resumed on the same day).
  const [roundDate, setRoundDate] = useState('');
  // the day and direction of the shown round, for the focus effect (its state is stale in the callback); target
  // null: no round on screen, nothing to practice.
  const shownDate = useRef('');
  const shownTarget = useRef<PcicTarget | null>(null);

  // `fresh`: a new round even if one is saved (the "new reading" button).
  const load = useCallback(async (fresh = false) => {
    const db = getDb();
    // The deck of the active direction has to be set before findPcicItem (same as the Learn tab).
    const onboarding = await db.getOnboarding();
    const dir = (onboarding?.target as PcicTarget) ?? 'es';
    setPcicTarget(dir);
    const today = localDateString();
    // A round on screen (running or finished) survives leaving the tab; a new day, another direction or the
    // "new reading" button replaces it. Without it the finished screen would be thrown away.
    if (!fresh && shownTarget.current === dir && shownDate.current === today) return;
    // the last saved round, also when it is replaced: its words go to the end of the new one (FB511)
    const stored = await loadPracticeRound().catch(() => null);
    const saved = fresh ? null : stored;
    const resumed = restorePracticeRound(
      saved,
      today,
      dir,
      (id) => {
        const item = findPcicItem(id);
        return item ? readingWordFor(item, dir) : null;
      },
      findPcicItem,
    );
    let next = resumed?.set ?? null;
    let at = resumed?.step ?? 0;
    let done = resumed?.picks ?? [];
    if (!resumed) {
      const cards = dropOrphanCards(await db.getPcicCards(), (id) => findPcicItem(id) !== undefined);
      const grammarRows = dir === 'es' ? await db.getGameProgress(GRAMMAR_PROGRESS_KEY) : [];
      next = buildReadingSet({
        target: dir,
        cards,
        tenses: resolvedTensesFromLessons(doneGrammarTopicProgress(dir, grammarRows).keys()),
        findItem: findPcicItem,
        today,
        // the button or a new day replaces a round of this direction; a broken round of today is just dropped
        avoid: stored && stored.target === dir && (fresh || stored.date !== today) ? new Set(stored.ids) : undefined,
      });
      at = 0;
      done = next ? next.questions.map(() => null) : [];
      // a new round is saved at once; no round (too few words) clears an old value.
      void savePracticeRound(next ? newPracticeRound(next, dir, today) : null).catch(() => {
        // the round on screen keeps its own state; a failed save only loses the resume point
      });
    }
    setRoundDate(today);
    shownDate.current = today;
    shownTarget.current = next ? dir : null;
    setTarget(dir);
    setSet(next);
    setStep(at);
    setPicks(done);
    setLoaded(true);
  }, []);

  // Leaving the tab stops the read-aloud (the tab stays mounted).
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => stopSpeaking();
    }, [load]),
  );

  const count = set?.questions.length ?? 0;
  const inQuestions = !!set && step >= 1 && step <= count;
  const question = inQuestions ? set!.resolved[step - 1] : undefined;
  const pick = inQuestions ? picks[step - 1] : null;
  const answered = pick !== null && pick !== undefined;

  const persist = (at: number, done: (number | null)[]) => {
    if (!set) return;
    const round: PracticeRound = { v: 2, date: roundDate, target, ids: set.words.map((w) => w.itemId), qs: set.questions, step: at, picks: done };
    void savePracticeRound(round).catch(() => {
      // the round on screen keeps its own state; a failed save only loses the resume point
    });
  };
  const goTo = (at: number) => {
    stopSpeaking();
    setStep(at);
    persist(at, picks);
  };
  const choose = (index: number) => {
    if (!inQuestions || answered) return;
    const next = picks.map((p, i) => (i === step - 1 ? index : p));
    setPicks(next);
    persist(step, next);
    void countLearningToday();
  };
  const readAloud = () => {
    if (!set) return;
    stopSpeaking();
    speak(set.words.map((w) => w.sentence).join(' '), speechLang(target));
  };
  const practiceSentences = () => {
    if (!set) return;
    router.push({ pathname: '/sentences', params: { focus: set.words.map((w) => w.itemId).join(',') } });
  };

  const header = (
    <View style={styles.header}>
      {/* No screen title: the tab navigator's header already says "Practice" (same as the Sentences tab). */}
      <LevelCounter />
      {inQuestions && (
        <Text accessibilityLabel={s.practiceTab.progressLabel(step, count)} style={[styles.progress, { color: colors.tabIconDefault }]}>
          {s.practiceTab.progress(step, count)}
        </Text>
      )}
    </View>
  );

  const shell = (children: ReactNode, dock?: ReactNode) => (
    <View testID="practice-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <SkinBackdrop />
      {header}
      {children}
      {dock}
      <ScreenFeedback
        placement="header"
        level="-"
        languagePair={pairOf(target)}
        currentCard={inQuestions ? `practice:q${step}` : 'practice-reading'}
      />
    </View>
  );
  const dockAction = (testID: string, label: string, onPress: () => void) => (
    <DockedAction testID={testID} label={label} onPress={onPress} tone="next" bottom={dockLift} colors={colors} onHeight={setDockH} />
  );
  const scroll = (children: ReactNode) => (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: dockH + dockLift }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );

  if (!loaded) return shell(null);

  if (!set) {
    return shell(
      <View style={styles.center}>
        <Text testID="practice-empty" style={[styles.emptyText, { color: colors.text }]}>{s.practiceTab.emptyTitle}</Text>
      </View>,
    );
  }

  if (step === 0) {
    return shell(
      scroll(
        <View style={styles.cardMargin}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text testID="practice-text" style={[styles.paragraph, { color: colors.text }]}>
            {set.words.map((w, i) => (
              <Text key={w.itemId}>
                {i > 0 ? ' ' : ''}
                {w.before}
                <Text testID={`practice-word-${i}`} style={[styles.word, { color: colors.tint }]}>{w.answer}</Text>
                {w.after}
              </Text>
            ))}
          </Text>
          <SpeakButton
            testID="practice-speak"
            label={s.practiceTab.readAloud}
            onPress={readAloud}
            style={styles.speakBtn}
            brutalStyle={styles.speakBrutal}
            iconStyle={styles.speakIcon}
            labelStyle={[styles.speakLabel, { color: colors.text }]}
          />
        </Card>
        </View>,
      ),
      dockAction('practice-action', `${s.card.next} →`, () => goTo(1)),
    );
  }

  if (!question) {
    return shell(
      <View style={styles.center}>
        <Text variant="title" style={[styles.doneTitle, { color: colors.text }]}>{s.practiceTab.questionsDone}</Text>
        <Pressable testID="practice-again" accessibilityRole="button" onPress={() => void load(true)} style={styles.link}>
          <Text style={[styles.linkText, { color: colors.tint }]}>{s.practiceTab.newReading}</Text>
        </Pressable>
      </View>,
      dockAction('practice-sentences', s.practiceTab.practiceSentences, practiceSentences),
    );
  }

  const options = question.kind === 'meaning' ? question.options : [s.practiceTab.optionTrue, s.practiceTab.optionFalse];
  const correct = answered && pick === question.correct;
  const explanation = question.kind === 'meaning'
    ? s.practiceTab.rightMeaning(question.word, question.options[question.correct])
    : question.truth ? s.practiceTab.inText : s.practiceTab.notInText;
  return shell(
    scroll(
      <View style={styles.questionBox}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          {question.kind === 'meaning' ? (
            <Text testID="practice-question" style={[styles.question, { color: colors.text }]}>{s.practiceTab.questionMeaning(question.word)}</Text>
          ) : (
            <>
              <Text testID="practice-question" style={[styles.caption, { color: colors.textMuted }]}>{s.practiceTab.questionTrueFalse}</Text>
              <Text testID="practice-statement" style={[styles.question, { color: colors.text }]}>{question.statement}</Text>
            </>
          )}
        </Card>
        <View style={styles.options}>
          {options.map((option, i) => {
            const chosenWrong = answered && pick === i && i !== question.correct;
            const right = answered && i === question.correct;
            const state = right ? s.card.correct : chosenWrong ? s.card.wrong : '';
            return (
              <Pressable
                key={`${step}-${i}`}
                testID={`practice-option-${i}`}
                accessibilityRole="button"
                accessibilityLabel={state ? `${option}, ${state}` : option}
                onPress={() => choose(i)}
                style={[
                  styles.option,
                  g.brutal && styles.brutalEdge,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  right && { backgroundColor: colors.successFill, borderColor: colors.successFill },
                  chosenWrong && { backgroundColor: colors.danger, borderColor: colors.danger },
                ]}
              >
                <Text style={[styles.optionText, { color: chosenWrong ? colors.onTint : colors.text }]}>
                  {right ? '✓ ' : chosenWrong ? '✗ ' : ''}
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {answered && (
          <View style={styles.feedback}>
            <ResultBadge correct={correct} label={correct ? s.card.correct : s.card.wrong} />
            <Text testID="practice-explanation" style={[styles.explanation, { color: colors.text }]}>{explanation}</Text>
          </View>
        )}
      </View>,
    ),
    answered ? dockAction('practice-action', `${s.card.next} →`, () => goTo(step + 1)) : undefined,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  progress: { fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyText: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  doneTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  scroll: { flex: 1 },
  cardMargin: { marginHorizontal: spacing.xl },
  questionBox: { marginHorizontal: spacing.xl, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg },
  brutalCard: { padding: spacing.xl, gap: spacing.lg },
  paragraph: { fontSize: fontSize.xl, lineHeight: 34 },
  word: { fontWeight: '800', textDecorationLine: 'underline' },
  speakBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', minHeight: tapTarget },
  speakBrutal: { alignSelf: 'flex-start' },
  speakIcon: { fontSize: fontSize.xl },
  speakLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  caption: { fontSize: fontSize.sm, textAlign: 'center' },
  question: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center', lineHeight: lineHeight.xl },
  options: { gap: spacing.sm },
  option: { minHeight: tapTarget, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, justifyContent: 'center' },
  brutalEdge: { borderRadius: 0, borderWidth: 2 },
  optionText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  feedback: { gap: spacing.sm },
  explanation: { fontSize: fontSize.md },
  link: { minHeight: tapTarget, justifyContent: 'center', paddingHorizontal: spacing.lg },
  linkText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
