import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
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
import { localDateString } from '@/lib/usageStats';
import type { LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { kindsOfCtx, levelDone, levelPercent, pickLevelNext } from '@/lib/grammar/levelTest';
import { levelTestCtx } from '@/lib/grammar/levelTestView';
import { hasLesson, syllabusForLevel, syllabusLevels } from '@/lib/grammar/syllabus';
import { GRAMMAR_RANDOM_KEY, appendEvidence, evidenceFromRows, type EvidenceAnswer, type TopicEvidence } from '@/lib/grammar/randomRound';
import { questionsOf, type RoundData } from '@/lib/grammar/randomRoundView';
import { Card } from '@/components/grammar/Brutal';
import LevelTestFeedback from '@/components/grammar/LevelTestFeedback';
import { ProgressBar } from '@/components/grammar/Themed';
import TestQuestionView from '@/components/grammar/TestQuestionView';
import ResultBadge from '@/components/ResultBadge';
import ExamButton from '@/components/exam/ExamButton';
import { DockSlotProvider, useDockSlot } from '@/components/learn/DockSlot';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';
import ScreenFeedback from '@/lib/screenFeedback';

// The grammar level test (FB571; Grammar tab, the button under a level's header): an endless stream of questions from
// ONE level's topics, always from the topic with the lowest test percent (core topics first, lib/grammar/levelTest.ts).
// Every answer is saved as the same per-topic evidence the random round uses (game_progress, GRAMMAR_RANDOM_KEY), so the
// lesson row badge, the tick and the random round see it, and there is nothing else to resume: the ✕ leaves at once
// and the next visit continues with the then lowest topic. A right answer chimes, reads the sentence and a green badge
// marks it; a wrong one shows the right answer, the why and a link to the lesson. When the last topic ticks, a done
// screen comes once (leave, or keep practising).

const RIGHT_MARK_MS = 900;

interface Current {
  topicId: string;
  qid: string;
}

interface Wrong {
  q: LessonTestQuestion;
  topicId: string;
}

export default function LevelTestScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().levelTest;
  const router = useRouter();
  const params = useLocalSearchParams<{ level?: string }>();
  const { strictAccents, refresh } = useLearner();
  // the Check / Next bar of a typed question docks above the keyboard (components/learn/DockSlot.tsx).
  const dock = useDockSlot(colors);

  const [data, setData] = useState<RoundData | null>(null);
  const [level, setLevel] = useState<Level>('A1');
  const [seed, setSeed] = useState(0);
  const [evidence, setEvidence] = useState<Map<string, TopicEvidence>>(new Map());
  const [current, setCurrent] = useState<Current | null>(null);
  const [wrong, setWrong] = useState<Wrong | null>(null);
  const [rightMark, setRightMark] = useState(0);
  const [doneOpen, setDoneOpen] = useState(false);
  // the number of answers of this visit: it moves the seed of every pick and renews the question card
  const [asked, setAsked] = useState(0);
  const doneShown = useRef(false);
  // the saves run one after the other, in the order of the answers.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((job: () => Promise<void>) => {
    queue.current = queue.current.then(job).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const db = getDb();
      const { target, source } = await refresh(['direction', 'strictAccents']);
      const levels = syllabusLevels(target);
      const userLevel = (await db.getLevel()).level;
      const wanted = levels.find((l) => l === params.level);
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
      const ev = evidenceFromRows(await db.getGameProgress(GRAMMAR_RANDOM_KEY));
      if (!alive) return;
      const sd = Date.now() % 2147483647;
      const first = pickLevelNext(levelTestCtx(d, sd, lvl, ev), undefined, sd);
      if (!first) {
        router.back();
        return;
      }
      setLevel(lvl);
      setSeed(sd);
      setEvidence(ev);
      setData(d);
      setCurrent(first);
    })().catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the load runs once per visit
  }, []);

  useEffect(() => {
    if (rightMark === 0) return;
    const timer = setTimeout(() => setRightMark(0), RIGHT_MARK_MS);
    return () => clearTimeout(timer);
  }, [rightMark]);

  // the sentence that was read aloud must not go on over another screen
  useEffect(() => () => stopSpeaking(), []);

  // the 💬 is on every part of the test; `part` tells the Feedback sheet exactly which one it is about
  // (grammar-level-test:<level>:<question id>). On a typed question the 💬 sits above the docked bar.
  const shell = (children: ReactNode, part: string, bottomOffset?: number, overlay?: ReactNode) => (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {children}
      {overlay}
      {data ? (
        <ScreenFeedback
          level={data.userLevel}
          languagePair={`${data.contentLang}→${data.learnedLang}`}
          currentCard={`grammar-level-test:${level}:${part}`}
          bottomOffset={bottomOffset}
        />
      ) : null}
    </View>
  );

  if (!data || !current) return shell(<ActivityIndicator style={styles.flex} color={colors.tint} />, '');

  const ctx = levelTestCtx(data, seed, level, evidence);
  const ids = ctx.topics.map((tp) => tp.id);
  const kindsOf = kindsOfCtx(ctx);
  const pct = levelPercent(ids, evidence);
  const pendingQ = questionsOf(data, seed, current.topicId).find((q) => q.id === current.qid);
  const titleOf = (id: string) => {
    const tp = data.topics.find((x) => x.id === id);
    return tp ? tp.title[data.contentLang] ?? tp.title.en : id;
  };

  const answered = (ok: boolean) => {
    if (!pendingQ) return;
    const { topicId } = current;
    const answer: EvidenceAnswer = { id: pendingQ.id, kind: pendingQ.kind, ok, at: localDateString() };
    const topicEvidence = appendEvidence(evidence.get(topicId), answer);
    const nextEvidence = new Map(evidence).set(topicId, topicEvidence);
    setAsked(asked + 1);
    enqueue(() => getDb().setGameProgress(GRAMMAR_RANDOM_KEY, topicId, 'evidence', topicEvidence));
    setEvidence(nextEvidence);
    setCurrent(pickLevelNext(levelTestCtx(data, seed, level, nextEvidence), topicId, seed + asked + 1) ?? current);
    // the last topic just ticked: the done screen comes once per visit
    if (!doneShown.current && !levelDone(ids, evidence, kindsOf) && levelDone(ids, nextEvidence, kindsOf)) {
      doneShown.current = true;
      setDoneOpen(true);
    }
    if (ok) setRightMark((n) => n + 1);
    else setWrong({ q: pendingQ, topicId });
    // a right answer chimes first and the sentence follows; a wrong one is only read out
    const say = () => {
      if (pendingQ.say) speak(pendingQ.say, speechLang(data.learnedLang));
    };
    if (ok) playChime(say);
    else say();
  };

  const header = (
    <View style={styles.header}>
      <Pressable testID="level-test-close" accessibilityRole="button" accessibilityLabel={s.leave} hitSlop={12} onPress={() => router.back()}>
        <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
      </Pressable>
      <Text testID="level-test-header" style={[styles.counter, { color: colors.textMuted }]}>
        {s.header(level, pct)}
      </Text>
      <View style={styles.closeSpacer} />
    </View>
  );

  const doneOverlay = doneOpen ? (
    <View testID="level-test-done" accessibilityViewIsModal style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text testID="level-test-done-title" style={[styles.title, { color: colors.text }]}>{s.doneTitle(level)}</Text>
          <Text style={[styles.line, { color: colors.textMuted }]}>{s.doneBody}</Text>
        </Card>
        <ExamButton testID="level-test-done-leave" label={t().exam.leave} onPress={() => router.back()} />
        <ExamButton testID="level-test-done-keep" secondary label={s.keepPractising} onPress={() => setDoneOpen(false)} />
      </View>
    </View>
  ) : null;

  // after a wrong answer: the right one, the why, the link to the lesson.
  if (wrong) {
    return shell(
      <View style={styles.flex}>
        {header}
        <ProgressBar testID="level-test-progress" trackProps={{ testID: "level-test-progress" }} pct={pct} brutalStyle={styles.brutalProgress} trackStyle={styles.track} trackColor={colors.border} fillStyle={styles.fill} fillColor={colors.tint} />
        <LevelTestFeedback
          q={wrong.q}
          topicTitle={titleOf(wrong.topicId)}
          onNext={() => setWrong(null)}
          onRule={() => router.push(`/grammar/${wrong.topicId}` as never)}
        />
      </View>,
      wrong.q.id,
      undefined,
      doneOverlay
    );
  }

  if (!pendingQ) return shell(<ActivityIndicator style={styles.flex} color={colors.tint} />, current.qid);

  return shell(
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ProgressBar testID="level-test-progress" trackProps={{ testID: "level-test-progress" }} pct={pct} brutalStyle={styles.brutalProgress} trackStyle={styles.track} trackColor={colors.border} fillStyle={styles.fill} fillColor={colors.tint} />
      {rightMark > 0 ? (
        // a zero-height anchor under the progress bar: the badge lies over the top of the next question, centered
        <View pointerEvents="none" style={styles.rightMarkAnchor}>
          <View style={styles.rightMark}>
            <ResultBadge testID="level-test-right-mark" correct align="center" label={t().randomRound.correct} />
          </View>
        </View>
      ) : null}
      <DockSlotProvider host={dock}>
        <TestQuestionView
          key={`${asked}:${current.topicId}:${pendingQ.id}`}
          q={pendingQ}
          learnedLang={data.learnedLang}
          strictAccents={strictAccents}
          instant
          onDone={answered}
        />
      </DockSlotProvider>
      {dock.node}
    </KeyboardAvoidingView>,
    pendingQ.id,
    dock.bottomOffset,
    doneOverlay
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
  closeSpacer: { width: fontSize.xl },
  counter: { fontSize: fontSize.sm },
  track: { height: 8, borderRadius: radius.xs, marginHorizontal: spacing.lg, marginTop: spacing.sm, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.xs },
  brutalProgress: { marginHorizontal: spacing.lg, marginTop: spacing.sm },
  rightMarkAnchor: { height: 0, zIndex: 10 },
  rightMark: { position: 'absolute', top: spacing.sm, left: 0, right: 0, alignItems: 'center' },
});
