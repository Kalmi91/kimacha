import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/KText';
import { useFocusEffect, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { legibleOn } from '@/constants/Skins';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { useLearner } from '@/lib/learner';
import { sourceFor } from '@/lib/languagePair';
import { LEVELS, type Level } from '@/data/words';
import {
  doneGrammarTopicProgress,
  GRAMMAR_PROGRESS_KEY,
  syllabusLevels,
  hasLesson,
  lessonCoverage,
  lessonKinds,
  getGrammarTier,
  syllabusForLevel,
  topicsForUnit,
  unitsForLevel,
} from '@/lib/grammar/syllabus';
import { lessonBadgePercent, lessonScoresByTopic } from '@/lib/grammar/lessonScore';
import { lessonTestPassedTopics } from '@/lib/grammar/lessonTest';
import {
  badgeForTopic,
  evidenceFromRows,
  GRAMMAR_RANDOM_KEY,
  overallScore,
  phaseProgress,
  runFromRows,
  weakTopicCount,
  type RoundRun,
  type TopicEvidence,
} from '@/lib/grammar/randomRound';
import { EXAM_LEVELS } from '@/lib/exam/types';
import { examStatusFor, levelHasLesson, type ExamLevelStatus } from '@/lib/exam/unlock';
import { DEFAULT_WEEKLY_GOAL_MINUTES } from '@/lib/usageStats';
import ScreenFeedback from '@/lib/screenFeedback';
import { BrutalBox, SegmentBar, Sticker, segmentsFilled } from '@/components/grammar/Brutal';
import ExamStrip from '@/components/grammar/ExamStrip';
import LevelStanding from '@/components/grammar/LevelStanding';
import { topicKindCount } from '@/lib/grammar/randomRoundView';
import { SkinBackdrop, SkinHeader } from '@/components/skins/Slots';

// The grammar course: the whole syllabus from A1 to C1, in teaching order.
//
// User feedback: "there should be a separate grammar learning section that neatly
// takes in all the grammar... I want it to be comprehensive".
//
// The level the learner is on is open by default; every other level can be
// opened, because a grammar point is worth reading ahead of schedule and worth
// coming back to. A topic that has no written lesson yet says so instead of
// opening an empty screen.

interface TopicProgress {
  state: string;
  correct?: number;
  total?: number;
}

export default function GrammarSyllabusScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  // a phone's width: the neo-brutalist header (title + streak sticker + 💬) gets a smaller title there, a wide theme font would push the 💬 out.
  const narrow = useWindowDimensions().width < 400;
  const s = t();
  const { refresh } = useLearner();
  const router = useRouter();

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('en');
  const [level, setLevel] = useState<Level>('A1');
  const [openLevel, setOpenLevel] = useState<Level | null>(null);
  const [progress, setProgress] = useState<Map<string, TopicProgress>>(new Map());
  // cumulative correct rate per lesson, for the NN% badge at the right edge of the row.
  const [percents, setPercents] = useState<Map<string, number>>(new Map());
  // lessons that passed the end-of-lesson test ("Test passed" mark).
  const [testPassed, setTestPassed] = useState<Set<string>>(new Set());
  // the random grammar round (lib/grammar/randomRound.ts): per-topic test evidence + the open round, if any.
  const [evidence, setEvidence] = useState<Map<string, TopicEvidence>>(new Map());
  const [randomRun, setRandomRun] = useState<RoundRun | null>(null);
  // streak sticker + weekly goal box (from the existing getStreak / weekly goal / usage values).
  const [streak, setStreak] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(DEFAULT_WEEKLY_GOAL_MINUTES);
  const [weekMinutes, setWeekMinutes] = useState(0);
  // the level exam's unlock state per level (the exam strip), loaded after everything else so it never delays the first paint.
  const [examStatus, setExamStatus] = useState<Map<string, ExamLevelStatus>>(new Map());
  // the target of the previous load: another direction must not show the old direction's exam status while loading.
  const examTarget = useRef<string | null>(null);

  const load = useCallback(async () => {
    const db = getDb();
    const { target, source } = await refresh(['direction']);
    setLearnedLang(target);
    if (examTarget.current !== null && examTarget.current !== target) setExamStatus(new Map());
    examTarget.current = target;
    // The explanation language is the learner's own (the pair's source), not the language being learned:
    // en→es English, es→en Spanish. A source without lesson text yet (hu) falls back to English per field.
    setContentLang(sourceFor(target, source));

    const levelData = await db.getLevel();
    const lvl = (levelData.level as Level) ?? 'A1';
    setLevel(lvl);
    setOpenLevel((current) => current ?? (LEVELS.includes(lvl) && lvl !== 'A0' ? lvl : 'A1'));

    // A topic is only "done" if there is a finished row for every
    // kind that exists in its lesson (doneGrammarTopicProgress, lib/grammar/syllabus.ts).
    const rows = await db.getGameProgress(GRAMMAR_PROGRESS_KEY);
    setProgress(doneGrammarTopicProgress(target, rows));
    // Taken from the same query, without a separate DB call.
    // The lesson's % is the average over all kinds (the ones not done count as 0), not the cumulative correct rate.
    setPercents(lessonScoresByTopic(rows, (id) => lessonKinds(target, id)));
    setTestPassed(lessonTestPassedTopics(rows));
    const randomRows = await db.getGameProgress(GRAMMAR_RANDOM_KEY);
    setEvidence(evidenceFromRows(randomRows));
    setRandomRun(runFromRows(randomRows));
    setStreak((await db.getStreak())?.current_count ?? 0);
    setWeeklyGoal(await db.getWeeklyGoalMinutes());
    setWeekMinutes((await db.getUsageStats()).thisWeek);
    // The same sources as app/exam.tsx: the cards and the grammar rows (refresh(['direction']) above has set the word corpus of this direction).
    const cards = await db.getPcicCards();
    setExamStatus(new Map(EXAM_LEVELS.filter((l) => levelHasLesson(l, target)).map((l) => [l, examStatusFor(l, target, cards, rows)])));
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const coverage = lessonCoverage(learnedLang);
  const doneCount = [...progress.values()].filter((p) => p.state === 'done').length;

  // the entry card of the random round: the title (start / continue the open round) and the grammar score line.
  const rr = s.randomRound;
  const randomTitle = (() => {
    if (!randomRun) return `🎲 ${rr.start}`;
    const { phase, of, index: answered } = phaseProgress(randomRun);
    // the number of the NEXT question, the same as the round screen's counter.
    const index = Math.min(answered + 1, of);
    const label =
      phase === 'check' ? rr.phaseCheck(index, of)
      : phase === 'practice' ? rr.phasePractice(index, of)
      : phase === 'recheck' ? rr.phaseRecheck(index, of)
      : phase === 'full' ? rr.phaseFull(index, of)
      : rr.done;
    return `🎲 ${rr.continueRound(label)}`;
  })();
  const writtenIds = useMemo(
    () => syllabusLevels(learnedLang).flatMap((lvl) => syllabusForLevel(lvl, learnedLang)).filter((tp) => hasLesson(learnedLang, tp.id)).map((tp) => tp.id),
    [learnedLang]
  );
  // the lesson % per topic is the one the row badge starts from (with the old-progress fallback), not only `percents`.
  const lessonPcts = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of writtenIds) {
      const p = progress.get(id);
      const v = lessonBadgePercent(percents.get(id) ?? null, p?.correct, p?.total);
      if (v !== null) m.set(id, v);
    }
    return m;
  }, [writtenIds, percents, progress]);
  const randomScore = rr.score(overallScore(writtenIds, lessonPcts, evidence), weakTopicCount(evidence));

  // A German course with no written lesson at all: say so, never list the Spanish syllabus or an empty one.
  // (With any lesson written the course is listed like the others; a topic without a lesson file shows the "coming soon" badge.)
  if (learnedLang === 'de' && coverage.written === 0) {
    return (
      <View testID="grammar-no-course" style={[styles.container, { backgroundColor: g.brutal ? g.bg : colors.background, justifyContent: 'center', padding: 24 }]}>
        <Text variant="title" style={{ color: g.brutal ? g.ink : colors.text, textAlign: 'center' }}>{s.tabs.grammar}</Text>
        <Text style={{ color: g.brutal ? g.mu : colors.textMuted, textAlign: 'center', marginTop: 12 }}>{s.grammar.noCourse}</Text>
        <ScreenFeedback placement="inline" level={level} languagePair={`${contentLang}→${learnedLang}`} currentCard="grammar-syllabus" />
      </View>
    );
  }

  // Neo-brutalist:
  // the classic palette renders today's look below.
  if (g.brutal) {
    const shownLevel: Level = openLevel ?? 'A1';
    const shownTopics = syllabusForLevel(shownLevel, learnedLang);
    const shownWritten = shownTopics.filter((tp) => hasLesson(learnedLang, tp.id)).length;
    const shownDone = shownTopics.filter((tp) => progress.get(tp.id)?.state === 'done').length;
    return (
      <View style={[styles.container, { backgroundColor: g.bg }]}>
        <SkinBackdrop />
        {/* This tab draws its own header (the navigator's is off), so the 💬 button sits in its right end, outside the scroller. */}
        <View style={styles.brutalHeaderWrap}>
          <SkinHeader>
            <View style={styles.brutalHeader}>
              <Text variant="title" style={[styles.brutalTitle, narrow && styles.brutalTitleNarrow, { color: g.ink }]}>{s.tabs.grammar}</Text>
              <View style={styles.brutalHeaderRight}>
                <Sticker testID="grammar-streak" label={`🔥 ${streak}`} fill="b" rotate={6} />
                <ScreenFeedback placement="inline" level={level} languagePair={`${contentLang}→${learnedLang}`} currentCard="grammar-syllabus" />
              </View>
            </View>
          </SkinHeader>
        </View>
        <ScrollView contentContainerStyle={styles.brutalBody}>
          <Text style={[styles.brutalSmall, { color: g.mu }]}>
            {s.grammar.coverage(doneCount, coverage.written, coverage.planned)}
          </Text>

          <BrutalBox
            testID="grammar-random-start"
            fill="a"
            onPress={() => router.push('/grammar/random' as never)}
            boxStyle={styles.brutalTopic}
          >
            <Text variant="title" style={[styles.brutalTopicTitle, { color: g.onFill }]}>{randomTitle}</Text>
            <Text style={[styles.brutalBlurb, { color: g.onFill }]}>{randomScore}</Text>
          </BrutalBox>

          {learnedLang === 'de' ? (
            <BrutalBox
              testID="grammar-tense-drill-start"
              fill="paper"
              onPress={() => router.push('/grammar/tense-drill' as never)}
              boxStyle={styles.brutalTopic}
            >
              <Text variant="title" style={[styles.brutalTopicTitle, { color: g.ink }]}>{`🔤 ${s.tenseDrill.start}`}</Text>
              <Text style={[styles.brutalBlurb, { color: g.ink }]}>{s.tenseDrill.blurb}</Text>
            </BrutalBox>
          ) : null}

          <View style={styles.brutalLevelRow}>
            {syllabusLevels(learnedLang).map((lvl) => (
              <BrutalBox
                key={lvl}
                testID={`grammar-level-${lvl}`}
                fill={shownLevel === lvl ? 'a' : 'paper'}
                style={styles.brutalLevelBox}
                boxStyle={styles.brutalLevelInner}
                onPress={() => setOpenLevel(lvl)}
              >
                <Text style={[styles.brutalLevelText, { color: shownLevel === lvl ? g.onFill : g.ink }]}>{lvl}</Text>
              </BrutalBox>
            ))}
          </View>
          <Text style={[styles.brutalSmall, { color: g.mu }]}>
            {s.grammar.levelMeta(shownDone, shownTopics.length, shownWritten)}
            {shownLevel === level ? ` · ${s.grammar.yourLevel}` : ''}
          </Text>
          <LevelStanding level={shownLevel} learnedLang={learnedLang} contentLang={contentLang} evidence={evidence} />
          <ExamStrip level={shownLevel} learnedLang={learnedLang} contentLang={contentLang} evidence={evidence} examStatus={examStatus.get(shownLevel)} />

          {unitsForLevel(shownLevel, learnedLang).map((unit) => (
            <View key={unit.id} style={styles.brutalUnit}>
              <Text style={[styles.brutalUnitName, { color: g.mu }]}>
                {unit.title[contentLang] ?? unit.title.en}
              </Text>
              {topicsForUnit(unit.id, learnedLang).map((topic) => {
                const written2 = hasLesson(learnedLang, topic.id);
                const p = progress.get(topic.id);
                const pct = percents.get(topic.id) ?? null;
                // the lesson % or the random-round test % (the larger one), 🎯 behind a test %, ✓ 🎯 once the test ticked the topic.
                const bd = badgeForTopic(lessonBadgePercent(pct, p?.correct, p?.total), evidence.get(topic.id), () => topicKindCount(learnedLang, contentLang, topic.id));
                const badgePct = bd.pct;
                const isDone = p?.state === 'done';
                const tickedOpen = bd.ticked && !isDone;
                const testMark = bd.fromTest || tickedOpen ? ' 🎯' : '';
                const inProgress = written2 && !isDone && (badgePct !== null || !!p);
                const badge = !written2
                  ? `🔒 ${s.grammar.soon}`
                  : isDone
                    ? badgePct !== null
                      ? `✓ ${badgePct}%${testMark}`
                      : `✓ ${p.correct ?? 0}/${p.total ?? 0}`
                    : badgePct !== null
                      ? tickedOpen
                        ? `✓ ${badgePct}%${testMark}`
                        : `${badgePct}%${testMark} · ${s.grammar.continueTag}`
                      : p
                        ? s.grammar.started
                        : s.grammar.notStarted;
                const tier = getGrammarTier(topic.id);
                const textColor = inProgress ? g.onB : written2 ? g.ink : g.mu;
                return (
                  <BrutalBox
                    key={topic.id}
                    testID={`grammar-topic-${topic.id}`}
                    fill={inProgress ? 'b' : 'paper'}
                    dashed={!written2}
                    disabled={!written2}
                    onPress={() => router.push(`/grammar/${topic.id}` as never)}
                    boxStyle={styles.brutalTopic}
                  >
                    <View style={styles.brutalTopicTop}>
                      <Text variant="title" style={[styles.brutalTopicTitle, { color: textColor }]}>
                        {topic.title[contentLang] ?? topic.title.en}
                      </Text>
                    </View>
                    {tier || isDone || testPassed.has(topic.id) ? (
                      <View style={styles.brutalStickers}>
                        {tier === 'core-plus' ? (
                          <Sticker testID={`grammar-core-plus-${topic.id}`} label={s.grammar.corePlusTag} fill="paper" rotate={-4} />
                        ) : tier === 'core' ? (
                          <Sticker testID={`grammar-core-${topic.id}`} label={s.grammar.coreTag} fill="paper" rotate={-4} />
                        ) : null}
                        {isDone ? <Sticker label={s.grammar.doneTag} fill="a" rotate={5} /> : null}
                        {testPassed.has(topic.id) ? (
                          <Sticker testID={`grammar-test-passed-${topic.id}`} label={s.lessonTest.passedTag} fill="b" rotate={-3} />
                        ) : null}
                      </View>
                    ) : null}
                    {/* No numberOfLines clipping: a theme with a wide / tall font wraps onto 3+ lines, we do not truncate it. */}
                    <Text style={[styles.brutalBlurb, { color: textColor }]}>
                      {topic.blurb[contentLang] ?? topic.blurb.en}
                    </Text>
                    {inProgress && badgePct !== null ? (
                      <SegmentBar segments={6} filled={segmentsFilled(badgePct, 6)} style={styles.brutalBar} />
                    ) : null}
                    <Text testID={`grammar-percent-${topic.id}`} style={[styles.brutalBadge, { color: textColor }]}>
                      {badge}
                    </Text>
                  </BrutalBox>
                );
              })}
            </View>
          ))}

          <BrutalBox style={styles.brutalGoal} boxStyle={styles.brutalTopic}>
            <Text style={[styles.brutalUnitName, { color: g.ink }]}>{s.grammar.weeklyGoalTitle}</Text>
            <Text style={[styles.brutalBadge, { color: g.ink }]}>
              {s.grammar.weeklyGoalValue(
                String(Math.round((weekMinutes / 60) * 10) / 10),
                String(Math.round(weeklyGoal / 60))
              )}
            </Text>
            <SegmentBar
              segments={7}
              filled={segmentsFilled(weeklyGoal > 0 ? Math.min(100, (weekMinutes / weeklyGoal) * 100) : 0, 7)}
              style={styles.brutalBar}
            />
          </BrutalBox>

          <Text style={[styles.footNote, { color: g.mu }]}>{s.grammar.footNote}</Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* This is now the root of the Grammar tab, not a pushed screen,
          the title+back row comes from the tab navigator's own header (s.tabs.grammar). */}
      <Text style={[styles.subtitle, { color: colors.tabIconDefault, marginTop: 12 }]}>
        {s.grammar.coverage(doneCount, coverage.written, coverage.planned)}
      </Text>

      <ScrollView contentContainerStyle={styles.body}>
        <Pressable
          testID="grammar-random-start"
          style={[styles.randomCard, { backgroundColor: colors.card, borderColor: colors.tint }]}
          onPress={() => router.push('/grammar/random' as never)}
        >
          <Text style={[styles.levelName, { color: colors.text }]}>{randomTitle}</Text>
          <Text style={[styles.levelMeta, { color: colors.tabIconDefault }]}>{randomScore}</Text>
        </Pressable>

        {learnedLang === 'de' ? (
          <Pressable
            testID="grammar-tense-drill-start"
            style={[styles.randomCard, { backgroundColor: colors.card, borderColor: colors.tint }]}
            onPress={() => router.push('/grammar/tense-drill' as never)}
          >
            <Text style={[styles.levelName, { color: colors.text }]}>{`🔤 ${s.tenseDrill.start}`}</Text>
            <Text style={[styles.levelMeta, { color: colors.tabIconDefault }]}>{s.tenseDrill.blurb}</Text>
          </Pressable>
        ) : null}

        {syllabusLevels(learnedLang).map((lvl) => {
          const topics = syllabusForLevel(lvl, learnedLang);
          const written = topics.filter((tp) => hasLesson(learnedLang, tp.id)).length;
          const done = topics.filter((tp) => progress.get(tp.id)?.state === 'done').length;
          const isOpen = openLevel === lvl;
          const isCurrent = lvl === level;

          return (
            <View key={lvl} style={styles.levelBlock}>
              <Pressable
                testID={`grammar-level-${lvl}`}
                style={[
                  styles.levelHeader,
                  { backgroundColor: colors.card, borderColor: isCurrent ? colors.tint : 'transparent' },
                ]}
                onPress={() => setOpenLevel(isOpen ? null : lvl)}
              >
                <Text style={[styles.levelName, { color: colors.text }]}>
                  {isOpen ? '▾' : '▸'} {lvl}
                  {isCurrent ? ` · ${s.grammar.yourLevel}` : ''}
                </Text>
                <Text style={[styles.levelMeta, { color: colors.tabIconDefault }]}>
                  {s.grammar.levelMeta(done, topics.length, written)}
                </Text>
                <LevelStanding level={lvl} learnedLang={learnedLang} contentLang={contentLang} evidence={evidence} />
              </Pressable>
              <ExamStrip level={lvl} learnedLang={learnedLang} contentLang={contentLang} evidence={evidence} examStatus={examStatus.get(lvl)} />

              {isOpen
                ? unitsForLevel(lvl, learnedLang).map((unit) => (
                    <View key={unit.id} style={styles.unitBlock}>
                      <Text style={[styles.unitName, { color: colors.tint }]}>
                        {unit.title[contentLang] ?? unit.title.en}
                      </Text>
                      {topicsForUnit(unit.id, learnedLang).map((topic) => {
                        const written2 = hasLesson(learnedLang, topic.id);
                        const p = progress.get(topic.id);
                        // null until a round has been played on the topic.
                        const pct = percents.get(topic.id) ?? null;
                        // ONE badge, not two. On a done topic the cumulative
                        // percentage (or, for the old progress, the round's result)
                        // sits next to the ✓; on a started, not done topic it stands alone.
                        // the larger of the lesson % and the random-round test %; 🎯 behind a test %, ✓ 🎯 once the test ticked the topic.
                        const bd = badgeForTopic(lessonBadgePercent(pct, p?.correct, p?.total), evidence.get(topic.id), () => topicKindCount(learnedLang, contentLang, topic.id));
                        const badgePct = bd.pct;
                        const tickedOpen = bd.ticked && p?.state !== 'done';
                        const testMark = bd.fromTest || tickedOpen ? ' 🎯' : '';
                        const badge = !written2
                          ? s.grammar.soon
                          : p?.state === 'done'
                            ? badgePct !== null
                              ? `✓ ${badgePct}%${testMark}`
                              : `✓ ${p.correct ?? 0}/${p.total ?? 0}`
                            : badgePct !== null
                              ? `${tickedOpen ? '✓ ' : ''}${badgePct}%${testMark}`
                              : p
                                ? s.grammar.started
                                : s.grammar.notStarted;
                        const badgeColor =
                          badgePct !== null
                            ? badgePct >= 80
                              ? colors.successFill
                              : badgePct >= 50
                                ? colors.warningFill
                                : colors.tabIconDefault
                            : p?.state === 'done'
                              ? colors.successFill
                              : colors.tabIconDefault;
                        return (
                          <Pressable
                            key={topic.id}
                            testID={`grammar-topic-${topic.id}`}
                            disabled={!written2}
                            onPress={() => router.push(`/grammar/${topic.id}` as never)}
                            style={[
                              styles.topicRow,
                              {
                                backgroundColor: colors.card,
                                opacity: !written2 ? 0.45 : 1,
                              },
                              p?.state === 'done' ? { borderLeftWidth: 4, borderLeftColor: colors.successFill } : null,
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <View style={styles.topicTitleRow}>
                                <Text variant="title" style={[styles.topicTitle, { color: colors.text }]}>
                                  {topic.title[contentLang] ?? topic.title.en}
                                </Text>
                                {getGrammarTier(topic.id) === 'core-plus' ? (
                                  <Text testID={`grammar-core-plus-${topic.id}`} style={styles.corePlusTag}>
                                    {s.grammar.corePlusTag}
                                  </Text>
                                ) : getGrammarTier(topic.id) === 'core' ? (
                                  <Text testID={`grammar-core-${topic.id}`} style={[styles.coreTag, { color: legibleOn('#7C3AED', colors.card) }]}>
                                    {s.grammar.coreTag}
                                  </Text>
                                ) : null}
                              </View>
                              <Text style={[styles.topicBlurb, { color: colors.tabIconDefault }]} numberOfLines={2}>
                                {topic.blurb[contentLang] ?? topic.blurb.en}
                              </Text>
                            </View>
                            <View style={styles.topicBadgeCol}>
                              <Text
                                testID={`grammar-percent-${topic.id}`}
                                style={[styles.topicBadge, { color: badgeColor }]}
                              >
                                {badge}
                              </Text>
                              {testPassed.has(topic.id) ? (
                                <Text testID={`grammar-test-passed-${topic.id}`} style={[styles.topicBadge, { color: colors.success }]}>
                                  ✓ {s.lessonTest.passedTag}
                                </Text>
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))
                : null}
            </View>
          );
        })}

        <Text style={[styles.footNote, { color: colors.tabIconDefault }]}>{s.grammar.footNote}</Text>
      </ScrollView>

      <ScreenFeedback placement="header" level={level} languagePair={`${contentLang}→${learnedLang}`} currentCard="grammar-syllabus" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  subtitle: { fontSize: 13, textAlign: 'center', marginTop: 2, marginBottom: 8 },
  body: { padding: 14, paddingBottom: 24, gap: 10 },
  levelBlock: { gap: 8 },
  levelHeader: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 2 },
  randomCard: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 2 },
  levelName: { fontSize: 17, fontWeight: '800' },
  levelMeta: { fontSize: 12 },
  unitBlock: { gap: 6, paddingLeft: 6 },
  unitName: { fontSize: 13, fontWeight: '700', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  topicTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  topicTitle: { fontSize: 15, fontWeight: '600' },
  // Filled purple: the speech core, this gets built first.
  corePlusTag: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#FFFFFF',
    backgroundColor: '#7C3AED',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  // Purple marker: this topic is needed to be able to speak, and it shows even
  // if the lesson is not written yet.
  coreTag: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#7C3AED',
    borderColor: '#7C3AED',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  topicBlurb: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  topicBadgeCol: { alignItems: 'flex-end', gap: 2 },
  topicBadge: { fontSize: 12, fontWeight: '700' },
  // neo-brutalist form styles (titles and buttons uppercase, weight 500).
  brutalBody: { padding: 16, paddingTop: 0, paddingBottom: 32, gap: 10 },
  brutalHeaderWrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  brutalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brutalHeaderRight: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  brutalTitle: { flexShrink: 1, fontSize: 30, fontWeight: '500', textTransform: 'uppercase' },
  brutalTitleNarrow: { fontSize: 22 },
  brutalSmall: { fontSize: 11, fontWeight: '500' },
  brutalLevelRow: { flexDirection: 'row', gap: 8 },
  brutalLevelBox: { flex: 1 },
  brutalLevelInner: { paddingVertical: 8, alignItems: 'center' },
  brutalLevelText: { fontSize: 14, fontWeight: '500' },
  brutalUnit: { gap: 10 },
  brutalUnitName: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 },
  brutalTopic: { padding: 12, gap: 6 },
  brutalTopicTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  brutalTopicTitle: { flexShrink: 1, fontSize: 15, fontWeight: '500', textTransform: 'uppercase' },
  brutalStickers: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  brutalBlurb: { fontSize: 12, lineHeight: 17 },
  brutalBar: { marginTop: 2 },
  brutalBadge: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase' },
  brutalGoal: { marginTop: 10 },
  footNote: { fontSize: 12, textAlign: 'center', marginTop: 18, lineHeight: 17 },
});
