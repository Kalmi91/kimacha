import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/KText';
import { useRouter } from 'expo-router';

import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { normalizeWordToken } from '@/data/words';
import { cumulativeCorpusWordIds, grammarKindCounts, type GrammarGapItem, type GrammarItem } from '@/lib/games/content';
import { buildGlossMap } from '@/lib/games/gloss';
import { nextWrittenTopic, syllabusTopic } from '@/lib/grammar/syllabus';
import { kindPercent, kindProgressFromRows, kindRunKey, runSummary, type KindRun } from '@/lib/grammar/lessonScore';
import { tableCellsForLesson, wordCellsForLesson, WORD_DECK_MIN_CARDS } from '@/lib/grammar/tableDeck';
import { TRANSFORM_ROUND_SIZE } from '@/lib/grammar/transformRounds';
import { ARTICLE_LESSON_ID, ARTICLE_ROUND_SIZE } from '@/lib/grammar/nounArticles';
import { lessonTestFromRows, lessonTestKey } from '@/lib/grammar/lessonTest';
import { KIND_ORDER, useGrammarTopic } from '@/lib/grammar/useGrammarTopic';
import { getScrollY, setScrollY } from '@/lib/grammar/scrollMemory';
import { speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import GlossText from '@/components/games/GlossText';
import GrammarDrill from '@/components/grammar/GrammarDrill';
import GrammarRoundEnd from '@/components/grammar/GrammarRoundEnd';
import LessonBody from '@/components/grammar/LessonBody';
import LessonTest from '@/components/grammar/LessonTest';
import ScreenFeedback from '@/lib/screenFeedback';
import FitText from '@/components/FitText';
import SpeakButton from '@/components/SpeakButton';
import { BrutalBox, Card, Sticker, themedDockPad } from '@/components/grammar/Brutal';
import { accentColor } from '@/components/grammar/Themed';
import { DockSlotProvider } from '@/components/learn/DockSlot';
import { styles } from '@/components/grammar/GrammarTopic.styles';

// One grammar lesson: the rule first, then the practice.
//
// The lesson READS (rule, the exceptions block, worked examples you can tap for
// meaning and hear spoken), and only then drills, because the Game tab's
// grammar-choice already covers "drill first, explanation after" and the point
// of the course is the other order: understand, then check.


// The lesson's one 💬 button sits outside the phase switch below: the card id is `grammar:<topic>:<phase>`.
// The test phase is the exception, its card carries the question's part and lives in LessonTest.
export default function GrammarLessonScreen() {
  const topic = useGrammarTopic();
  const { topicId, level, contentLang, learnedLang, lesson, phase, score, drillItemId, dock } = topic;
  const feedbackPhase = !lesson
    ? 'soon'
    : phase === 'test'
      ? null
      : phase === 'drill'
        ? `drill${drillItemId ? `:${drillItemId}` : ''}`
        : phase === 'done' && score
          ? 'done'
          : 'lesson';
  return (
    <>
      <GrammarLessonPhases topic={topic} />
      {feedbackPhase ? (
        <ScreenFeedback
          level={level}
          languagePair={`${contentLang}→${learnedLang}`}
          currentCard={`grammar:${topicId}:${feedbackPhase}`}
          bottomOffset={lesson && phase === 'drill' ? dock.bottomOffset : undefined}
        />
      ) : null}
    </>
  );
}

function GrammarLessonPhases({ topic }: { topic: ReturnType<typeof useGrammarTopic> }) {
  const {
    colors,
    topicId,
    learnedLang,
    contentLang,
    level,
    lesson,
    phase,
    setPhase,
    score,
    setScore,
    drillKind,
    setDrillKind,
    setDrillItemId,
    dock,
    scrollRef,
    speaking,
    transformSeen,
    progressRows,
    roundStats,
    setRoundStats,
    prevPct,
    streak,
    toggleLessonSpeech,
    saveRow,
    lessonScoreOf,
    finish,
  } = topic;
  // a stable array: GrammarDrill's round memo and its onItemChange effect depend on `kinds`.
  const drillKinds = useMemo(() => [drillKind], [drillKind]);
  const g = useGrammarColors();
  const s = t();
  const router = useRouter();

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
      </View>
    );
  }

  // title is Record<en/es,string>-like in both schemas, but
  // LessonV2's Lang4 does not allow an arbitrary string index, hence the cast.
  const lessonTitle = (lesson.title as Record<string, string>)[contentLang] ?? lesson.title.en;
  const knownIds = cumulativeCorpusWordIds(lesson.level, learnedLang);
  const overrides = Object.fromEntries((lesson.glossary ?? []).map((g) => [normalizeWordToken(g.word), g.gloss]));
  // a button only for the kinds that have items in the lesson
  // (e.g. hay-estar gets no conjugation button, since it has no form item).
  const kindCounts = grammarKindCounts(lesson);
  const availableKinds = KIND_ORDER.filter((k) => kindCounts[k] > 0);
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
  const accentText = accentColor(g, colors.tint);

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
            kinds={drillKinds}
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
      </View>
    );
  }

  if (phase === 'done' && score) {
    return (
      <GrammarRoundEnd
        score={score}
        topicId={String(topicId)}
        learnedLang={learnedLang}
        contentLang={contentLang}
        lesson={lesson}
        progressRows={progressRows}
        roundStats={roundStats}
        streak={streak}
        prevPct={prevPct}
        drillKind={drillKind}
        kindCounts={kindCounts}
        lessonTestResult={lessonTestResult}
        header={header}
        lessonScoreOf={lessonScoreOf}
        setPhase={setPhase}
        setScore={setScore}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {header}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.body, themedDockPad(g)]}
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
        <LessonBody blocks={lesson.body} contentLang={contentLang as 'en' | 'es'} learnedLang={learnedLang} />

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
    </View>
  );
}
