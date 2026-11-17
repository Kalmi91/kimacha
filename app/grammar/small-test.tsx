import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import type { Level } from '@/data/words';
import { getDb } from '@/lib/database';
import { useLearner } from '@/lib/learner';
import { sourceFor } from '@/lib/languagePair';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import { syllabusForLevel, syllabusLevels, hasLesson } from '@/lib/grammar/syllabus';
import { GRAMMAR_RANDOM_KEY, appendEvidence, evidenceFromRows, type TopicEvidence } from '@/lib/grammar/randomRound';
import { questionsOf, type RoundData } from '@/lib/grammar/randomRoundView';
import {
  MINI_CHECK_SIZE,
  SMALL_TEST_SIZE,
  abandonRound,
  beginRound,
  closeRound,
  finishLesson,
  isLevelDone,
  levelProgress,
  loadSmallState,
  openLesson,
  repairSmallRun,
  resolveAnswer,
  roundRight,
  roundRows,
  saveSmallState,
  startRound,
  type RowStatus,
  type SmallCur,
  type SmallState,
} from '@/lib/grammar/smallTest';
import { smallTestView, type SmallView } from '@/lib/grammar/smallTestView';
import { Card } from '@/components/grammar/Brutal';
import { NewKindDrillItem } from '@/components/grammar/NewKinds';
import LevelTestFeedback from '@/components/grammar/LevelTestFeedback';
import { ProgressBar } from '@/components/grammar/Themed';
import TestQuestionView from '@/components/grammar/TestQuestionView';
import ExamButton from '@/components/exam/ExamButton';
import { DockSlotProvider, useDockSlot } from '@/components/learn/DockSlot';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';
import ScreenFeedback from '@/lib/screenFeedback';

// The grammar Small test ("A1 test", route /grammar/small-test?level=a1): 10 adaptive questions per round, the level's
// topics (core first), the engine and the saved run are lib/grammar/smallTest.ts. Screens: the round start (topic list with
// new / repeat), the questions (the level test's question cards; the four typed kinds use the drill components), the stop
// after a topic's repeated misses (lesson, then a 3-question check), the end of the round. Every wrong answer has an "I
// mistyped" button (counts as right). Every settled main question is written as the level test writes it: the topic's
// evidence in GRAMMAR_RANDOM_KEY, which is what the lesson row's percent and tick read. The quick check is not written.
// The run is saved after every step (resume store), so leaving with the X continues on the same question.

interface Result {
  cur: SmallCur;
  ok: boolean;
  given?: string;
}

const STATUS_COLOR: Record<RowStatus, 'success' | 'warning' | 'danger'> = { learned: 'success', more: 'warning', lesson: 'danger' };

export default function SmallTestScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().smallTest;
  const router = useRouter();
  const params = useLocalSearchParams<{ level?: string }>();
  const { strictAccents, refresh } = useLearner();
  const dock = useDockSlot(colors);

  const [data, setData] = useState<RoundData | null>(null);
  const [view, setView] = useState<SmallView | null>(null);
  const [level, setLevel] = useState<Level>('A1');
  const [st, setSt] = useState<SmallState | null>(null);
  const [empty, setEmpty] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const stRef = useRef<SmallState | null>(null);
  const viewRef = useRef<SmallView | null>(null);
  const evRef = useRef<Map<string, TopicEvidence>>(new Map());
  const pairRef = useRef('');
  const levelRef = useRef<Level>('A1');
  const seedRef = useRef(0);
  const away = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((job: () => Promise<void>) => {
    queue.current = queue.current.then(job).catch(() => {});
  }, []);

  const commit = useCallback(
    (next: SmallState) => {
      stRef.current = next;
      setSt(next);
      enqueue(async () => void (await saveSmallState(getDb(), pairRef.current, levelRef.current, next)));
    },
    [enqueue],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const db = getDb();
      const { target, source } = await refresh(['direction', 'strictAccents']);
      const levels = syllabusLevels(target);
      const userLevel = (await db.getLevel()).level;
      const wanted = levels.find((l) => l.toLowerCase() === String(params.level ?? '').toLowerCase());
      const lvl: Level = wanted ?? (levels.includes(userLevel as Level) ? (userLevel as Level) : levels[0]);
      const d: RoundData = {
        learnedLang: target,
        contentLang: sourceFor(target, source),
        userLevel,
        levels,
        startLevel: lvl,
        topics: syllabusForLevel(lvl, target).filter((tp) => hasLesson(target, tp.id)),
        cache: { seed: -1, map: new Map() },
      };
      const seed = Date.now() % 2147483647;
      const v = smallTestView(d, seed, lvl);
      const ev = evidenceFromRows(await db.getGameProgress(GRAMMAR_RANDOM_KEY));
      const pair = `${d.contentLang}→${d.learnedLang}`;
      let state = await loadSmallState(db, pair, lvl);
      if (!alive) return;
      if (v.topics.every((tp) => v.pool(tp.id).length === 0)) {
        setEmpty(true);
        setData(d);
        return;
      }
      if (state.run) state = repairSmallRun(state, v.pool);
      if (!state.run) state = startRound(state, v.topics, v.pool, seed);
      else if (state.run.phase === 'lesson') state = finishLesson(state, v.pool);
      pairRef.current = pair;
      levelRef.current = lvl;
      seedRef.current = seed;
      viewRef.current = v;
      evRef.current = ev;
      stRef.current = state;
      enqueue(async () => void (await saveSmallState(db, pair, lvl, state)));
      setLevel(lvl);
      setView(v);
      setSt(state);
      setData(d);
    })().catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the load runs once per visit
  }, []);

  // back from the lesson (the route stays on the stack under it): the quick check starts
  useFocusEffect(
    useCallback(() => {
      if (away.current) {
        away.current = false;
        const cur = stRef.current;
        if (cur && viewRef.current && cur.run?.phase === 'lesson') commit(finishLesson(cur, viewRef.current.pool));
      }
      return () => {
        if (stRef.current?.run?.phase === 'lesson') away.current = true;
      };
    }, [commit]),
  );

  const shell = (children: ReactNode) => <View style={[styles.screen, { backgroundColor: colors.background }]}>{children}</View>;

  // the loading spinner never traps the learner: the X is there too
  const waiting = () =>
    shell(
      <View style={styles.flex}>
        <View style={styles.header}>
          <Pressable testID="small-test-close" accessibilityRole="button" accessibilityLabel={s.leave} hitSlop={12} onPress={() => router.back()}>
            <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
          </Pressable>
        </View>
        <ActivityIndicator style={styles.flex} color={colors.tint} />
      </View>,
    );

  if (empty) {
    return shell(
      <View style={styles.flex}>
        <View style={styles.header}>
          <Pressable testID="small-test-close" accessibilityRole="button" accessibilityLabel={s.leave} hitSlop={12} onPress={() => router.back()}>
            <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
          </Pressable>
        </View>
        <Text testID="small-test-empty" style={[styles.line, { color: colors.text, padding: spacing.lg }]}>{s.empty}</Text>
      </View>,
    );
  }
  if (!data || !view || !st || !st.run) return waiting();

  const run = st.run;
  const pair = `${data.contentLang}→${data.learnedLang}`;
  const titleOf = (id: string) => {
    const tp = data.topics.find((x) => x.id === id);
    return tp ? tp.title[data.contentLang] ?? tp.title.en : id;
  };
  const inMini = run.phase === 'mini';

  const headerText =
    run.phase === 'ask'
      ? s.header(level, run.answers.length + 1, SMALL_TEST_SIZE)
      : run.phase === 'mini'
        ? s.miniHeader((run.mini?.answers.length ?? 0) + 1, MINI_CHECK_SIZE)
        : run.phase === 'stop' || run.phase === 'lesson'
          ? s.header(level, run.answers.length, SMALL_TEST_SIZE)
          : s.headerRound(level, run.round);
  const headerFor = (part: string) => (
    <View style={styles.header}>
      <Pressable testID="small-test-close" accessibilityRole="button" accessibilityLabel={s.leave} hitSlop={12} onPress={() => router.back()}>
        <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
      </Pressable>
      <Text testID="small-test-header" style={[styles.counter, { color: colors.textMuted }]}>{headerText}</Text>
      <ScreenFeedback placement="inline" level={data.userLevel} languagePair={pair} currentCard={`grammar-small-test:${level}:${part}`} />
    </View>
  );
  const progressPct = run.phase === 'end' || run.phase === 'intro' ? (run.phase === 'end' ? 100 : 0) : (run.answers.length / SMALL_TEST_SIZE) * 100;
  const progress = (
    <ProgressBar
      testID="small-test-progress"
      continuous
      trackProps={{ testID: 'small-test-progress' }}
      fillProps={{ testID: 'small-test-progress-fill' }}
      pct={progressPct}
      brutalStyle={styles.brutalProgress}
      trackStyle={styles.track}
      trackColor={colors.card}
      fillStyle={styles.fill}
      fillColor={colors.tint}
    />
  );

  // ---------------------------------------------------------------- settling an answer
  const settle = (ok: boolean, mistyped = false) => {
    const cur = stRef.current?.run?.current;
    const v = viewRef.current;
    if (!cur || !v || !stRef.current) return;
    if (cur.role !== 'mini') {
      const found = v.find(cur.topic, cur.qid);
      const kind = found?.q?.kind ?? found?.item?.kind;
      if (kind) {
        const topicEvidence = appendEvidence(
          evRef.current.get(cur.topic),
          { id: cur.qid, kind, ok, at: localDateString() },
          undefined,
          questionsOf(data, seedRef.current, cur.topic).map((x) => x.id),
        );
        evRef.current = new Map(evRef.current).set(cur.topic, topicEvidence);
        enqueue(() => getDb().setGameProgress(GRAMMAR_RANDOM_KEY, cur.topic, 'evidence', topicEvidence));
      }
    }
    Keyboard.dismiss();
    setResult(null);
    commit(resolveAnswer(stRef.current, v.pool, ok, mistyped));
  };

  // ---------------------------------------------------------------- 1. the round start
  if (run.phase === 'intro') {
    return shell(
      <View style={styles.flex}>
        {headerFor('intro')}
        {progress}
        <ScrollView testID="small-test-intro" contentContainerStyle={styles.body}>
          <Text testID="small-test-intro-title" style={[styles.title, { color: colors.text }]}>{s.introTitle(SMALL_TEST_SIZE)}</Text>
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            <Text style={[styles.rowsTitle, { color: colors.textMuted }]}>{s.introTopics}</Text>
            {run.topics.map((tp) => (
              <View key={tp.id} testID={`small-test-intro-topic-${tp.id}`} style={styles.topicRow}>
                <Text style={[styles.topicName, { color: colors.text }]} numberOfLines={2}>{titleOf(tp.id)}</Text>
                <Text
                  testID={`small-test-intro-tag-${tp.id}`}
                  style={[styles.tag, tp.isNew ? { color: colors.tint, fontWeight: fontWeight.bold } : { color: colors.textMuted }]}
                >
                  {tp.isNew ? s.tagNew : s.tagRepeat}
                </Text>
              </View>
            ))}
          </Card>
          <Text style={[styles.note, { color: colors.textMuted }]}>{s.introNote}</Text>
          <ExamButton testID="small-test-start" label={s.start} onPress={() => commit(beginRound(st, view.pool))} />
        </ScrollView>
      </View>,
    );
  }

  // ---------------------------------------------------------------- 2. the stop
  if (run.phase === 'stop' || run.phase === 'lesson') {
    const topic = run.stopTopic ?? '';
    return shell(
      <View style={styles.flex}>
        {headerFor('stop')}
        {progress}
        <ScrollView testID="small-test-stop" contentContainerStyle={styles.body}>
          <Text testID="small-test-stop-title" style={[styles.title, { color: colors.text }]}>{s.stopTitle}</Text>
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            <Text testID="small-test-stop-misses" style={[styles.misses, { color: colors.danger }]}>{s.stopMisses(3)}</Text>
            <Text testID="small-test-stop-topic" style={[styles.topicHead, { color: colors.text }]}>{titleOf(topic)}</Text>
            <Text style={[styles.line, { color: colors.textMuted }]}>{s.stopNeeds}</Text>
          </Card>
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            <Text style={[styles.step, { color: colors.text }]}>📖 {s.stepRead}</Text>
            <Text style={[styles.step, { color: colors.text }]}>✏️ {s.stepPractise}</Text>
            <Text style={[styles.step, { color: colors.text }]}>✅ {s.stepCheck(MINI_CHECK_SIZE)}</Text>
          </Card>
          <Text testID="small-test-stop-then" style={[styles.note, { color: colors.textMuted }]}>
            {run.answers.length >= SMALL_TEST_SIZE ? s.stopThenEnd : s.stopThen(run.answers.length + 1)}
          </Text>
          <ExamButton
            testID="small-test-stop-open"
            label={s.openLesson}
            onPress={() => {
              commit(openLesson(st));
              router.push(`/grammar/${topic}` as never);
            }}
          />
          <ExamButton
            testID="small-test-stop-later"
            secondary
            label={s.endLater}
            onPress={() => {
              commit(abandonRound(st));
              router.back();
            }}
          />
        </ScrollView>
      </View>,
    );
  }

  // ---------------------------------------------------------------- 3. the end of the round
  if (run.phase === 'end') {
    const rows = roundRows(st);
    const right = roundRight(run);
    const prog = levelProgress(st, view.coreIds);
    const label = (r: RowStatus) => (r === 'learned' ? s.statusLearned : r === 'lesson' ? s.statusLesson : s.statusMore);
    return shell(
      <View style={styles.flex}>
        {headerFor('end')}
        {progress}
        <ScrollView testID="small-test-end" contentContainerStyle={styles.body}>
          <Text testID="small-test-end-title" style={[styles.title, { color: colors.text }]}>{s.endTitle(right, run.answers.length)}</Text>
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            {rows.map((r) => (
              <Pressable
                key={r.id}
                testID={`small-test-end-topic-${r.id}`}
                accessibilityRole="button"
                accessibilityLabel={s.topicRowLabel(titleOf(r.id), label(r.status))}
                style={styles.topicRow}
                onPress={r.status === 'lesson' ? () => router.push(`/grammar/${r.id}` as never) : undefined}
              >
                <Text style={[styles.topicName, { color: colors.text }]} numberOfLines={2}>{titleOf(r.id)}</Text>
                <Text testID={`small-test-end-status-${r.id}`} style={[styles.status, { color: colors[STATUS_COLOR[r.status]] }]}>{label(r.status)}</Text>
              </Pressable>
            ))}
          </Card>
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            <Text testID="small-test-end-level" style={[styles.line, { color: colors.text }]}>{s.levelLine(level, prog.learned, prog.total)}</Text>
            <ProgressBar
              testID="small-test-end-level-bar"
              continuous
              trackProps={{ testID: 'small-test-end-level-bar' }}
              fillProps={{ testID: 'small-test-end-level-fill' }}
              pct={prog.total ? (prog.learned / prog.total) * 100 : 0}
              brutalStyle={styles.brutalProgress}
              trackStyle={styles.levelTrack}
              trackColor={colors.card}
              fillStyle={styles.fill}
              fillColor={colors.success}
            />
            {isLevelDone(st, view.coreIds) ? <Text testID="small-test-end-level-done" style={[styles.line, { color: colors.success }]}>{s.levelDone(level)}</Text> : null}
          </Card>
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            <Text style={[styles.rowsTitle, { color: colors.textMuted }]}>{s.yourRounds}</Text>
            <View testID="small-test-end-chart" style={styles.chart}>
              {st.history.map((pct, i) => (
                <View key={i} style={styles.barCol}>
                  <Text style={[styles.barLabel, { color: colors.textMuted }]}>{s.barLabel(pct)}</Text>
                  <View
                    testID={`small-test-end-bar-${i}`}
                    accessibilityLabel={s.barLabel(pct)}
                    style={[styles.bar, { height: Math.max(4, pct * 0.6), backgroundColor: i === st.history.length - 1 ? colors.tint : colors.border }]}
                  />
                </View>
              ))}
            </View>
          </Card>
          <ExamButton
            testID="small-test-end-new"
            label={s.newRound}
            onPress={() => commit(startRound(closeRound(st), view.topics, view.pool, (Date.now() + st.rounds * 7919) % 2147483647))}
          />
          <ExamButton
            testID="small-test-end-done"
            secondary
            label={s.done}
            onPress={() => {
              commit(closeRound(st));
              router.back();
            }}
          />
        </ScrollView>
      </View>,
    );
  }

  // ---------------------------------------------------------------- the questions (round and quick check)
  const cur = run.current;
  const found = cur ? view.find(cur.topic, cur.qid) : null;
  if (!cur || !found) return waiting();
  const part = `${inMini ? 'mini:' : ''}${cur.qid}`;
  const mistypedButton = (
    <ExamButton testID="small-test-mistyped" secondary label={s.mistyped} onPress={() => settle(true, true)} />
  );

  // the answer is in: the level test's result card (a typed kind shows its own, then a short card for a miss)
  if (result) {
    if (found.q) {
      return shell(
        <View style={styles.flex}>
          {headerFor(part)}
          {progress}
          {!result.ok ? <View style={styles.mistypedBar}>{mistypedButton}</View> : null}
          <LevelTestFeedback
            q={found.q}
            topicTitle={titleOf(cur.topic)}
            ok={result.ok}
            given={result.given}
            onNext={() => settle(result.ok)}
            onRule={() => router.push(`/grammar/${cur.topic}` as never)}
          />
        </View>,
      );
    }
    return shell(
      <View style={styles.flex}>
        {headerFor(part)}
        {progress}
        <View testID="small-test-miss" style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>{s.missTitle}</Text>
          <Text style={[styles.line, { color: colors.textMuted }]}>{titleOf(cur.topic)}</Text>
          {mistypedButton}
          <ExamButton testID="small-test-miss-next" label={s.next} onPress={() => settle(false)} />
        </View>
      </View>,
    );
  }

  return shell(
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {headerFor(part)}
      {progress}
      <View testID="small-test-question" style={styles.flex} accessibilityLabel={s.progressLabel(run.answers.length + 1, SMALL_TEST_SIZE)}>
        <DockSlotProvider host={dock}>
          {found.q ? (
            <TestQuestionView
              key={`${run.answers.length}:${part}`}
              q={found.q}
              learnedLang={data.learnedLang}
              strictAccents={strictAccents}
              instant
              onDone={(ok, given) => setResult({ cur, ok, given })}
            />
          ) : (
            <ScrollView contentContainerStyle={styles.drill} keyboardShouldPersistTaps="handled">
              <NewKindDrillItem
                key={`${run.answers.length}:${part}`}
                item={found.item!}
                learnedLang={data.learnedLang}
                contentLang={data.contentLang as never}
                strictAccents={strictAccents}
                onDone={(ok) => (ok ? settle(true) : setResult({ cur, ok: false }))}
              />
            </ScrollView>
          )}
        </DockSlotProvider>
      </View>
      {dock.node}
    </KeyboardAvoidingView>,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: spacing.xl },
  flex: { flex: 1 },
  body: { padding: spacing.lg, paddingBottom: FAB_CLEARANCE, gap: spacing.md },
  drill: { padding: spacing.lg, paddingBottom: FAB_CLEARANCE },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  line: { fontSize: fontSize.md, textAlign: 'center' },
  note: { fontSize: fontSize.sm, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  close: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  counter: { fontSize: fontSize.sm },
  track: { height: 8, borderRadius: radius.xs, marginHorizontal: spacing.lg, marginTop: spacing.sm, overflow: 'hidden' },
  levelTrack: { height: 8, borderRadius: radius.xs, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.xs },
  brutalProgress: { marginHorizontal: spacing.lg, marginTop: spacing.sm },
  rowsTitle: { fontSize: fontSize.sm },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  topicName: { flex: 1, fontSize: fontSize.md },
  tag: { fontSize: fontSize.sm, minWidth: 72, textAlign: 'right' },
  status: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'right' },
  misses: { fontSize: fontSize.md, fontWeight: fontWeight.bold, textAlign: 'center' },
  topicHead: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  step: { fontSize: fontSize.md },
  mistypedBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, minHeight: 90 },
  barCol: { alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  bar: { width: 22, borderRadius: radius.xs },
  barLabel: { fontSize: 10 },
});
