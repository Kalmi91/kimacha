import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { normalizeWordToken, type Level } from '@/data/words';
import { cumulativeCorpusWordIds, grammarKindCounts, type GrammarGapItem, type GrammarItem, type GrammarKind, type GrammarTopicData } from '@/lib/games/content';
import { buildGlossMap } from '@/lib/games/gloss';
import { GRAMMAR_PROGRESS_KEY, lessonFor, nextWrittenTopic, scoredKinds, syllabusTopic } from '@/lib/grammar/syllabus';
import {
  betterBest,
  kindBestKey,
  kindPercent,
  kindProgressFromRows,
  kindRunKey,
  lessonScore,
  runSummary,
  type KindRun,
} from '@/lib/grammar/lessonScore';
import { tableCellsForLesson, wordCellsForLesson, WORD_DECK_MIN_CARDS } from '@/lib/grammar/tableDeck';
import { TRANSFORM_ROUND_SIZE } from '@/lib/grammar/transformRounds';
import { ARTICLE_LESSON_ID, ARTICLE_ROUND_SIZE } from '@/lib/grammar/nounArticles';
import { LESSON_TEST_PASS_PCT, lessonTestFromRows, lessonTestKey, lessonTestSize, lessonTestUnlocked } from '@/lib/grammar/lessonTest';
import { getScrollY, setScrollY } from '@/lib/grammar/scrollMemory';
import { speak, speakSequence, stopSpeaking } from '@/lib/speech';
import { splitByMarkers } from '@/lib/mixedSpeech';
import { speechLang } from '@/lib/languages';
import GlossText from '@/components/games/GlossText';
import GrammarDrill, { type RoundStats } from '@/components/grammar/GrammarDrill';
import LessonBody from '@/components/grammar/LessonBody';
import LessonTest from '@/components/grammar/LessonTest';
import FeedbackButton from '@/components/FeedbackModal';
import FitText from '@/components/FitText';
import SpeakButton from '@/components/SpeakButton';
import TrialBadge from '@/components/TrialBadge';
import { BrutalBox, Card, SegmentBar, Sticker, segmentsFilled } from '@/components/grammar/Brutal';
import { DockSlotProvider, useDockSlot } from '@/components/learn/DockSlot';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import { clearDrillResume, drillToResume, loadDrillResume, saveDrillResume } from '@/lib/drillResume';
import { localDateString } from '@/lib/usageStats';

// One grammar lesson: the rule first, then the practice.
//
// The lesson READS (rule, the exceptions block, worked examples you can tap for
// meaning and hear spoken), and only then drills, because the Game tab's
// grammar-choice already covers "drill first, explanation after" and the point
// of the course is the other order: understand, then check.

type Phase = 'lesson' | 'drill' | 'done' | 'test';
type ProgressRow = { itemId: string; state: string; data: unknown };

// Buttons appear in this order, only for the kinds
// the lesson has items for.
const KIND_ORDER: GrammarKind[] = ['choice', 'article', 'match', 'form', 'why', 'transform', 'spot', 'order', 'dictation'];

export default function GrammarLessonScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const router = useRouter();
  const { topic: topicId } = useLocalSearchParams<{ topic: string }>();

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('en');
  const [level, setLevel] = useState<Level>('A1');
  const [lesson, setLesson] = useState<GrammarTopicData | null>(null);
  const [phase, setPhase] = useState<Phase>('lesson');
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  // which kind the learner started (by its button); this goes into
  // GrammarDrill's `kinds` prop and into the progress-row key.
  const [drillKind, setDrillKind] = useState<GrammarKind>('choice');
  // id of the visible drill item, for the feedback context.
  const [drillItemId, setDrillItemId] = useState<string | undefined>(undefined);
  // Card-level resume: true once the saved practice has been read back (nothing is saved before that).
  const [drillResumeReady, setDrillResumeReady] = useState(false);
  // the Check / Next bar of the drill's type-in items docks above the keyboard (components/learn/DockSlot.tsx).
  const dock = useDockSlot(colors);
  // the lesson-body ScrollView remounts on a phase change; lib/grammar/scrollMemory.ts
  // keeps the position per topicId so it can be restored.
  const scrollRef = useRef<ScrollView>(null);
  // the V2 lesson's single (play → stop) button for reading lesson.speak
  // aloud; it stops on button press, on a phase change and on unmount.
  const [speaking, setSpeaking] = useState(false);
  // how many times each transform item has been practiced (itemId -> n);
  // this decides the order of the next round of 10 (least practiced first).
  const [transformSeen, setTransformSeen] = useState<Record<string, number>>({});
  // the lesson's progress rows (game_progress), from which each kind gets
  // its best finished round (best) and its abandoned round (run);
  // the lesson % is the average over ALL kinds (lib/grammar/lessonScore.ts), a kind not yet done counts as 0.
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  // data for the round-end screen (memory only): the drill's stats, the
  // cumulative % from BEFORE the round, and the streak days.
  const [roundStats, setRoundStats] = useState<RoundStats | null>(null);
  const [prevPct, setPrevPct] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    // Kimacha Play: UI always English, regardless of the
    // stored source language; the lesson data's hu/es/de fields stay unused.
    // es→en: a Spanish-native learner gets the Spanish explanation.
    setContentLang(target === 'en' ? 'es' : 'en');
    const levelData = await db.getLevel();
    setLevel((levelData.level as Level) ?? 'A1');
    setStreak((await db.getStreak())?.current_count ?? 0);
    const loadedLesson = lessonFor(target, String(topicId)) ?? null;
    setLesson(loadedLesson);
    if (loadedLesson) {
      // before the round starts, load how many times each transform item
      // has been practiced, so the least practiced can come first.
      const progressRows = await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
      const seenRow = progressRows.find((r) => r.itemId === `${String(topicId)}:transform:seen`);
      setTransformSeen((seenRow?.data as Record<string, number>) ?? {});
      // the kinds' best/run/old rows come from the same query.
      setProgressRows(progressRows);
      // if the app was closed during this practice, reopen in it (the round continues from the saved run).
      const counts = grammarKindCounts(loadedLesson);
      const resumeKind = drillToResume(await loadDrillResume(db), String(topicId), localDateString(), KIND_ORDER.filter((k) => counts[k] > 0));
      if (resumeKind) {
        setDrillKind(resumeKind);
        setPhase('drill');
      }
    } else {
      setTransformSeen({});
      setProgressRows([]);
    }
    setDrillResumeReady(true);
  }, [topicId]);

  useLoadOnMount(load);

  // while in the drill, save the practice; on leaving the lesson (lesson phase, done, unmount) clear it.
  useEffect(() => {
    if (!drillResumeReady) return;
    const db = getDb();
    if (phase === 'drill') void saveDrillResume(db, { topicId: String(topicId), kind: drillKind, day: localDateString() });
    else void clearDrillResume(db);
  }, [drillResumeReady, phase, drillKind, topicId]);
  useEffect(
    () => () => {
      const db = getDb();
      void loadDrillResume(db).then((r) => (r?.topicId === String(topicId) ? clearDrillResume(db) : undefined));
    },
    [topicId]
  );

  // stop reading aloud on a phase change and on unmount too,
  // not only when the button is pressed. Because of the hook rules it must
  // come BEFORE the early return for a null `lesson`.
  useEffect(() => {
    if (phase !== 'lesson') return;
    return () => {
      stopSpeaking();
      setSpeaking(false);
    };
  }, [phase]);

  const entry = syllabusTopic(String(topicId), learnedLang);

  if (!lesson) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={s.a11y.back} onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
          <FitText variant="title" base={17} maxLines={2} reserve={100} style={[styles.title, { color: colors.text }]}>
            {entry?.title[contentLang] ?? String(topicId)}
          </FitText>
          <View style={{ width: 24 }} />
        </View>
        <Text style={[styles.empty, { color: colors.tabIconDefault }]}>{s.grammar.soonLong}</Text>
        {/* the 💬 is there on the not-yet-written lesson's page too. */}
        <FeedbackButton level={level} languagePair={`${contentLang}→${learnedLang}`} currentCard={`grammar:${topicId}:soon`} />
      </View>
    );
  }

  // title is Record<hu/en/es/de,string>-like in both schemas, but
  // LessonV2's Lang4 does not allow an arbitrary string index, hence the cast.
  const lessonTitle = (lesson.title as Record<string, string>)[contentLang] ?? lesson.title.en;
  const knownIds = cumulativeCorpusWordIds(lesson.level, learnedLang);
  const overrides = Object.fromEntries((lesson.glossary ?? []).map((g) => [normalizeWordToken(g.word), g.gloss]));
  // a button only for the kinds that have items in the lesson
  // (e.g. hay-estar gets no conjugation button, since it has no form item).
  const kindCounts = grammarKindCounts(lesson);
  const availableKinds = KIND_ORDER.filter((k) => kindCounts[k] > 0);
  // Provisional kinds (all trial items): their button gets a badge and they do not count toward the lesson %.
  const trialKinds = new Set<GrammarKind>(availableKinds.filter((k) => !scoredKinds(lesson).includes(k)));
  // the deck button only where the lesson actually
  // has a conjugation table (lib/grammar/tableDeck.ts already excludes the
  // reference GridTables and vosotros rows).
  const tableDeckCells = tableCellsForLesson(lesson);
  // a table-less lesson gets a word-deck
  // instead, built from its own vocabulary; only shown at >= 8 cards, and
  // never alongside the table-deck button (no two buttons).
  // In es→en it is built from the English vocabulary; with too few words there is no button.
  const wordDeckCells = tableDeckCells.length === 0 ? wordCellsForLesson(lesson, learnedLang) : [];
  // the end-of-lesson test's own row, not part of the lesson %.
  const lessonTestResult = lessonTestFromRows(progressRows, String(topicId));

  // Two worked examples from the first items, so the lesson SHOWS the rule
  // before it asks anything.
  // A mark task's sentence is already complete, with nothing to fill in, so the
  // worked examples come from the gap items.
  // Because of the union lesson shape, the `.filter` narrowing only works
  // correctly when built on a flat `GrammarItem[]` cast, as with rule/more.
  // LessonV2's items array also holds match/form items,
  // which have no `sentence`/`options` fields, so here we must narrow
  // explicitly to (kind missing or 'gap') items, not just exclude mark.
  const worked = (lesson.items as GrammarItem[])
    .filter((item): item is GrammarGapItem => item.kind === undefined || item.kind === 'gap')
    .slice(0, 3)
    .map((item) => ({
      filled: item.sentence.replace('___', item.options[item.correct]),
      why: item.why[contentLang] ?? item.why.en,
    }));

  // the V2 lesson's `speak` field is cut into sections by the «...» markers
  // (no corpus guessing), and the button toggles play<->stop.
  const toggleLessonSpeech = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const text = lesson.speak[contentLang as 'hu' | 'en' | 'es' | 'de'] ?? lesson.speak.en;
    const segments = splitByMarkers(text, { learnedLang, nativeLang: contentLang }).map((seg) => ({
      text: seg.text,
      locale: speechLang(seg.lang),
    }));
    setSpeaking(true);
    speakSequence(segments, () => setSpeaking(false));
  };

  // writing the lesson's progress rows: local state + durable (game_progress).
  const saveRow = (itemId: string, state: string, data: unknown) => {
    setProgressRows((prev) => [...prev.filter((r) => r.itemId !== itemId), { itemId, state, data }]);
    getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, itemId, state, data).catch(() => {});
  };
  // The lesson %: the average over ALL existing kinds, a kind not yet started counts as 0 (null: nothing done yet).
  // Provisional kinds do not pull the lesson % down (scoredKinds).
  const lessonScoreOf = (rows: ProgressRow[]) =>
    lessonScore(scoredKinds(lesson).map((k) => kindProgressFromRows(rows, String(topicId), k)));

  const finish = async (correct: number, total: number, roundItemIds?: string[]) => {
    setPrevPct(lessonScoreOf(progressRows));
    setScore({ correct, total });
    setPhase('done');
    // the row key is per kind (`${topic}:${kind}`), and it is only
    // written if this kind scored >=80% this time (see
    // doneGrammarTopicProgress: a kind only counts as done that way).
    const pct = total ? Math.round((correct / total) * 100) : 0;
    if (pct >= 80) {
      getDb()
        .setGameProgress(GRAMMAR_PROGRESS_KEY, `${String(topicId)}:${drillKind}`, 'done', { correct, total })
        .catch(() => {});
    }
    // finished round: the better result overwrites the old one (a weaker one does not lower it),
    // and the abandoned round is deleted. A kind's % is its best round's result.
    const prevBest = kindProgressFromRows(progressRows, String(topicId), drillKind).best;
    saveRow(kindBestKey(String(topicId), drillKind), 'best', betterBest(prevBest, { correct, total }));
    saveRow(kindRunKey(String(topicId), drillKind), 'run', null);
    // the round's items become "practiced", right and wrong answers
    // both count; one write at the end of the round, not per item.
    if (drillKind === 'transform' && roundItemIds && roundItemIds.length) {
      const updated = { ...transformSeen };
      for (const id of roundItemIds) updated[id] = (updated[id] ?? 0) + 1;
      setTransformSeen(updated);
      getDb()
        .setGameProgress(GRAMMAR_PROGRESS_KEY, `${String(topicId)}:transform:seen`, 'seen', updated)
        .catch(() => {});
    }
  };

  // on the brutalist palette the back button sits in a box, the title is uppercase, the level is a sticker.
  const header = g.brutal ? (
    <View style={styles.header}>
      <BrutalBox
        testID="grammar-back"
        accessibilityLabel={s.a11y.back}
        boxStyle={styles.brutalBack}
        onPress={() => (phase === 'lesson' ? router.back() : setPhase('lesson'))}
      >
        <Text style={[styles.back, { color: g.ink }]}>←</Text>
      </BrutalBox>
      {/* a long (Spanish) title wraps onto two lines and shrinks in steps,
          instead of being cut off with "...". */}
      <FitText variant="title" base={17} maxLines={2} reserve={150} caps style={[styles.title, styles.brutalTitle, { color: g.ink }]}>
        {lessonTitle}
      </FitText>
      <Sticker label={lesson.level} fill="a" rotate={5} />
    </View>
  ) : (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={s.a11y.back} onPress={() => (phase === 'lesson' ? router.back() : setPhase('lesson'))} hitSlop={12}>
        <Text style={[styles.back, { color: colors.text }]}>←</Text>
      </Pressable>
      <FitText variant="title" base={17} maxLines={2} reserve={130} style={[styles.title, { color: colors.text }]}>
        {lessonTitle}
      </FitText>
      <Text style={[styles.levelTag, { color: colors.tint }]}>{lesson.level}</Text>
    </View>
  );
  // the title color on the brutalist palette is ink (the filled a / b colors are unreadable as text on paper).
  const accentText = g.brutal ? g.ink : colors.tint;

  // main button: on the brutalist palette the filled box, on classic today's button.
  const lessonButton = (testID: string, label: string, onPress: () => void, filled: boolean, first: boolean) =>
    g.brutal ? (
      <BrutalBox
        testID={testID}
        fill={filled ? 'a' : 'paper'}
        style={[styles.brutalBtnWrap, first && styles.startBtn]}
        boxStyle={styles.brutalBtn}
        onPress={onPress}
      >
        <Text style={[styles.brutalBtnText, { color: filled ? g.onFill : g.ink }]}>{label}</Text>
      </BrutalBox>
    ) : (
      <Pressable
        testID={testID}
        style={[
          styles.btn,
          first && styles.startBtn,
          filled ? { backgroundColor: colors.tint } : { borderWidth: 1.5, borderColor: colors.tint },
        ]}
        onPress={onPress}
      >
        <Text style={[styles.btnText, filled ? styles.btnTextOnTint : { color: colors.tint }]}>{label}</Text>
      </Pressable>
    );

  if (phase === 'test') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LessonTest
          lesson={lesson}
          topicId={String(topicId)}
          learnedLang={learnedLang}
          contentLang={contentLang}
          level={level}
          previous={lessonTestResult}
          hasNextTopic={!!nextWrittenTopic(learnedLang, String(topicId))}
          onSave={(r) => saveRow(lessonTestKey(String(topicId)), r.passed ? 'passed' : 'failed', r)}
          onNextTopic={() => {
            const nextTopic = nextWrittenTopic(learnedLang, String(topicId));
            if (nextTopic) router.replace(`/grammar/${nextTopic.id}` as never);
          }}
          onBackToRule={() => setPhase('lesson')}
          onBackToSyllabus={() => router.back()}
          onLeave={() => setPhase('lesson')}
        />
      </View>
    );
  }

  if (phase === 'drill') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <DockSlotProvider host={dock}>
          {/* on the brutalist palette the drill's own header (X + segmented bar + combo) replaces it. */}
          {g.brutal ? null : header}
          {/* the lesson drill runs through the `drillKind` kind
              (the buttons start each kind separately); the Game tab's grammar-choice,
              lacking the `kinds` prop, still gets only its gap/mark round as before. */}
          <GrammarDrill
            topic={lesson}
            learnedLang={learnedLang}
            contentLang={contentLang}
            onFinish={finish}
            kinds={[drillKind]}
            transformSeen={transformSeen}
            onItemChange={setDrillItemId}
            onRoundStats={setRoundStats}
            onClose={() => setPhase('lesson')}
            // an abandoned round continues from where it left off; it is saved
            // after every answered item.
            resume={kindProgressFromRows(progressRows, String(topicId), drillKind).run ?? undefined}
            onProgress={(p) => saveRow(kindRunKey(String(topicId), drillKind), 'run', p satisfies KindRun)}
          />
        </DockSlotProvider>
        {dock.node}
        <FeedbackButton
          level={level}
          languagePair={`${contentLang}→${learnedLang}`}
          currentCard={`grammar:${topicId}:drill${drillItemId ? `:${drillItemId}` : ''}`}
          bottomOffset={dock.bottomOffset}
        />
      </View>
    );
  }

  if (phase === 'done' && score) {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    // so one can move on from the Done screen to the next
    // topic. Offered only for a written lesson; we don't send anyone to an empty screen.
    const next = nextWrittenTopic(learnedLang, String(topicId));
    // the cumulative ratio computed from ALL rounds of the lesson so far, not just
    // this round's score (which is `pct` above).
    const cumulativePct = lessonScoreOf(progressRows);
    // The test button is the only filled (highlighted) button on the page, the others are secondary (outlined).
    // The "Lesson test" button on the done page; it is only enabled once a round has been played in every
    // task kind of the lesson, until then it is grey with the to-do below it. The line under the button is the rule.
    const testSize = lessonTestSize(lesson, learnedLang, contentLang);
    const testReady = lessonTestUnlocked(lesson, progressRows, String(topicId));
    const startTest = () => setPhase('test');
    const lessonTestCta =
      testSize > 0 ? (
        <>
          {g.brutal ? (
            <BrutalBox
              testID="grammar-start-lessontest"
              fill={testReady ? 'a' : 'paper'}
              dashed={!testReady}
              disabled={!testReady}
              style={styles.brutalBtnWrap}
              boxStyle={styles.brutalBtn}
              onPress={startTest}
            >
              <Text style={[styles.brutalBtnText, { color: testReady ? g.onFill : g.mu }]}>{s.lessonTest.take}</Text>
            </BrutalBox>
          ) : (
            <Pressable
              testID="grammar-start-lessontest"
              disabled={!testReady}
              style={[
                styles.btn,
                testReady ? { backgroundColor: colors.tint } : { borderWidth: 1.5, borderColor: colors.tabIconDefault, opacity: 0.5 },
              ]}
              onPress={startTest}
            >
              <Text style={[styles.btnText, testReady ? styles.btnTextOnTint : { color: colors.tabIconDefault }]}>{s.lessonTest.take}</Text>
            </Pressable>
          )}
          <Text testID="grammar-lessontest-note" style={[styles.lessonTestNote, { color: g.brutal ? g.mu : colors.tabIconDefault }]}>
            {!testReady
              ? s.lessonTest.finishFirst
              : lessonTestResult?.passed
                ? s.lessonTest.passedBest(lessonTestResult.best)
                : s.lessonTest.rules(testSize, LESSON_TEST_PASS_PCT)}
          </Text>
        </>
      ) : null;
    // Neo-brutalist: big
    // correct-ratio in the filled box + combo sticker, 3 small boxes, "practice
    // this" with the wrong sentence, topic progress in segments, buttons.
    if (g.brutal) {
      const secs = roundStats?.seconds ?? 0;
      const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      const miss = roundStats?.miss ?? null;
      const missAt = miss ? miss.sentence.indexOf(miss.highlight) : -1;
      const stat = (label: string, value: string, fill: 'paper' | 'b') => (
        <BrutalBox fill={fill} style={styles.brutalStatWrap} boxStyle={styles.brutalStat}>
          <Text style={[styles.brutalStatValue, { color: fill === 'b' ? g.onB : g.ink }]}>{value}</Text>
          <Text style={[styles.brutalStatLabel, { color: fill === 'b' ? g.onB : g.mu }]}>{label}</Text>
        </BrutalBox>
      );
      return (
        <View style={[styles.container, { backgroundColor: g.bg }]}>
          {header}
          <ScrollView contentContainerStyle={styles.brutalDoneBody}>
            <BrutalBox testID="grammar-score" fill="a" boxStyle={styles.brutalScoreBox}>
              <Text style={[styles.brutalScore, { color: g.onFill }]}>
                {score.correct}/{score.total}
              </Text>
              <Text style={[styles.brutalNote, { color: g.onFill }]}>{pct >= 80 ? s.grammar.doneGood : s.grammar.doneAgain}</Text>
              {roundStats && roundStats.bestCombo >= 2 ? (
                <View style={styles.brutalComboPos}>
                  <Sticker testID="grammar-best-combo" label={s.grammar.comboLabel(roundStats.bestCombo)} fill="b" rotate={6} />
                </View>
              ) : null}
            </BrutalBox>

            <View style={styles.brutalStats}>
              {stat(s.grammar.statCorrect, String(score.correct), 'paper')}
              {stat(s.grammar.statTime, time, 'paper')}
              {stat(s.grammar.statStreak, `🔥 ${streak}`, 'b')}
            </View>

            {cumulativePct !== null ? (
              <BrutalBox boxStyle={styles.brutalProgressBox}>
                <SegmentBar segments={8} filled={segmentsFilled(cumulativePct, 8)} />
                <Text style={[styles.brutalStatLabel, { color: g.ink }]}>{s.grammar.progressChange(prevPct, cumulativePct)}</Text>
                <Text testID="grammar-lesson-percent" style={[styles.brutalStatLabel, { color: g.mu }]}>
                  {s.grammar.lessonPercent(cumulativePct)}
                </Text>
              </BrutalBox>
            ) : null}

            {miss ? (
              <BrutalBox testID="grammar-practice-this" boxStyle={styles.brutalProgressBox}>
                <Text style={[styles.brutalStatLabel, { color: g.mu }]}>{s.grammar.practiceThis}</Text>
                <Text style={[styles.brutalMiss, { color: g.ink }]}>
                  {missAt >= 0 ? miss.sentence.slice(0, missAt) : miss.sentence}
                  {missAt >= 0 ? (
                    <Text style={{ backgroundColor: g.b, color: g.onB }}>{miss.highlight}</Text>
                  ) : null}
                  {missAt >= 0 ? miss.sentence.slice(missAt + miss.highlight.length) : ''}
                </Text>
              </BrutalBox>
            ) : null}

            {lessonTestCta}
            {next ? (
              <BrutalBox
                testID="grammar-next-topic"
                style={styles.brutalBtnWrap}
                boxStyle={styles.brutalBtn}
                onPress={() => router.replace(`/grammar/${next.id}` as never)}
              >
                <Text style={[styles.brutalBtnText, { color: g.ink }]}>{s.grammar.nextTopic} →</Text>
              </BrutalBox>
            ) : null}
            <BrutalBox style={styles.brutalBtnWrap} boxStyle={styles.brutalBtn} onPress={() => setPhase('lesson')}>
              <Text style={[styles.brutalBtnText, { color: g.ink }]}>{s.grammar.backToRule}</Text>
            </BrutalBox>
            {drillKind === 'transform' && kindCounts.transform > TRANSFORM_ROUND_SIZE ? (
              <BrutalBox
                testID="grammar-more-round"
                fill="a"
                style={styles.brutalBtnWrap}
                boxStyle={styles.brutalBtn}
                onPress={() => {
                  setScore(null);
                  setPhase('drill');
                }}
              >
                <Text style={[styles.brutalBtnText, { color: g.onFill }]}>{s.grammar.moreRound(TRANSFORM_ROUND_SIZE)}</Text>
              </BrutalBox>
            ) : null}
            <Pressable
              testID="grammar-practice-again"
              style={styles.ghostBtn}
              onPress={() => {
                setScore(null);
                setPhase('drill');
              }}
            >
              <Text style={[styles.brutalUnderline, { color: g.ink }]}>{s.grammar.oneMoreRound}</Text>
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
              <Text style={[styles.ghostBtnText, { color: g.mu }]}>{s.grammar.backToSyllabus}</Text>
            </Pressable>
          </ScrollView>
          {/* the 💬 is there on the task-end / result page too. */}
          <FeedbackButton level={level} languagePair={`${contentLang}→${learnedLang}`} currentCard={`grammar:${topicId}:done`} />
        </View>
      );
    }
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.doneBody}>
          <Text style={styles.doneEmoji}>{pct >= 80 ? '🎉' : '📘'}</Text>
          <Text style={[styles.doneScore, { color: colors.text }]}>
            {score.correct} / {score.total}
          </Text>
          <Text style={[styles.doneNote, { color: colors.tabIconDefault }]}>
            {pct >= 80 ? s.grammar.doneGood : s.grammar.doneAgain}
          </Text>
          {cumulativePct !== null ? (
            <Text testID="grammar-lesson-percent" style={[styles.lessonPercentNote, { color: colors.tabIconDefault }]}>
              {s.grammar.lessonPercent(cumulativePct)}
            </Text>
          ) : null}
          {lessonTestCta}
          {next ? (
            <Pressable
              testID="grammar-next-topic"
              style={[styles.btn, { borderWidth: 1.5, borderColor: colors.tint }]}
              onPress={() => router.replace(`/grammar/${next.id}` as never)}
            >
              <Text style={[styles.btnText, { color: colors.tint }]}>{s.grammar.nextTopic}</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[
              styles.btn,
              (pct >= 80 && next) || testSize > 0 ? { borderWidth: 1.5, borderColor: colors.tint } : { backgroundColor: colors.tint },
            ]}
            onPress={() => setPhase('lesson')}
          >
            <Text
              style={[
                styles.btnText,
                (pct >= 80 && next) || testSize > 0 ? { color: colors.tint } : styles.btnTextOnTint,
              ]}
            >
              {s.grammar.backToRule}
            </Text>
          </Pressable>
          <Pressable
            testID="grammar-practice-again"
            style={[styles.btn, { borderWidth: 1.5, borderColor: colors.tint }]}
            onPress={() => {
              setScore(null);
              setPhase('drill');
            }}
          >
            <Text style={[styles.btnText, { color: colors.tint }]}>{s.grammar.practiceAgain}</Text>
          </Pressable>
          {/* on a big (>10 items) transform lesson, a separate button for the
              next round of 10, the same tangible step as
              "Practice again", plus the fresh `transformSeen` map reflects it. */}
          {drillKind === 'transform' && kindCounts.transform > TRANSFORM_ROUND_SIZE ? (
            <Pressable
              testID="grammar-more-round"
              style={[styles.btn, { backgroundColor: colors.tint }]}
              onPress={() => {
                setScore(null);
                setPhase('drill');
              }}
            >
              <Text style={[styles.btnText, styles.btnTextOnTint]}>{s.grammar.moreRound(TRANSFORM_ROUND_SIZE)}</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
            <Text style={[styles.ghostBtnText, { color: colors.tabIconDefault }]}>{s.grammar.backToSyllabus}</Text>
          </Pressable>
        </View>
        <FeedbackButton level={level} languagePair={`${contentLang}→${learnedLang}`} currentCard={`grammar:${topicId}:done`} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {header}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.body, g.brutal && styles.brutalPad]}
        onScroll={(e) => setScrollY(String(topicId), e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
        onContentSizeChange={() => scrollRef.current?.scrollTo({ y: getScrollY(String(topicId)), animated: false })}
      >
        {/* the body blocks alternate with the rule/more prose, and
            lesson.speak is read aloud with a single play<->stop button. */}
        <Text style={[styles.sectionLabel, { color: accentText }]}>{s.grammar.ruleLabel}</Text>
        <SpeakButton
          testID="speakToggle"
          speaking={speaking}
          style={styles.readRow}
          brutalStyle={styles.readRowBrutal}
          iconStyle={styles.speak}
          labelStyle={[styles.readLabel, { color: accentText }]}
          label={s.grammar.readAloud}
          onPress={toggleLessonSpeech}
          hitSlop={10}
        />
        <LessonBody blocks={lesson.body} contentLang={contentLang as 'hu' | 'en' | 'es' | 'de'} learnedLang={learnedLang} />

        <Text style={[styles.sectionLabel, { color: accentText }]}>{s.grammar.examplesLabel}</Text>
        {worked.map((w, i) => (
          <Card key={i} classicStyle={styles.card}>
            <View style={styles.exampleRow}>
              <GlossText
                text={w.filled}
                glosses={buildGlossMap(w.filled, { learnedLang, nativeLang: contentLang, knownWordIds: knownIds, overrides })}
                learnedLang={learnedLang}
                style={[styles.exampleText, { color: colors.text }]}
              />
              <SpeakButton onPress={() => speak(w.filled, speechLang(learnedLang))} iconStyle={styles.speak} hitSlop={10} />
            </View>
            <Text style={[styles.exampleWhy, { color: colors.tabIconDefault }]}>{w.why}</Text>
          </Card>
        ))}

        {/* one button per kind, so that sentences / matching / conjugation can be
            started separately, not the whole lesson at once.
            Under the button the kind's OWN %, with the same lessonPercent
            logic that gives the cumulative number on the Done screen. */}
        {lessonTestResult?.passed ? (
          <Text testID="grammar-test-passed" style={[styles.testPassedNote, { color: g.brutal ? g.ink : colors.success }]}>
            ✓ {s.lessonTest.passedBest(lessonTestResult.best)}
          </Text>
        ) : null}
        {availableKinds.map((kind, i) => {
          // for an abandoned round "3/10 · 30%" (an unanswered item counts 0), otherwise the
          // kind's best round; the better result overwrites the old one (lib/grammar/lessonScore.ts).
          const kindProg = kindProgressFromRows(progressRows, String(topicId), kind);
          const runInfo = kindProg.run ? runSummary(kindProg.run) : null;
          const kindPct = kindPercent(kindProg);
          return (
            <View key={kind}>
              {lessonButton(
                `grammar-start-${kind}`,
                kind === 'choice'
                    ? s.grammar.startChoice(kindCounts.choice)
                    : kind === 'article'
                      ? s.grammar.startArticle(topicId === ARTICLE_LESSON_ID ? Math.min(kindCounts.article, ARTICLE_ROUND_SIZE) : kindCounts.article)
                    : kind === 'match'
                      ? s.grammar.startMatch(kindCounts.match)
                      : kind === 'form'
                        ? s.grammar.startForm(kindCounts.form)
                        : kind === 'why'
                          ? s.grammar.startWhy(kindCounts.why)
                          : kind === 'spot'
                            ? s.grammar.startSpot(kindCounts.spot)
                            : kind === 'order'
                              ? s.grammar.startOrder(kindCounts.order)
                              : kind === 'dictation'
                                ? s.grammar.startDictation(kindCounts.dictation)
                                : kindCounts.transform > TRANSFORM_ROUND_SIZE
                                  ? s.grammar.startTransformRound(TRANSFORM_ROUND_SIZE, kindCounts.transform)
                                  : s.grammar.startTransform(kindCounts.transform),
                () => {
                  setDrillKind(kind);
                  setPhase('drill');
                },
                true,
                i === 0
              )}
              {/* under the provisional kind's button, the "NEW · TEST" badge. */}
              {trialKinds.has(kind) ? (
                <View style={styles.trialRow}>
                  <TrialBadge testID={`trial-badge-${kind}`} />
                </View>
              ) : null}
              {runInfo || kindPct !== null ? (
                <Text testID={`grammar-kind-percent-${kind}`} style={[styles.kindPercentNote, { color: colors.tabIconDefault }]}>
                  {runInfo ? s.grammar.runProgress(runInfo.answered, runInfo.of, runInfo.percent) : s.grammar.lessonPercent(kindPct as number)}
                </Text>
              ) : null}
            </View>
          );
        })}

        {/* the deck button only where the lesson has
            a conjugation table; outlined, to read as an optional extra next
            to the per-kind drill buttons above. */}
        {tableDeckCells.length > 0 ? (
          lessonButton(
            'grammar-start-tabledeck',
            s.grammar.practiceTable(tableDeckCells.length),
            () => router.push(`/grammar/deck/${topicId}` as never),
            false,
            availableKinds.length === 0
          )
        ) : wordDeckCells.length >= WORD_DECK_MIN_CARDS ? (
          // same deck screen, the word-source variant.
          lessonButton(
            'grammar-start-worddeck',
            s.grammar.practiceWords(wordDeckCells.length),
            () => router.push(`/grammar/deck/${topicId}` as never),
            false,
            availableKinds.length === 0
          )
        ) : null}
      </ScrollView>
      <FeedbackButton level={level} languagePair={`${contentLang}→${learnedLang}`} currentCard={`grammar:${topicId}:lesson`} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  back: { fontSize: 22 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', paddingHorizontal: 8 },
  levelTag: { fontSize: 13, fontWeight: '800', width: 28, textAlign: 'right' },
  body: { padding: 16, paddingBottom: 100, gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10 },
  card: { borderRadius: 14, padding: 14, gap: 6 },
  exampleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exampleText: { fontSize: 17, fontWeight: '600', flex: 1, lineHeight: 25 },
  exampleWhy: { fontSize: 13, lineHeight: 19 },
  speak: { fontSize: 18 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  // the brutalist SpeakButton's box row (does not stretch to the card's full width).
  readRowBrutal: { alignSelf: 'flex-start', marginTop: 12 },
  readLabel: { fontSize: 14, fontWeight: '700' },
  // User feedback: "don't make the text field so crude, one is
  // tiny and the other big". One button shape across the whole screen: the same width
  // (`alignSelf: 'stretch'`), the same height (the filled variant also has the
  // 1.5 transparent border) and the same font size. The filled and the outlined
  // button now differ in color only.
  btn: {
    marginTop: 10,
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  startBtn: { marginTop: 18 },
  btnTextOnTint: { color: '#FFFFFF' },
  // neo-brutalist buttons, title (uppercase, weight 500).
  // The last button also scrolls clear of the chat button (FAB).
  brutalPad: { paddingBottom: 130 },
  brutalBack: { paddingVertical: 4, paddingHorizontal: 10 },
  brutalTitle: { fontWeight: '500', textTransform: 'uppercase' },
  brutalBtnWrap: { marginTop: 10, alignSelf: 'stretch' },
  brutalBtn: { paddingVertical: 14, alignItems: 'center' },
  brutalBtnText: { fontSize: 16, fontWeight: '500', textTransform: 'uppercase', textAlign: 'center' },
  brutalDoneBody: { padding: 16, paddingBottom: 130, gap: 12 },
  brutalScoreBox: { padding: 24, alignItems: 'center', gap: 6 },
  brutalScore: { fontSize: 56, fontWeight: '500' },
  brutalNote: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  brutalComboPos: { position: 'absolute', top: -14, right: -8 },
  brutalStats: { flexDirection: 'row', gap: 10 },
  brutalStatWrap: { flex: 1 },
  brutalStat: { paddingVertical: 12, alignItems: 'center', gap: 2 },
  brutalStatValue: { fontSize: 20, fontWeight: '500' },
  brutalStatLabel: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase' },
  brutalProgressBox: { padding: 14, gap: 8 },
  brutalMiss: { fontSize: 18, lineHeight: 26, fontWeight: '500' },
  brutalUnderline: { fontSize: 14, fontWeight: '500', textTransform: 'uppercase', textDecorationLine: 'underline' },
  ghostBtn: { marginTop: 12, padding: 8 },
  ghostBtnText: { fontSize: 14 },
  empty: { fontSize: 15, textAlign: 'center', marginTop: 60, paddingHorizontal: 30, lineHeight: 22 },
  doneBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  doneEmoji: { fontSize: 56 },
  doneScore: { fontSize: 34, fontWeight: '800' },
  doneNote: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  // the cumulative "So far: NN%" line, under the score and the "done" message.
  lessonPercentNote: { fontSize: 12, textAlign: 'center', marginTop: -6, marginBottom: 12 },
  // the same line style, under each kind's own button.
  kindPercentNote: { fontSize: 12, textAlign: 'center', marginTop: 2 },
  trialRow: { alignItems: 'center', marginTop: 6 },
  // the line under the lesson-test button, and the lesson page's "Test passed" mark.
  lessonTestNote: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  testPassedNote: { fontSize: 14, fontWeight: '700', marginTop: 10 },
});
