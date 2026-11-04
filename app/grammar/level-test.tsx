import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import type { Level } from '@/data/words';
import { getDb } from '@/lib/database';
import { useLearner } from '@/lib/learner';
import { sourceFor } from '@/lib/languagePair';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { speechLang } from '@/lib/languages';
import { playChime } from '@/lib/chime';
import { speak, stopSpeaking } from '@/lib/speech';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import type { LessonTestQuestion } from '@/lib/grammar/lessonTest';
import {
  LEVEL_ROUND_SIZE,
  kindsOfCtx,
  levelDone,
  levelPercent,
  levelRoundKey,
  parseLevelRound,
  pickLevelNext,
  weakestTopic,
  type LevelRound,
} from '@/lib/grammar/levelTest';
import { levelTestCtx } from '@/lib/grammar/levelTestView';
import { hasLesson, syllabusForLevel, syllabusLevels } from '@/lib/grammar/syllabus';
import { GRAMMAR_RANDOM_KEY, appendEvidence, evidenceFromRows, type EvidenceAnswer, type TopicEvidence } from '@/lib/grammar/randomRound';
import { questionsOf, type RoundData } from '@/lib/grammar/randomRoundView';
import { Card } from '@/components/grammar/Brutal';
import LevelTestFeedback from '@/components/grammar/LevelTestFeedback';
import { ProgressBar } from '@/components/grammar/Themed';
import TestQuestionView from '@/components/grammar/TestQuestionView';
import ExamButton from '@/components/exam/ExamButton';
import { DockSlotProvider, useDockSlot } from '@/components/learn/DockSlot';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';
import ScreenFeedback from '@/lib/screenFeedback';

// The grammar level test (FB571; Grammar tab, the button under a level's header): an endless stream of questions from
// ONE level's topics, always from the topic with the lowest test percent (core topics first, lib/grammar/levelTest.ts).
// Every answer is saved as the same per-topic evidence the random round uses (game_progress, GRAMMAR_RANDOM_KEY), so the
// lesson row badge, the tick and the random round see it, and there is nothing else to resume: the ✕ leaves at once
// and the next visit continues with the then lowest topic. Every answer stops on a result card
// (components/grammar/LevelTestFeedback.tsx) and the test moves on only with Next (FB578): a right answer chimes, reads
// the sentence and the card explains it; a wrong one shows what was chosen or typed, the right answer, the why and a link to
// the lesson. The stream is cut into rounds of 20 (header "A1 · 34% · 3/20", a result screen after the 20th, FB581); the
// round's position survives leaving and an app kill (resume store). When the last topic ticks, a done screen comes once
// (leave, or keep practising) and goes before the round screen.

interface Current {
  topicId: string;
  qid: string;
}

interface Result {
  q: LessonTestQuestion;
  topicId: string;
  ok: boolean;
  /** What was pressed or typed. */
  given?: string;
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
  const [result, setResult] = useState<Result | null>(null);
  const [round, setRound] = useState<LevelRound>({ n: 0, right: 0, startPct: 0 });
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
      const pair = `${d.contentLang}→${d.learnedLang}`;
      const saved = parseLevelRound(await loadResumeValue(db, levelRoundKey(pair, lvl)));
      if (!alive) return;
      setRound(saved ?? { n: 0, right: 0, startPct: levelPercent(levelTestCtx(d, sd, lvl, ev).topics.map((tp) => tp.id), ev) });
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

  // the sentence that was read aloud must not go on over another screen
  useEffect(() => () => stopSpeaking(), []);

  // the screen frame; the 💬 sits in each state's header row (feedbackFor), not over the screen
  const shell = (children: ReactNode, overlay?: ReactNode) => (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {children}
      {overlay}
    </View>
  );

  if (!data || !current) return shell(<ActivityIndicator style={styles.flex} color={colors.tint} />);

  const ctx = levelTestCtx(data, seed, level, evidence);
  const ids = ctx.topics.map((tp) => tp.id);
  const kindsOf = kindsOfCtx(ctx);
  const pct = levelPercent(ids, evidence);
  const pendingQ = questionsOf(data, seed, current.topicId).find((q) => q.id === current.qid);
  const titleOf = (id: string) => {
    const tp = data.topics.find((x) => x.id === id);
    return tp ? tp.title[data.contentLang] ?? tp.title.en : id;
  };

  const pair = `${data.contentLang}→${data.learnedLang}`;
  const saveRound = (r: LevelRound | null) => enqueue(async () => void (await saveResumeValue(getDb(), levelRoundKey(pair, level), r)));
  const roundEnd = round.n >= LEVEL_ROUND_SIZE && !result;

  const answered = (ok: boolean, given?: string) => {
    if (!pendingQ) return;
    const { topicId } = current;
    const answer: EvidenceAnswer = { id: pendingQ.id, kind: pendingQ.kind, ok, at: localDateString() };
    const topicEvidence = appendEvidence(evidence.get(topicId), answer);
    const nextEvidence = new Map(evidence).set(topicId, topicEvidence);
    setAsked(asked + 1);
    enqueue(() => getDb().setGameProgress(GRAMMAR_RANDOM_KEY, topicId, 'evidence', topicEvidence));
    setEvidence(nextEvidence);
    setCurrent(pickLevelNext(levelTestCtx(data, seed, level, nextEvidence), topicId, seed + asked + 1) ?? current);
    const nextRound = { ...round, n: round.n + 1, right: round.right + (ok ? 1 : 0) };
    setRound(nextRound);
    saveRound(nextRound);
    // the last topic just ticked: the done screen comes once per visit
    if (!doneShown.current && !levelDone(ids, evidence, kindsOf) && levelDone(ids, nextEvidence, kindsOf)) {
      doneShown.current = true;
      setDoneOpen(true);
    }
    // a tap on the result card must not land on a keyboard that is still closing
    Keyboard.dismiss();
    setResult({ q: pendingQ, topicId, ok, given });
    // a right answer chimes first and the sentence follows; a wrong one is only read out
    const say = () => {
      if (pendingQ.say) speak(pendingQ.say, speechLang(data.learnedLang));
    };
    if (ok) playChime(say);
    else say();
  };

  // the 💬 is on every part of the test, at the right end of the header row; `part` tells the Feedback sheet exactly which
  // one it is about (grammar-level-test:<level>:<question id | round-end>)
  const feedbackFor = (part: string) => (
    <ScreenFeedback
      placement="inline"
      level={data.userLevel}
      languagePair={pair}
      currentCard={`grammar-level-test:${level}:${part}`}
    />
  );
  const headerFor = (part: string) => (
    <View style={styles.header}>
      <Pressable testID="level-test-close" accessibilityRole="button" accessibilityLabel={s.leave} hitSlop={12} onPress={() => router.back()}>
        <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
      </Pressable>
      <Text testID="level-test-header" style={[styles.counter, { color: colors.textMuted }]}>
        {s.header(level, pct, result || roundEnd ? round.n : round.n + 1, LEVEL_ROUND_SIZE)}
      </Text>
      {doneOpen ? <View style={styles.closeSpacer} /> : feedbackFor(part)}
    </View>
  );
  const progress = (
    <ProgressBar testID="level-test-progress" trackProps={{ testID: "level-test-progress" }} pct={pct} brutalStyle={styles.brutalProgress} trackStyle={styles.track} trackColor={colors.border} fillStyle={styles.fill} fillColor={colors.tint} />
  );

  const doneFor = (part: string) => doneOpen ? (
    <View testID="level-test-done" accessibilityViewIsModal style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.closeSpacer} />
        {feedbackFor(part)}
      </View>
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

  // after every answer: the result card; the next question comes with Next.
  if (result) {
    return shell(
      <View style={styles.flex}>
        {headerFor(result.q.id)}
        {progress}
        <LevelTestFeedback
          q={result.q}
          topicTitle={titleOf(result.topicId)}
          ok={result.ok}
          given={result.given}
          onNext={() => setResult(null)}
          onRule={() => router.push(`/grammar/${result.topicId}` as never)}
        />
      </View>,
      doneFor(result.q.id)
    );
  }

  // after the 20th result: the round summary
  if (roundEnd) {
    const weak = weakestTopic(ids, evidence);
    return shell(
      <View style={styles.flex}>
        {headerFor('round-end')}
        {progress}
        <View style={styles.body}>
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            <Text style={[styles.line, { color: colors.textMuted }]}>{s.roundDone}</Text>
            <Text testID="level-test-round-score" style={[styles.title, { color: colors.text }]}>{s.roundScore(round.right, LEVEL_ROUND_SIZE)}</Text>
            <Text testID="level-test-round-levels" style={[styles.line, { color: colors.text }]}>{s.roundLevels(level, round.startPct, pct)}</Text>
            {weak ? (
              <>
                <Text style={[styles.line, { color: colors.textMuted }]}>{s.weakest}</Text>
                <Text testID="level-test-round-weakest" style={[styles.line, { color: colors.text }]}>{s.weakestLine(titleOf(weak.id), weak.pct)}</Text>
              </>
            ) : null}
          </Card>
          <ExamButton
            testID="level-test-round-next"
            label={s.nextRound(LEVEL_ROUND_SIZE)}
            onPress={() => {
              const fresh = { n: 0, right: 0, startPct: pct };
              setRound(fresh);
              saveRound(fresh);
            }}
          />
          <ExamButton
            testID="level-test-round-leave"
            secondary
            label={t().exam.leave}
            onPress={() => {
              saveRound(null);
              router.back();
            }}
          />
        </View>
      </View>,
      doneFor('round-end')
    );
  }

  if (!pendingQ) return shell(<ActivityIndicator style={styles.flex} color={colors.tint} />);

  return shell(
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {headerFor(pendingQ.id)}
      {progress}
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
    doneFor(pendingQ.id)
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
});
