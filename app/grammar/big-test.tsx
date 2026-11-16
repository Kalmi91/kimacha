import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, lineHeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { getDb } from '@/lib/database';
import { useLearner } from '@/lib/learner';
import { sourceFor } from '@/lib/languagePair';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import {
  BIG_TEST_LEVELS,
  BIG_TEST_PASS,
  BIG_TEST_PER_LEVEL,
  BIG_TEST_TOTAL,
  answerBigTest,
  bigTestItems,
  bigTestLevelPassed,
  bigTestLevelScore,
  bigTestResult,
  continueBigTest,
  finishBigTest,
  hasBigTest,
  loadBigTestResult,
  loadBigTestRun,
  markBigTestMistyped,
  newBigTestRun,
  nextBigTest,
  saveBigTestRun,
  type BigTestItem,
  type BigTestResult,
  type BigTestRun,
} from '@/lib/grammar/bigTest';
import { hasLesson, syllabusTopic } from '@/lib/grammar/syllabus';
import { Card } from '@/components/grammar/Brutal';
import { ProgressBar, themedEdgeStyle } from '@/components/grammar/Themed';
import ExamButton from '@/components/exam/ExamButton';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';
import ScreenFeedback from '@/lib/screenFeedback';

// The grammar Big test (placement test, 45 questions A1 to C1, logic in lib/grammar/bigTest.ts). It measures and does not
// teach: a tap on an option locks it and shows the right one, with no explanation, and Next moves on. The run is saved in
// the resume store after every step, so the ✕ leaves at once and the next visit lands on the same question (an app kill
// too). Without ?new=1 a run in progress resumes, else the stored result shows, else a new run starts. Nothing here
// writes grammar evidence: the test must not move the level percent of any lesson.

// A quick double tap on Next lands on the next question, where "I don't know" sits under the same thumb; for this long
// after a question appears a tap on its options or "I don't know" records nothing, so one stray tap cannot write an answer.
const TAP_GUARD_MS = 500;
const armTapGuard = (until: { current: number }) => {
  until.current = Date.now() + TAP_GUARD_MS;
};
const tapGuardOpen = (until: { current: number }) => Date.now() >= until.current;

export default function BigTestScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t().bigTest;
  const router = useRouter();
  const params = useLocalSearchParams<{ new?: string }>();
  const { refresh } = useLearner();

  const [ctx, setCtx] = useState<{ learnedLang: string; contentLang: string; userLevel: string } | null>(null);
  const [run, setRun] = useState<BigTestRun | null>(null);
  const [stored, setStored] = useState<BigTestResult | null>(null);
  // the saves run one after the other, in the order of the steps.
  const tapGuardUntil = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((job: () => Promise<void>) => {
    queue.current = queue.current.then(job).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const db = getDb();
      const { target, source } = await refresh(['direction']);
      if (!hasBigTest(target)) {
        router.back();
        return;
      }
      const userLevel = (await db.getLevel()).level;
      const contentLang = sourceFor(target, source);
      const pair = `${contentLang}→${target}`;
      const fresh = params.new === '1';
      const resumed = fresh ? null : await loadBigTestRun(db, pair, target);
      const result = await loadBigTestResult(db, pair);
      if (!alive) return;
      let current = resumed;
      if (!current && (fresh || !result)) {
        current = newBigTestRun();
        await saveBigTestRun(db, pair, current);
      }
      if (!alive) return;
      setCtx({ learnedLang: target, contentLang, userLevel });
      setStored(result);
      setRun(current);
    })().catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the load runs once per visit
  }, []);

  const shell = (children: ReactNode) => <View style={[styles.screen, { backgroundColor: colors.background }]}>{children}</View>;
  if (!ctx) return shell(<ActivityIndicator style={styles.flex} color={colors.tint} />);

  const pair = `${ctx.contentLang}→${ctx.learnedLang}`;
  // the screen shows the stored result when there is no run (the card's "Last result" line opens it)
  const result: BigTestResult | null = run?.phase === 'result' ? bigTestResult(run) : run ? null : stored;
  const level = run ? BIG_TEST_LEVELS[run.levelIdx] : null;
  const item: BigTestItem | undefined = run && level && (run.phase === 'question' || run.phase === 'answered') ? bigTestItems(ctx.learnedLang, level)[run.pos] : undefined;

  const step = (next: BigTestRun) => {
    if (next.phase === 'question') armTapGuard(tapGuardUntil);
    setRun(next);
    enqueue(() => saveBigTestRun(getDb(), pair, next));
  };
  const guarded = (act: () => void) => {
    if (tapGuardOpen(tapGuardUntil)) act();
  };
  const restart = () => step(newBigTestRun());

  const titleOf = (id: string) => {
    const tp = syllabusTopic(id, ctx.learnedLang);
    return tp ? tp.title[ctx.contentLang] ?? tp.title.en : id;
  };

  const feedback = (card: string) => (
    <ScreenFeedback placement="inline" level={ctx.userLevel} languagePair={pair} currentCard={card} />
  );
  const header = (card: string, counter: string | null) => (
    <View style={styles.header}>
      <Pressable testID="big-test-close" accessibilityRole="button" accessibilityLabel={s.leave} hitSlop={12} onPress={() => router.back()}>
        <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
      </Pressable>
      <Text testID="big-test-header" style={[styles.counter, { color: colors.textMuted }]}>{counter ?? ''}</Text>
      {feedback(card)}
    </View>
  );
  const bar = (pct: number, label: string, testID?: string) => (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} testID={testID}>
      <ProgressBar
        continuous
        pct={pct}
        brutalStyle={styles.brutalProgress}
        trackStyle={styles.track}
        trackColor={colors.card}
        fillStyle={styles.fill}
        fillColor={colors.tint}
      />
    </View>
  );

  // State D: the result
  if (result) {
    return shell(
      <View style={styles.flex}>
        {header('grammar-big-test:result', null)}
        <ScrollView testID="big-test-scroll" contentContainerStyle={styles.body}>
          <Text testID="big-test-result-level" style={[styles.title, { color: colors.text }]}>{s.yourLevel(result.level)}</Text>
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            {result.perLevel.map((row) => (
              <View
                key={row.level}
                testID={`big-test-level-row-${row.level}`}
                accessible
                accessibilityLabel={row.taken ? s.levelRowLabel(row.level, row.right, row.total) : s.levelRowSkipped(row.level)}
                style={[styles.levelRow, !row.taken && styles.muted]}
              >
                <Text style={[styles.levelName, { color: row.taken ? colors.text : colors.textMuted }]}>{row.level}</Text>
                <View style={styles.flex}>
                  <ProgressBar
                    continuous
                    pct={row.taken ? (row.right / row.total) * 100 : 0}
                    brutalStyle={styles.rowBrutalBar}
                    trackStyle={styles.rowTrack}
                    trackColor={colors.card}
                    fillStyle={styles.fill}
                    fillColor={row.right >= BIG_TEST_PASS ? colors.success : colors.tint}
                  />
                </View>
                <Text style={[styles.levelScore, { color: row.taken ? colors.text : colors.textMuted }]}>{row.taken ? `${row.right}/${row.total}` : '–'}</Text>
              </View>
            ))}
          </Card>
          {result.needsPractice.length > 0 ? (
            <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{s.needsPractice}</Text>
              {result.needsPractice.map((id) => (
                <View key={id} testID={`big-test-practice-${id}`} style={styles.topicRow}>
                  <Text style={[styles.topicName, { color: colors.danger }]} numberOfLines={2}>{titleOf(id)}</Text>
                  {hasLesson(ctx.learnedLang, id) ? (
                    <Pressable
                      testID={`big-test-lesson-${id}`}
                      accessibilityRole="button"
                      accessibilityLabel={s.lessonLabel(titleOf(id))}
                      style={[styles.lessonButton, themedEdgeStyle(g), { borderColor: colors.border, backgroundColor: colors.card }]}
                      onPress={() => router.push(`/grammar/${id}` as never)}
                    >
                      <Text style={[styles.lessonLabel, { color: colors.text }]}>{s.lesson}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </Card>
          ) : null}
          {result.strong.length > 0 ? (
            <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{s.strong}</Text>
              {result.strong.map((id) => (
                <Text key={id} testID={`big-test-strong-${id}`} style={[styles.strongName, { color: colors.text }]}>{titleOf(id)}</Text>
              ))}
            </Card>
          ) : null}
          <ExamButton testID="big-test-restart" label={s.startAgain} onPress={restart} />
          <ExamButton testID="big-test-done" secondary label={s.done} onPress={() => router.back()} />
        </ScrollView>
      </View>
    );
  }

  if (!run || !level) return shell(<ActivityIndicator style={styles.flex} color={colors.tint} />);

  // State C: the end of a level
  if (run.phase === 'levelEnd') {
    const score = bigTestLevelScore(run, level);
    const passed = bigTestLevelPassed(run, level);
    const nextLevel = BIG_TEST_LEVELS[run.levelIdx + 1];
    return shell(
      <View style={styles.flex}>
        {header(`grammar-big-test:level-end:${level}`, s.header(level, (run.levelIdx + 1) * BIG_TEST_PER_LEVEL, BIG_TEST_TOTAL))}
        <ScrollView testID="big-test-scroll" contentContainerStyle={styles.body}>
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            <Text testID="big-test-level-title" style={[styles.title, { color: colors.text }]}>
              {passed ? s.passedTitle(level, score.right, BIG_TEST_PER_LEVEL) : s.failedTitle(level, score.right, BIG_TEST_PER_LEVEL)}
            </Text>
            {bar((score.right / BIG_TEST_PER_LEVEL) * 100, s.levelRowLabel(level, score.right, BIG_TEST_PER_LEVEL))}
            {passed && nextLevel ? (
              <Text testID="big-test-next-level" style={[styles.line, { color: colors.textMuted }]}>{s.nextLevel(nextLevel, BIG_TEST_PER_LEVEL)}</Text>
            ) : null}
            {!passed ? <Text testID="big-test-ends" style={[styles.line, { color: colors.textMuted }]}>{s.testEnds}</Text> : null}
          </Card>
          {passed && nextLevel ? (
            <>
              <ExamButton testID="big-test-continue" label={s.continue} onPress={() => step(continueBigTest(run))} />
              <ExamButton testID="big-test-stop" secondary label={s.stopHere} onPress={() => step(finishBigTest(run))} />
            </>
          ) : (
            <ExamButton testID="big-test-see-result" label={s.seeResult} onPress={() => step(finishBigTest(run))} />
          )}
        </ScrollView>
      </View>
    );
  }

  if (!item) return shell(<ActivityIndicator style={styles.flex} color={colors.tint} />);

  // States A and B: a question, then the same screen with the options locked
  const n = run.levelIdx * BIG_TEST_PER_LEVEL + run.pos + 1;
  const answered = run.phase === 'answered';
  const last = run.answers[run.answers.length - 1];
  const picked = answered ? last.picked : null;
  const options =
    item.kind === 'which' ? [s.whichFirst, s.whichSecond, s.whichBoth, s.whichNeither] : item.options;
  const instruction = item.kind === 'gap' ? s.instructionGap : item.kind === 'which' ? s.instructionWhich : s.instructionRegister;
  const lines = item.kind === 'gap' ? item.lines : item.kind === 'which' ? item.lines.map((l, i) => `(${i + 1}) ${l}`) : [];
  const canMistype = answered && !last.right && last.picked !== null;

  return shell(
    <View style={styles.flex}>
      {header(`grammar-big-test:${level}:${item.id}`, s.header(level, n, BIG_TEST_TOTAL))}
      {bar((n / BIG_TEST_TOTAL) * 100, s.progressLabel(n, BIG_TEST_TOTAL), 'big-test-progress')}
      <ScrollView testID="big-test-scroll" contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text testID="big-test-instruction" style={[styles.instruction, { color: colors.textMuted }]}>{instruction}</Text>
          {lines.map((line, i) => (
            <Text key={i} testID={`big-test-line-${i}`} style={[styles.text, { color: colors.text }]}>{line}</Text>
          ))}
        </Card>
        <View style={styles.options}>
          {options.map((option, i) => {
            const right = answered && i === item.correct;
            const wrong = answered && picked === i && i !== item.correct;
            return (
              <Pressable
                key={`${i}-${option}`}
                testID={`big-test-option-${i}`}
                accessibilityRole="button"
                accessibilityLabel={s.optionLabel(i + 1, option)}
                accessibilityState={{ disabled: answered }}
                disabled={answered}
                onPress={() => guarded(() => step(answerBigTest(run, item, i)))}
                style={[
                  styles.option,
                  themedEdgeStyle(g),
                  { backgroundColor: colors.card, borderColor: colors.border },
                  right && { backgroundColor: colors.successFill, borderColor: colors.successFill },
                  wrong && { backgroundColor: colors.danger, borderColor: colors.danger },
                ]}
              >
                <Text style={[styles.optionText, { color: wrong ? colors.onTint : colors.text }]}>
                  {right ? '✓ ' : wrong ? '✗ ' : ''}
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!answered ? (
          <Pressable
            testID="big-test-idk"
            accessibilityRole="button"
            accessibilityLabel={s.dontKnow}
            style={[styles.idk, { borderColor: colors.border }]}
            onPress={() => guarded(() => step(answerBigTest(run, item, null)))}
          >
            <Text style={[styles.idkText, { color: colors.textMuted }]}>{s.dontKnow}</Text>
          </Pressable>
        ) : (
          <View style={styles.actions}>
            {canMistype ? (
              <View style={styles.flex}>
                <ExamButton testID="big-test-mistyped" secondary label={s.mistyped} onPress={() => step(markBigTestMistyped(run))} />
              </View>
            ) : null}
            <View style={styles.flex}>
              <ExamButton testID="big-test-next" label={s.next} onPress={() => step(nextBigTest(run))} />
            </View>
          </View>
        )}
        {answered && last.mistyped ? (
          <Text testID="big-test-mistyped-done" style={[styles.line, { color: colors.success }]}>{s.countedRight}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: spacing.xl },
  flex: { flex: 1 },
  body: { padding: spacing.lg, paddingBottom: FAB_CLEARANCE, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  line: { fontSize: fontSize.md, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  close: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  counter: { fontSize: fontSize.sm },
  track: { height: 8, borderRadius: radius.xs, marginHorizontal: spacing.lg, marginTop: spacing.sm, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.xs },
  brutalProgress: { marginHorizontal: spacing.lg, marginTop: spacing.sm },
  instruction: { fontSize: fontSize.sm, textAlign: 'center' },
  text: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, textAlign: 'center', lineHeight: lineHeight.lg },
  options: { gap: spacing.sm },
  option: {
    minHeight: tapTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  optionText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  idk: {
    minHeight: tapTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idkText: { fontSize: fontSize.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: tapTarget },
  muted: { opacity: 0.6 },
  levelName: { width: 32, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  levelScore: { minWidth: 36, textAlign: 'right', fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  rowTrack: { height: 8, borderRadius: radius.xs, overflow: 'hidden' },
  rowBrutalBar: { marginTop: 0 },
  sectionTitle: { fontSize: fontSize.sm },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: tapTarget },
  topicName: { flex: 1, fontSize: fontSize.md },
  strongName: { fontSize: fontSize.md },
  lessonButton: { minHeight: tapTarget, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, justifyContent: 'center' },
  lessonLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
