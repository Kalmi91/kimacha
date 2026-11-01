import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import type { Level } from '@/data/words';
import { getDb } from '@/lib/database';
import { useLearner } from '@/lib/learner';
import { sourceFor } from '@/lib/languagePair';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { localDateString } from '@/lib/usageStats';
import { buildLessonTest, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import {
  getGrammarTier,
  hasLesson,
  lessonFor,
  syllabusForLevel,
  syllabusLevels,
  type SyllabusTopic,
} from '@/lib/grammar/syllabus';
import {
  GRAMMAR_RANDOM_KEY,
  META_ITEM_ID,
  PRACTICE_SIZE,
  RUN_ITEM_ID,
  appendEvidence,
  currentPhase,
  evidenceFromRows,
  ladderLevel,
  metaFromRows,
  newRun,
  nextMode,
  phaseProgress,
  pickNext,
  recordAnswer,
  runFromRows,
  skipPhase,
  topicPercent,
  topicTicked,
  type AskPhase,
  type EvidenceAnswer,
  type PickCtx,
  type RandomMeta,
  type RoundMode,
  type RoundRun,
  type RoundStep,
  type TopicEvidence,
} from '@/lib/grammar/randomRound';
import { Card } from '@/components/grammar/Brutal';
import { ProgressBar, themedEdgeStyle } from '@/components/grammar/Themed';
import TestQuestionView from '@/components/grammar/TestQuestionView';
import ResultBadge from '@/components/ResultBadge';
import ExamButton from '@/components/exam/ExamButton';
import { DockSlotProvider, useDockSlot } from '@/components/learn/DockSlot';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';
import ScreenFeedback from '@/lib/screenFeedback';

// The random grammar round (Grammar tab): a mixed round (10 check questions on a level ladder -> the
// check result with the weak topics -> 8 practice questions with an explanation after each -> one re-check
// question per weak topic) or a full round (20 questions over the whole syllabus). The engine
// (lib/grammar/randomRound.ts) picks and scores; this screen only draws, saves every answer as evidence
// and keeps the open round (`_run`) so it can be continued. Check / re-check / full run exam-style (a right
// answer shows nothing, a wrong one shows the right one), the explanations come in the practice.

type RoundStrings = ReturnType<typeof t>['randomRound'];

interface RoundData {
  learnedLang: string;
  contentLang: string;
  /** The user's level as stored: the 💬 (FeedbackModal) writes this into the Feedback sheet. */
  userLevel: string;
  /** The syllabus levels of the learned language, in order. */
  levels: Level[];
  startLevel: Level;
  /** The written lessons, in syllabus order. */
  topics: SyllabusTopic[];
  /** The questions built so far (lazily, per topic). */
  cache: QuestionCache;
}

/** The question cache of one round: the seed fixes the option order, so a new seed (a new round) empties it. */
interface QuestionCache {
  seed: number;
  map: Map<string, LessonTestQuestion[]>;
}

/** The practice feedback card: shown after an answer of the practice phase. */
interface Feedback {
  q: LessonTestQuestion;
  ok: boolean;
  topicId: string;
  index: number;
  of: number;
}

// All usable questions of a topic, built lazily. A match card is left out (one card = many answers).
function questionsOf(d: RoundData, seed: number, topicId: string): LessonTestQuestion[] {
  const cache = d.cache;
  if (cache.seed !== seed) {
    cache.seed = seed;
    cache.map = new Map();
  }
  let qs = cache.map.get(topicId);
  if (!qs) {
    const lesson = lessonFor(d.learnedLang, topicId);
    qs = lesson
      ? buildLessonTest(lesson, { seed, learnedLang: d.learnedLang, contentLang: d.contentLang, size: 9999 }).filter((q) => q.kind !== 'match')
      : [];
    cache.map.set(topicId, qs);
  }
  return qs;
}

function makeCtx(d: RoundData, seed: number, evidence: Map<string, TopicEvidence>): PickCtx {
  return {
    levels: d.levels,
    topics: d.topics.map((tp) => ({ id: tp.id, level: tp.level, tier: getGrammarTier(tp.id) })),
    evidence,
    questionIds: (topicId) => questionsOf(d, seed, topicId).map((q) => ({ id: q.id, kind: q.kind })),
  };
}

// The check is over (or skipped) and the practice has not started: the check result is on screen.
function isResultPause(run: RoundRun): boolean {
  return run.mode === 'mixed' && run.pending === null && currentPhase(run) !== 'check' && run.steps.every((st) => st.phase === 'check');
}

// Puts the next question of the current phase on the screen (`pending`); a phase with no unused question is
// passed over. Passing over the check of a mixed round stops there: the check result comes first.
function advance(run: RoundRun, ctx: PickCtx): RoundRun {
  let r = run;
  for (let i = 0; i < 6; i++) {
    const phase = currentPhase(r);
    if (phase === 'done') return r;
    const pick = pickNext(r, ctx);
    if (pick) return { ...r, pending: pick };
    r = skipPhase(r, ctx);
    if (r.mode === 'mixed' && phase === 'check') return r;
  }
  return r;
}

function phaseLabel(s: RoundStrings, phase: AskPhase, i: number, n: number): string {
  switch (phase) {
    case 'check':
      return s.phaseCheck(i, n);
    case 'practice':
      return s.phasePractice(i, n);
    case 'recheck':
      return s.phaseRecheck(i, n);
    case 'full':
      return s.phaseFull(i, n);
  }
}

const pctText = (p: number | null) => (p === null ? '–' : `${p}%`);

export default function RandomRoundScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t().randomRound;
  const router = useRouter();
  const { strictAccents, refresh } = useLearner();
  // the Check / Next bar of a typed question docks above the keyboard (components/learn/DockSlot.tsx).
  const dock = useDockSlot(colors);

  const [data, setData] = useState<RoundData | null>(null);
  const [run, setRun] = useState<RoundRun | null>(null);
  const [evidence, setEvidence] = useState<Map<string, TopicEvidence>>(new Map());
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [leaving, setLeaving] = useState(false);

  // the number of finished rounds, and whether the round in memory is already counted in it.
  const metaRef = useRef<RandomMeta>({ rounds: 0 });
  const closedRef = useRef(true);
  // the saves run one after the other, in the order of the answers.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((job: () => Promise<void>) => {
    queue.current = queue.current.then(job).catch(() => {});
  }, []);

  const closeRound = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    const meta: RandomMeta = { rounds: metaRef.current.rounds + 1 };
    metaRef.current = meta;
    enqueue(async () => {
      await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, META_ITEM_ID, 'meta', meta);
      await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, RUN_ITEM_ID, 'none', null);
    });
  }, [enqueue]);

  // an open round is saved as it is, a finished one is counted and closed.
  const commit = useCallback(
    (r: RoundRun) => {
      if (currentPhase(r) === 'done') closeRound();
      else enqueue(() => getDb().setGameProgress(GRAMMAR_RANDOM_KEY, RUN_ITEM_ID, 'run', r));
    },
    [closeRound, enqueue]
  );

  const beginRun = useCallback(
    (d: RoundData, mode: RoundMode, ev: Map<string, TopicEvidence>): RoundRun => {
      closedRef.current = false;
      const seed = Date.now() % 2147483647;
      const started = advance(newRun(mode, seed, d.startLevel), makeCtx(d, seed, ev));
      commit(started);
      return started;
    },
    [commit]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const db = getDb();
      const { target, source } = await refresh(['direction', 'strictAccents']);
      const levels = syllabusLevels(target);
      const levelData = await db.getLevel();
      const lvl = levelData.level as Level;
      const d: RoundData = {
        learnedLang: target,
        contentLang: sourceFor(target, source),
        userLevel: levelData.level,
        levels,
        startLevel: levels.includes(lvl) ? lvl : levels[0],
        topics: levels.flatMap((l) => syllabusForLevel(l, target)).filter((tp) => hasLesson(target, tp.id)),
        cache: { seed: -1, map: new Map() },
      };
      const rows = await db.getGameProgress(GRAMMAR_RANDOM_KEY);
      if (!alive) return;
      const ev = evidenceFromRows(rows);
      metaRef.current = metaFromRows(rows);
      let r = runFromRows(rows);
      if (r && currentPhase(r) === 'done') {
        // a finished round that was never closed: drop it.
        enqueue(() => db.setGameProgress(GRAMMAR_RANDOM_KEY, RUN_ITEM_ID, 'none', null));
        r = null;
      }
      if (r) {
        closedRef.current = false;
        if (!isResultPause(r)) {
          const pending = r.pending;
          const found = !!pending && questionsOf(d, r.seed, pending.topicId).some((q) => q.id === pending.qid);
          if (!found) {
            r = advance({ ...r, pending: null }, makeCtx(d, r.seed, ev));
            commit(r);
          }
        }
      } else {
        r = beginRun(d, nextMode(metaRef.current), ev);
      }
      setEvidence(ev);
      setData(d);
      setRun(r);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [refresh, beginRun, commit, enqueue]);

  // the 💬 is on every part of the round; `part` tells the Feedback sheet exactly which one it is about
  // (grammar-random:<phase>:<question id or empty>). On a typed question the 💬 sits above the docked bar.
  const shell = (children: ReactNode, part?: string, bottomOffset?: number) => (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {children}
      {part !== undefined && data ? (
        <ScreenFeedback
          level={data.userLevel}
          languagePair={`${data.contentLang}→${data.learnedLang}`}
          currentCard={`grammar-random:${part}`}
          bottomOffset={bottomOffset}
        />
      ) : null}
    </View>
  );

  if (!data || !run) return shell(<ActivityIndicator style={styles.centered} color={colors.tint} />);

  const titleOf = (id: string) => {
    const tp = data.topics.find((x) => x.id === id);
    return tp ? tp.title[data.contentLang] ?? tp.title.en : id;
  };
  const levelOf = (id: string): Level => data.topics.find((x) => x.id === id)?.level ?? data.startLevel;

  const startRound = (mode: RoundMode) => {
    setFeedback(null);
    setLeaving(false);
    setRun(beginRun(data, mode, evidence));
  };

  const onDone = () => router.back();

  // "Done" on the check result ends the round there (it is counted), the practice is skipped.
  const finishAndLeave = () => {
    closeRound();
    router.back();
  };

  const startPractice = () => {
    const next = advance(run, makeCtx(data, run.seed, evidence));
    commit(next);
    setRun(next);
  };

  const phase = currentPhase(run);
  const pendingQ =
    run.pending && phase !== 'done' ? questionsOf(data, run.seed, run.pending.topicId).find((q) => q.id === run.pending?.qid) : undefined;

  const answered = (ok: boolean) => {
    if (!run.pending || !pendingQ || phase === 'done') return;
    const { topicId } = run.pending;
    const answer: EvidenceAnswer = { id: pendingQ.id, kind: pendingQ.kind, ok, at: localDateString() };
    const topicEvidence = appendEvidence(evidence.get(topicId), answer);
    const nextEvidence = new Map(evidence).set(topicId, topicEvidence);
    const ctx = makeCtx(data, run.seed, nextEvidence);
    const step: RoundStep = { topicId, qid: pendingQ.id, kind: pendingQ.kind, level: levelOf(topicId), phase, ok };
    const before = phaseProgress(run);
    let next = recordAnswer(run, step, ctx);
    if (!isResultPause(next)) next = advance(next, ctx);
    enqueue(() => getDb().setGameProgress(GRAMMAR_RANDOM_KEY, topicId, 'evidence', topicEvidence));
    commit(next);
    setEvidence(nextEvidence);
    setRun(next);
    if (phase === 'practice') setFeedback({ q: pendingQ, ok, topicId, index: before.index + 1, of: before.of });
  };

  const header = (label: string, testID = 'random-counter') => (
    <View style={styles.header}>
      <Pressable testID="random-close" accessibilityRole="button" accessibilityLabel={s.leaveTitle} hitSlop={12} onPress={() => setLeaving(true)}>
        <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
      </Pressable>
      <Text testID={testID} style={[styles.counter, { color: colors.textMuted }]}>
        {label}
      </Text>
      <View style={styles.closeSpacer} />
    </View>
  );

  if (leaving) {
    return shell(
      <View style={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text style={[styles.title, { color: colors.text }]}>{s.leaveTitle}</Text>
          <Text style={[styles.line, { color: colors.textMuted }]}>{s.leaveBody}</Text>
        </Card>
        <ExamButton testID="random-leave" label={t().exam.leave} onPress={onDone} />
        <ExamButton testID="random-keep-going" secondary label={t().exam.keepGoing} onPress={() => setLeaving(false)} />
      </View>,
      'leave:'
    );
  }

  // practice: after the answer, the explanation card.
  if (feedback) {
    const { q, ok, topicId } = feedback;
    return shell(
      <View style={styles.flex}>
        {header(s.phasePractice(feedback.index, feedback.of))}
        <ScrollView contentContainerStyle={styles.body}>
          <Text testID="random-practice-title" style={[styles.topicTitle, { color: colors.text }]}>
            {titleOf(topicId)}
          </Text>
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            <ResultBadge testID="random-feedback-badge" correct={ok} label={ok ? s.correct : s.wrong} />
            <Text testID="random-feedback-question" style={[styles.missedQuestion, { color: colors.text }]}>
              {q.review.question}
            </Text>
            {q.review.answer !== '' && (
              <>
                <Text style={[styles.missedLabel, { color: colors.textMuted }]}>{t().exam.correctAnswer}</Text>
                <Text testID="random-feedback-answer" style={[styles.missedAnswer, { color: colors.success }]}>
                  {q.review.answer}
                </Text>
              </>
            )}
            {q.review.why ? (
              <Text testID="random-feedback-why" style={[styles.missedWhy, { color: colors.textMuted }]}>
                {q.review.why}
              </Text>
            ) : null}
          </Card>
          <ExamButton testID="random-next" label={s.next} onPress={() => setFeedback(null)} />
          <ExamButton testID="random-rule" secondary label={s.rule} onPress={() => router.push(`/grammar/${topicId}` as never)} />
        </ScrollView>
      </View>,
      `practice:${q.id}`
    );
  }

  const checkSteps = run.steps.filter((st) => st.phase === 'check');

  // mixed round: the check result (weak topics), until the practice starts.
  if (isResultPause(run)) {
    const hasWeak = run.weak.length > 0;
    return shell(
      <ScrollView contentContainerStyle={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text testID="random-result-score" style={[styles.title, { color: colors.text }]}>
            {`${checkSteps.filter((st) => st.ok).length}/${checkSteps.length}`}
          </Text>
          <Text testID="random-result-level" style={[styles.line, { color: colors.textMuted }]}>
            {s.finishedAt(ladderLevel(run, data.levels))}
          </Text>
        </Card>
        {hasWeak ? (
          <View testID="random-weak-list" style={styles.list}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{s.weakTitle}</Text>
            {run.weak.map((id) => {
              const asked = checkSteps.filter((st) => st.topicId === id);
              return (
                <Card key={id} classicStyle={styles.card} boxStyle={styles.brutalCard}>
                  <View style={styles.row}>
                    <Text testID={`random-weak-${id}`} style={[styles.rowTitle, { color: colors.text }]}>
                      {titleOf(id)}
                    </Text>
                    <Text style={[styles.rowValue, { color: colors.textMuted }]}>{`${asked.filter((st) => st.ok).length}/${asked.length}`}</Text>
                  </View>
                </Card>
              );
            })}
          </View>
        ) : (
          <Text testID="random-no-weak" style={[styles.line, { color: colors.textMuted }]}>
            {s.noWeak}
          </Text>
        )}
        {hasWeak ? (
          <>
            <ExamButton testID="random-practice-these" label={s.practiceThese(PRACTICE_SIZE)} onPress={startPractice} />
            <ExamButton testID="random-done" secondary label={s.done} onPress={finishAndLeave} />
          </>
        ) : (
          <>
            <ExamButton testID="random-another" label={s.anotherRound} onPress={() => startRound(nextMode(metaRef.current))} />
            <ExamButton testID="random-done" secondary label={s.done} onPress={onDone} />
          </>
        )}
      </ScrollView>,
      'result:'
    );
  }

  // the end of the round.
  if (phase === 'done') {
    const lines = (['check', 'practice', 'recheck', 'full'] as const)
      .map((p) => ({ p, steps: run.steps.filter((st) => st.phase === p) }))
      .filter((x) => x.steps.length > 0);
    const touched = [...new Set(run.steps.map((st) => st.topicId))];
    return shell(
      <ScrollView contentContainerStyle={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          {lines.map(({ p, steps }) => (
            <Text key={p} testID={`random-end-${p}`} style={[styles.endLine, { color: colors.text }]}>
              {phaseLabel(s, p, steps.filter((st) => st.ok).length, steps.length)}
            </Text>
          ))}
        </Card>
        {run.mode === 'mixed' ? (
          <View testID="random-weak-list" style={styles.list}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{s.weakTitle}</Text>
            {run.weak.map((id) => (
              <Card key={id} classicStyle={styles.card} boxStyle={styles.brutalCard}>
                <Text testID={`random-end-topic-${id}`} style={[styles.rowTitle, { color: colors.text }]}>
                  {`${titleOf(id)} ${pctText(run.before[id] ?? null)} → ${pctText(topicPercent(evidence.get(id)))}`}
                </Text>
              </Card>
            ))}
          </View>
        ) : (
          <View testID="random-topic-list" style={styles.list}>
            {touched.map((id) => {
              const ev = evidence.get(id);
              const pct = topicPercent(ev);
              return (
                <Card key={id} classicStyle={styles.card} boxStyle={styles.brutalCard}>
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <Text testID={`random-end-topic-${id}`} style={[styles.rowTitle, { color: colors.text }]}>
                        {titleOf(id)}
                      </Text>
                      <Text style={[styles.missedLabel, { color: colors.textMuted }]}>{levelOf(id)}</Text>
                    </View>
                    <Text testID={`random-end-pct-${id}`} style={[styles.rowValue, { color: colors.textMuted }]}>
                      {pct === null ? s.answersSoFar(ev?.answers.length ?? 0) : `${pct}%`}
                    </Text>
                    {topicTicked(ev) && (
                      <Text testID={`random-end-ticked-${id}`} style={[styles.rowValue, { color: colors.success }]}>
                        {`✓ ${s.ticked}`}
                      </Text>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
        <ExamButton testID="random-another" label={s.anotherRound} onPress={() => startRound(nextMode(metaRef.current))} />
        <ExamButton testID="random-done" secondary label={s.done} onPress={onDone} />
      </ScrollView>,
      'end:'
    );
  }

  if (!pendingQ || !run.pending) return shell(<ActivityIndicator style={styles.centered} color={colors.tint} />);

  // a question: check / practice / re-check / full.
  const progress = phaseProgress(run);
  const pct = progress.of > 0 ? (progress.index / progress.of) * 100 : 0;
  const ladder = phase === 'check' ? ladderLevel(run, data.levels) : null;
  return shell(
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header(phaseLabel(s, phase, progress.index + 1, progress.of))}
      <ProgressBar testID="random-progress" pct={pct} brutalStyle={styles.brutalProgress} trackStyle={styles.track} trackColor={colors.border} fillStyle={styles.fill} fillColor={colors.tint} />
      {ladder && (
        <View style={styles.ladder}>
          {data.levels.map((lvl) => {
            const on = lvl === ladder;
            return (
              <View
                key={lvl}
                testID={`random-ladder-${lvl}`}
                accessibilityState={{ selected: on }}
                style={[
                  styles.chip,
                  themedEdgeStyle(g),
                  { borderColor: on ? colors.tint : colors.border, backgroundColor: on ? colors.tint : colors.card },
                ]}
              >
                <Text style={[styles.chipText, { color: on ? colors.onTint : colors.textMuted }]}>{lvl}</Text>
              </View>
            );
          })}
        </View>
      )}
      {phase === 'practice' && (
        <Text testID="random-practice-title" style={[styles.topicTitle, { color: colors.text }]}>
          {titleOf(run.pending.topicId)}
        </Text>
      )}
      {run.mode === 'full' && run.steps.length === 0 && (
        <Text testID="random-full-intro" style={[styles.intro, { color: colors.textMuted }]}>
          {s.fullIntro}
        </Text>
      )}
      <DockSlotProvider host={dock}>
        <TestQuestionView
          key={`${phase}:${pendingQ.id}`}
          q={pendingQ}
          learnedLang={data.learnedLang}
          strictAccents={strictAccents}
          onDone={answered}
        />
      </DockSlotProvider>
      {dock.node}
    </KeyboardAvoidingView>,
    `${phase}:${pendingQ.id}`,
    dock.bottomOffset
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: spacing.xl },
  flex: { flex: 1 },
  centered: { flex: 1 },
  body: { padding: spacing.lg, paddingBottom: FAB_CLEARANCE, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  line: { fontSize: fontSize.md, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  close: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  closeSpacer: { width: fontSize.xl },
  counter: { fontSize: fontSize.sm },
  track: { height: 8, borderRadius: radius.xs, marginHorizontal: spacing.lg, marginTop: spacing.sm, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.xs },
  brutalProgress: { marginHorizontal: spacing.lg, marginTop: spacing.sm },
  ladder: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  chip: { borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  intro: { fontSize: fontSize.sm, textAlign: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  topicTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, textAlign: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, flexShrink: 1 },
  rowValue: { fontSize: fontSize.md },
  endLine: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, textAlign: 'center' },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  missedQuestion: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  missedLabel: { fontSize: fontSize.sm },
  missedAnswer: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  missedWhy: { fontSize: fontSize.sm },
});
