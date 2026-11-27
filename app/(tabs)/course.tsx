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
import type { Level } from '@/data/words';
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
import ScreenFeedback from '@/lib/screenFeedback';
import { loadBigTestCard, loadBigTestKnownTopics } from '@/lib/grammar/bigTest';
import { grammarTabLevelKey, parseTabLevel } from '@/lib/grammar/levelTestRoute';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import BigTestCard from '@/components/grammar/BigTestCard';
import { LevelButtons, LevelTestRows, OverallBar } from '@/components/grammar/GrammarLevelPanel';
import LessonSearch from '@/components/grammar/LessonSearch';
import { styles } from '@/components/grammar/courseStyles';
import { filterTopicsBySearch, normalizeSearch } from '@/lib/grammar/lessonSearch';
import { BrutalBox, SegmentBar, Sticker, segmentsFilled, softCaseStyle, softTitleStyle } from '@/components/grammar/Brutal';
import { ExamRoundButton, LevelTestButton } from '@/components/grammar/ExamStrip';
import { examRoundAvailable } from '@/lib/grammar/examRound';
import LevelStanding from '@/components/grammar/LevelStanding';
import { ExamTagClassic } from '@/components/grammar/ExamTag';
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
  // the Big test card: a run in progress and the last stored result level, reloaded on every focus.
  const [bigTest, setBigTest] = useState<{ running: boolean; level: string | null; ready: boolean }>({ running: false, level: null, ready: false });
  // Strong topics of the last Big test: a mark only, no evidence, no percent.
  const [knownFromTest, setKnownFromTest] = useState<Set<string>>(new Set());
  // the lesson search text; while it is not empty the list shows the matching lessons of every level.
  const [query, setQuery] = useState('');
  // the target of the previous load: another direction must not keep the old direction's open level.
  const examTarget = useRef<string | null>(null);

  const load = useCallback(async () => {
    const db = getDb();
    const { target, source } = await refresh(['direction']);
    setLearnedLang(target);
    const directionChanged = examTarget.current !== null && examTarget.current !== target;
    examTarget.current = target;
    // The explanation language is the learner's own (the pair's source), not the language being learned:
    // en→es English, es→en Spanish. A source without lesson text yet (hu) falls back to English per field.
    setContentLang(sourceFor(target, source));

    const levelData = await db.getLevel();
    const lvl = (levelData.level as Level) ?? 'A1';
    setLevel(lvl);

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
    const pair = `${sourceFor(target, source)}→${target}`;
    const card = await loadBigTestCard(db, pair, target);
    setBigTest({ ...card, ready: true });
    setKnownFromTest(await loadBigTestKnownTopics(db, pair));
    // the selected level: the learner's own last pick, else the last Big test's level, else the current level
    const tabLevels: string[] = syllabusLevels(target);
    const saved = parseTabLevel(await loadResumeValue(db, grammarTabLevelKey(pair)), tabLevels);
    const fallback = [card.level, lvl, tabLevels[0]].find((l): l is Level => !!l && tabLevels.includes(l)) ?? 'A1';
    setOpenLevel((current) => (directionChanged ? null : current) ?? (saved as Level | null) ?? fallback);
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
  const overallPct = overallScore(writtenIds, lessonPcts, evidence);
  const randomScore = rr.score(overallPct, weakTopicCount(evidence));

  // the selected level (its lessons are listed), kept per language pair for the next visit
  const shownLevel: Level = openLevel ?? level;
  const selectLevel = (l: Level) => {
    setOpenLevel(l);
    void saveResumeValue(getDb(), grammarTabLevelKey(`${contentLang}→${learnedLang}`), l);
  };
  const tabLevels = syllabusLevels(learnedLang);

  // The lists below: one block per unit of the selected level, or (while searching) one block with the
  // lessons of every level whose title matches, each with its level shown.
  const searching = normalizeSearch(query) !== '';
  const groups: { id: string; name: string | null; topics: ReturnType<typeof topicsForUnit> }[] = searching
    ? [
        {
          id: 'search',
          name: null,
          topics: filterTopicsBySearch(
            tabLevels.flatMap((l) => syllabusForLevel(l, learnedLang)),
            query,
            [contentLang, learnedLang]
          ),
        },
      ]
    : unitsForLevel(shownLevel, learnedLang).map((unit) => ({
        id: unit.id,
        name: unit.title[contentLang] ?? unit.title.en,
        topics: topicsForUnit(unit.id, learnedLang),
      }));
  const noMatch = searching && groups[0].topics.length === 0;
  // the exam round entry sits under the A1 lesson list (not while searching)
  const showExamRound = !searching && shownLevel === 'A1' && examRoundAvailable(learnedLang, 'A1');
  const examRoundWrap = { alignItems: 'flex-start', marginTop: 8 } as const;
  const levelTag = (topic: { level: string }) => (searching ? ` · ${topic.level}` : '');

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
              <Text variant="title" style={[styles.brutalTitle, narrow && styles.brutalTitleNarrow, { color: g.ink }, softTitleStyle(g)]}>{s.tabs.grammar}</Text>
              <View style={styles.brutalHeaderRight}>
                <ScreenFeedback placement="inline" level={level} languagePair={`${contentLang}→${learnedLang}`} currentCard="grammar-syllabus" />
              </View>
            </View>
          </SkinHeader>
        </View>
        <LessonSearch value={query} onChange={setQuery} />
        <ScrollView contentContainerStyle={styles.brutalBody} keyboardShouldPersistTaps="handled">
          {/* While searching, the rest of the tab (cards, level buttons, tests) steps aside so only the matching lessons show. */}
          {!searching ? (
          <>
          <Text style={[styles.brutalSmall, { color: g.mu }]}>
            {s.grammar.coverage(doneCount, coverage.written, coverage.planned)}
          </Text>

          <BigTestCard learnedLang={learnedLang} {...bigTest} />

          <BrutalBox
            testID="grammar-random-start"
            fill="a"
            onPress={() => router.push('/grammar/random' as never)}
            boxStyle={styles.brutalTopic}
          >
            <Text variant="title" style={[styles.brutalTopicTitle, { color: g.onFill }, softTitleStyle(g)]}>{randomTitle}</Text>
            <Text style={[styles.brutalBlurb, { color: g.onFill }]}>{randomScore}</Text>
          </BrutalBox>

          {learnedLang === 'de' ? (
            <BrutalBox
              testID="grammar-tense-drill-start"
              fill="paper"
              onPress={() => router.push('/grammar/tense-drill' as never)}
              boxStyle={styles.brutalTopic}
            >
              <Text variant="title" style={[styles.brutalTopicTitle, { color: g.ink }, softTitleStyle(g)]}>{`🔤 ${s.tenseDrill.start}`}</Text>
              <Text style={[styles.brutalBlurb, { color: g.ink }]}>{s.tenseDrill.blurb}</Text>
            </BrutalBox>
          ) : null}

          <LevelButtons levels={tabLevels} selected={shownLevel} current={level} onSelect={selectLevel} />
          <OverallBar level={bigTest.level ?? level} pct={overallPct} />
          <LevelTestRows levels={tabLevels} learnedLang={learnedLang} contentLang={contentLang} evidence={evidence} />
          <Text style={[styles.brutalSmall, { color: g.mu }]}>
            {s.grammar.levelMeta(shownDone, shownTopics.length, shownWritten)}
            {shownLevel === level ? ` · ${s.grammar.yourLevel}` : ''}
          </Text>
          <LevelStanding level={shownLevel} learnedLang={learnedLang} contentLang={contentLang} evidence={evidence} />
          <LevelTestButton level={shownLevel} />
          </>
          ) : null}
          {noMatch ? <Text testID="grammar-search-none" style={[styles.brutalSmall, { color: g.mu }]}>{s.grammar.searchNone}</Text> : null}
          {groups.map((unit) => (
            <View key={unit.id} style={styles.brutalUnit}>
              {unit.name ? (
                <Text style={[styles.brutalUnitName, { color: g.mu }, softTitleStyle(g)]}>
                  {unit.name}
                </Text>
              ) : null}
              {unit.topics.map((topic) => {
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
                      <Text variant="title" style={[styles.brutalTopicTitle, { color: textColor }, softTitleStyle(g)]}>
                        {`${topic.title[contentLang] ?? topic.title.en}${levelTag(topic)}`}
                      </Text>
                    </View>
                    {tier || isDone || testPassed.has(topic.id) || knownFromTest.has(topic.id) ? (
                      <View style={styles.brutalStickers}>
                        {tier === 'core-plus' ? (
                          <Sticker testID={`grammar-core-plus-${topic.id}`} label={s.grammar.corePlusTag} fill="paper" rotate={-4} />
                        ) : tier === 'core' ? (
                          <Sticker testID={`grammar-core-${topic.id}`} label={s.grammar.coreTag} fill="paper" rotate={-4} />
                        ) : tier === 'exam' ? (
                          <Sticker testID={`grammar-exam-tag-${topic.id}`} label={s.grammar.examTag} fill="paper" rotate={-4} />
                        ) : null}
                        {isDone ? <Sticker label={s.grammar.doneTag} fill="a" rotate={5} /> : null}
                        {testPassed.has(topic.id) ? (
                          <Sticker testID={`grammar-test-passed-${topic.id}`} label={s.lessonTest.passedTag} fill="b" rotate={-3} />
                        ) : null}
                        {knownFromTest.has(topic.id) ? <Sticker testID={`grammar-known-${topic.id}`} label={s.grammar.knownFromTestTag} fill="paper" rotate={3} /> : null}
                      </View>
                    ) : null}
                    {/* No numberOfLines clipping: a theme with a wide / tall font wraps onto 3+ lines, we do not truncate it. */}
                    <Text style={[styles.brutalBlurb, { color: textColor }]}>
                      {topic.blurb[contentLang] ?? topic.blurb.en}
                    </Text>
                    {inProgress && badgePct !== null ? (
                      <SegmentBar segments={6} filled={segmentsFilled(badgePct, 6)} style={styles.brutalBar} />
                    ) : null}
                    <Text testID={`grammar-percent-${topic.id}`} style={[styles.brutalBadge, { color: textColor }, softTitleStyle(g)]}>
                      {badge}
                    </Text>
                  </BrutalBox>
                );
              })}
            </View>
          ))}

          {showExamRound ? <View style={examRoundWrap}><ExamRoundButton level="A1" /></View> : null}

          {!searching ? (
          <>
          <Text style={[styles.footNote, { color: g.mu }]}>{s.grammar.footNote}</Text>
          </>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* This is now the root of the Grammar tab, not a pushed screen,
          the title+back row comes from the tab navigator's own header (s.tabs.grammar). */}
      {!searching ? (
        <Text style={[styles.subtitle, { color: colors.tabIconDefault, marginTop: 12 }]}>
          {s.grammar.coverage(doneCount, coverage.written, coverage.planned)}
        </Text>
      ) : (
        <View style={{ height: 12 }} />
      )}
      <LessonSearch value={query} onChange={setQuery} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* While searching, the rest of the tab (cards, level buttons, tests) steps aside so only the matching lessons show. */}
        {!searching ? (
        <>
        <BigTestCard learnedLang={learnedLang} {...bigTest} />

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

        <LevelButtons levels={tabLevels} selected={shownLevel} current={level} onSelect={selectLevel} />
        <OverallBar level={bigTest.level ?? level} pct={overallPct} />
        <LevelTestRows levels={tabLevels} learnedLang={learnedLang} contentLang={contentLang} evidence={evidence} />
        </>
        ) : null}
        {noMatch ? <Text testID="grammar-search-none" style={[styles.levelMeta, { color: colors.tabIconDefault }]}>{s.grammar.searchNone}</Text> : null}

        {[shownLevel].map((lvl) => {
          const topics = syllabusForLevel(lvl, learnedLang);
          const written = topics.filter((tp) => hasLesson(learnedLang, tp.id)).length;
          const done = topics.filter((tp) => progress.get(tp.id)?.state === 'done').length;
          const isOpen = lvl === shownLevel;
          const isCurrent = lvl === level;

          return (
            <View key={lvl} style={styles.levelBlock}>
              {!searching ? (
              <>
              <View
                testID={`grammar-level-header-${lvl}`}
                style={[
                  styles.levelHeader,
                  { backgroundColor: colors.card, borderColor: isCurrent ? colors.tint : 'transparent' },
                ]}
              >
                <Text style={[styles.levelName, { color: colors.text }]}>
                  {lvl}
                  {isCurrent ? ` · ${s.grammar.yourLevel}` : ''}
                </Text>
                <Text style={[styles.levelMeta, { color: colors.tabIconDefault }]}>
                  {s.grammar.levelMeta(done, topics.length, written)}
                </Text>
                <LevelStanding level={lvl} learnedLang={learnedLang} contentLang={contentLang} evidence={evidence} />
              </View>
              <LevelTestButton level={lvl} />
              </>
              ) : null}

              {isOpen
                ? groups.map((unit) => (
                    <View key={unit.id} style={styles.unitBlock}>
                      {unit.name ? (
                        <Text style={[styles.unitName, { color: colors.tint }, softCaseStyle(g)]}>
                          {unit.name}
                        </Text>
                      ) : null}
                      {unit.topics.map((topic) => {
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
                                  {`${topic.title[contentLang] ?? topic.title.en}${levelTag(topic)}`}
                                </Text>
                                {getGrammarTier(topic.id) === 'core-plus' ? (
                                  <Text testID={`grammar-core-plus-${topic.id}`} style={[tagStyles.corePlusTag, softCaseStyle(g)]}>
                                    {s.grammar.corePlusTag}
                                  </Text>
                                ) : getGrammarTier(topic.id) === 'core' ? (
                                  <Text testID={`grammar-core-${topic.id}`} style={[tagStyles.coreTag, { color: legibleOn('#7C3AED', colors.card) }, softCaseStyle(g)]}>
                                    {s.grammar.coreTag}
                                  </Text>
                                ) : getGrammarTier(topic.id) === 'exam' ? (
                                  <ExamTagClassic topicId={topic.id} />
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
                              {knownFromTest.has(topic.id) ? <Text testID={`grammar-known-${topic.id}`} style={[styles.topicBadge, { color: colors.tabIconDefault }]}>{s.grammar.knownFromTestTag}</Text> : null}
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

        {showExamRound ? <View style={examRoundWrap}><ExamRoundButton level="A1" /></View> : null}

        {!searching ? <Text style={[styles.footNote, { color: colors.tabIconDefault }]}>{s.grammar.footNote}</Text> : null}
      </ScrollView>

      <ScreenFeedback placement="header" level={level} languagePair={`${contentLang}→${learnedLang}`} currentCard="grammar-syllabus" />
    </View>
  );
}

// The tier tags carry their own purple (a fixed brand colour, not a theme token).
const tagBase = { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 } as const;
const tagStyles = StyleSheet.create({
  corePlusTag: { ...tagBase, color: '#FFFFFF', backgroundColor: '#7C3AED' },
  coreTag: { ...tagBase, color: '#7C3AED', borderColor: '#7C3AED', borderWidth: 1 },
});
