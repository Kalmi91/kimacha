import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { ON_FILL } from '@/constants/GrammarPalettes';
import { bestOn } from '@/constants/Skins';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import type { Level } from '@/data/words';
import { getDb } from '@/lib/database';
import { useLearner } from '@/lib/learner';
import { sourceFor } from '@/lib/languagePair';
import { speechLang } from '@/lib/languages';
import { playChime } from '@/lib/chime';
import { speak, stopSpeaking } from '@/lib/speech';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { localDateString } from '@/lib/usageStats';
import type { LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { hasLesson, syllabusForLevel, syllabusLevels } from '@/lib/grammar/syllabus';
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
  recordAnswer,
  runFromRows,
  topicPercent,
  topicTicked,
  type EvidenceAnswer,
  type RandomMeta,
  type RoundMode,
  type RoundRun,
  type RoundStep,
  type TopicEvidence,
} from '@/lib/grammar/randomRound';
import { advance, isResultPause, makeCtx, phaseLabel, questionsOf, topicKindCount, type RoundData } from '@/lib/grammar/randomRoundView';
import { Card } from '@/components/grammar/Brutal';
import RandomOtherWrong from '@/components/grammar/RandomOtherWrong';
import { ProgressBar, themedEdgeStyle } from '@/components/grammar/Themed';
import TestQuestionView from '@/components/grammar/TestQuestionView';
import XpChip from '@/components/XpChip';
import { awardXpThen } from '@/lib/xpAward';
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
// answer shows nothing, a wrong one shows the right one); the practice cards answer at once (`instant`) and the
// explanation card after them shows the right answer and the why.
// FB549: every answer, in every phase, reads the right sentence aloud; a right one first chimes and is marked green
// (on the explanation card in the practice, a short green badge over the next question elsewhere).

/** The practice feedback card: shown after an answer of the practice phase. */
interface Feedback {
  q: LessonTestQuestion;
  ok: boolean;
  topicId: string;
  index: number;
  of: number;
}

// how long the green badge of a right answer stays over the next question
const RIGHT_MARK_MS = 900;

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
  // FB549: a right answer in the exam-style phases moves on at once; the green badge over the next question is its mark.
  const [rightMark, setRightMark] = useState(0);
  // the XP the last answer gave (FB591); 0 shows nothing
  const [earned, setEarned] = useState(0);

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
    // the open round first, then the counter: a stop in between loses one count, it never counts the round twice.
    enqueue(async () => {
      await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, RUN_ITEM_ID, 'none', null);
      await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, META_ITEM_ID, 'meta', meta);
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

  useEffect(() => {
    if (rightMark === 0) return;
    const timer = setTimeout(() => setRightMark(0), RIGHT_MARK_MS);
    return () => clearTimeout(timer);
  }, [rightMark]);

  // the sentence that was read aloud must not go on over another screen
  useEffect(() => () => stopSpeaking(), []);

  // the 💬 is on every part of the round; `part` tells the Feedback sheet exactly which one it is about
  // (grammar-random:<phase>:<question id or empty>). On a typed question the 💬 sits above the docked bar.
  const shell = (children: ReactNode, part?: string, bottomOffset?: number, overlay?: ReactNode) => (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {children}
      {overlay}
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
  // FB550: a topic row of the result / end lists opens that topic's lesson (a push: back returns to this screen, nothing is saved).
  const lessonRow = (id: string, card: ReactNode) => (
    <Pressable key={id} testID={`random-open-${id}`} accessibilityRole="button" accessibilityLabel={titleOf(id)}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })} onPress={() => router.push(`/grammar/${id}` as never)}>
      {card}
    </Pressable>
  );

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
    // the round first (the answer is in its steps), then the evidence: a stop in between loses one evidence answer,
    // it never counts the answer twice.
    commit(next);
    enqueue(() => getDb().setGameProgress(GRAMMAR_RANDOM_KEY, topicId, 'evidence', topicEvidence));
    setEvidence(nextEvidence);
    setRun(next);
    setEarned(0);
    if (ok) awardXpThen(phase === 'practice' ? 'levelPractice' : 'grammar', pendingQ.id, setEarned);
    if (phase === 'practice') setFeedback({ q: pendingQ, ok, topicId, index: before.index + 1, of: before.of });
    else if (ok) setRightMark((n) => n + 1);
    // FB549: a right answer chimes first and the sentence follows; a wrong one is only read out
    const say = () => {
      if (pendingQ.say) speak(pendingQ.say, speechLang(data.learnedLang));
    };
    if (ok) playChime(say);
    else say();
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

  // The ✕ confirmation lies over the screen instead of replacing it: the question card stays mounted, so after
  // "keep going" its state (the typed text, a revealed answer) is exactly as it was.
  const leaveOverlay = leaving ? (
    <View testID="random-leave-overlay" accessibilityViewIsModal style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.background }]}>
      <View style={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text style={[styles.title, { color: colors.text }]}>{s.leaveTitle}</Text>
          <Text style={[styles.line, { color: colors.textMuted }]}>{s.leaveBody}</Text>
        </Card>
        <ExamButton testID="random-leave" label={t().exam.leave} onPress={onDone} />
        <ExamButton testID="random-keep-going" secondary label={t().exam.keepGoing} onPress={() => setLeaving(false)} />
      </View>
    </View>
  ) : null;

  // practice: after the answer, the explanation card.
  if (feedback) {
    const { q, ok, topicId } = feedback;
    return shell(
      <View style={styles.flex}>
        {header(s.phasePractice(feedback.index, feedback.of))}
        <XpChip earned={earned} />
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
                <Text style={[styles.missedLabel, { color: colors.textMuted, textAlign: 'center' }]}>{t().exam.correctAnswer}</Text>
                <View
                  testID={ok ? 'random-feedback-green' : undefined}
                  style={ok ? [styles.greenMark, { backgroundColor: colors.successFill, borderColor: g.ink }] : undefined}
                >
                  <Text
                    testID="random-feedback-answer"
                    style={[styles.missedAnswer, { color: ok ? bestOn(colors.successFill, [ON_FILL, colors.onTint]) : colors.success }]}
                  >
                    {q.review.answer}
                  </Text>
                </View>
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
      leaving ? 'leave:' : `practice:${q.id}`,
      undefined,
      leaveOverlay
    );
  }

  const checkSteps = run.steps.filter((st) => st.phase === 'check');
  const rightOverlay =
    rightMark > 0 ? (
      // a zero-height anchor under the progress bar: the badge lies over the top of the next question, centered,
      // and never covers the ✕ or the counter
      <View pointerEvents="none" style={styles.rightMarkAnchor}>
        <View style={styles.rightMark}>
          <ResultBadge testID="random-right-mark" correct align="center" label={s.correct} />
        </View>
      </View>
    ) : null;

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
              return lessonRow(
                id,
                <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
                  <View style={styles.row}>
                    <Text testID={`random-weak-${id}`} style={[styles.rowTitle, { color: colors.text }]}>
                      {titleOf(id)}
                    </Text>
                    <Text style={[styles.rowValue, { color: colors.textMuted }]}>{`${asked.filter((st) => st.ok).length}/${asked.length}`}</Text>
                    <Text style={[styles.rowValue, { color: colors.textMuted }]}>›</Text>
                  </View>
                </Card>
              );
            })}
          </View>
        ) : (
          <Text testID="random-no-weak" style={[styles.line, { color: colors.textMuted }]}>{s.noWeak}</Text>
        )}
        <RandomOtherWrong run={run} titleOf={titleOf} />
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
            {run.weak.map((id) =>
              lessonRow(
                id,
                <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
                  <View style={styles.row}>
                    <Text testID={`random-end-topic-${id}`} style={[styles.rowTitle, { color: colors.text }]}>
                      {`${titleOf(id)} ${pctText(run.before[id] ?? null)} → ${pctText(topicPercent(evidence.get(id)))}`}
                    </Text>
                    <Text style={[styles.rowValue, { color: colors.textMuted }]}>›</Text>
                  </View>
                </Card>
              )
            )}
          </View>
        ) : (
          <View testID="random-topic-list" style={styles.list}>
            {touched.map((id) => {
              const ev = evidence.get(id);
              const pct = topicPercent(ev);
              return lessonRow(
                id,
                <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
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
                    {topicTicked(ev, () => topicKindCount(data.learnedLang, data.contentLang, id)) && (
                      <Text testID={`random-end-ticked-${id}`} style={[styles.rowValue, { color: colors.success }]}>
                        {`✓ ${s.ticked}`}
                      </Text>
                    )}
                    <Text style={[styles.rowValue, { color: colors.textMuted }]}>›</Text>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
        {run.mode === 'mixed' && <RandomOtherWrong run={run} titleOf={titleOf} />}
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
      {rightOverlay}
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
      <XpChip earned={earned} />
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
          key={`${phase}:${run.steps.length}:${run.pending.topicId}:${pendingQ.id}`}
          q={pendingQ}
          learnedLang={data.learnedLang}
          strictAccents={strictAccents}
          instant={phase === 'practice'}
          onDone={answered}
        />
      </DockSlotProvider>
      {dock.node}
    </KeyboardAvoidingView>,
    leaving ? 'leave:' : `${phase}:${pendingQ.id}`,
    dock.bottomOffset,
    leaveOverlay
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: spacing.xl },
  overlay: { paddingTop: spacing.xl },
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
  missedAnswer: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  greenMark: { borderWidth: 2.5, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  rightMarkAnchor: { height: 0, zIndex: 10 },
  rightMark: { position: 'absolute', top: spacing.sm, left: 0, right: 0, alignItems: 'center' },
  missedWhy: { fontSize: fontSize.sm },
});
