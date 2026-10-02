import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import { getDb } from '@/lib/database';
import { PCIC_LEVELS, findPcicItem, pcicItemsForLevel, setPcicTarget, type PcicLevel, type PcicTarget } from '@/data/pcic';
import { GRAMMAR_PROGRESS_KEY, doneGrammarTopicProgress, syllabusTopic } from '@/lib/grammar/syllabus';
import { resolvedTensesFromLessons, type ResolvedTense } from '@/lib/knownSentence';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { localDateString } from '@/lib/usageStats';
import { Card, SegmentBar, segmentsFilled } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import ExamButton from '@/components/exam/ExamButton';
import ExamChoiceCard from '@/components/exam/ExamChoiceCard';
import ExamMatchCard from '@/components/exam/ExamMatchCard';
import ExamSkillRow from '@/components/exam/ExamSkillRow';
import ExamTilesCard from '@/components/exam/ExamTilesCard';
import ExamTypeCard from '@/components/exam/ExamTypeCard';
import { buildExam } from '@/lib/exam/builder';
import { gapSourcesForLevel, type GapSource } from '@/lib/exam/grammarItems';
import { requeueWrongWords } from '@/lib/exam/requeue';
import { EXAM_PASS_PCT, scoreExam, type ExamScore } from '@/lib/exam/score';
import { skillResults, weakLessons } from '@/lib/exam/skills';
import { EXAM_LEVELS, type ExamItem, type ExamItemResult } from '@/lib/exam/types';
import { examStatusFor } from '@/lib/exam/unlock';
import type { Sm2Card } from '@/lib/sm2';

// PLAN-vizsga A. szakasz 2. lépés (Kálmán, 2026-10-01): a szintvizsga képernyője.
// Bevezető -> kérdések (nincs élet; helyes válasz után nincs visszajelzés, hibás után
// a helyes látszik: A5 c) -> eredmény (átmenéskor gomb a következő szintre, Kálmán
// dönt: A6 a; bukáskor pontszám + újrapróba). Az eredmény mentése: lib/exam/result.ts.

type Phase = 'loading' | 'locked' | 'empty' | 'intro' | 'running' | 'result';

interface Source {
  target: PcicTarget;
  cards: Sm2Card[];
  tenses: ReadonlySet<ResolvedTense>;
  gapSources: GapSource[];
  strictAccents: boolean;
}

function ExamItemView({ item, source, onDone }: { item: ExamItem; source: Source; onDone: (correct: boolean) => void }) {
  const s = t();
  switch (item.kind) {
    case 'word_type':
      return (
        <ExamTypeCard
          prompt={item.prompt}
          hint={item.hint}
          answer={item.answer}
          sentence={false}
          targetLang={source.target}
          strictAccents={source.strictAccents}
          onDone={onDone}
        />
      );
    case 'sent_type':
      return (
        <ExamTypeCard
          prompt={item.prompt}
          answer={item.answer}
          sentence
          targetLang={source.target}
          strictAccents={source.strictAccents}
          onDone={onDone}
        />
      );
    case 'sent_order':
      return <ExamTilesCard prompt={item.prompt} answerTokens={item.answerTokens} sentence={item.sentence} distractors={item.distractors} onDone={onDone} />;
    case 'match':
      return <ExamMatchCard pairs={item.pairs} onDone={onDone} />;
    case 'gap_mc':
      return <ExamChoiceCard heading={s.exam.chooseGap} text={item.sentence} options={item.options} correctIndex={item.correctIndex} onDone={onDone} />;
    case 'reading_mc':
      return <ExamChoiceCard heading={s.exam.readText} text={item.text} options={item.options} correctIndex={item.correctIndex} onDone={onDone} />;
  }
}

export default function ExamScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const router = useRouter();
  const params = useLocalSearchParams<{ level?: string }>();
  const level: PcicLevel = EXAM_LEVELS.find((l) => l === params.level) ?? EXAM_LEVELS[0];

  const [phase, setPhase] = useState<Phase>('loading');
  const [source, setSource] = useState<Source | null>(null);
  const [exam, setExam] = useState<ExamItem[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ExamItemResult[]>([]);
  const [score, setScore] = useState<ExamScore | null>(null);
  const [leaving, setLeaving] = useState(false);

  const make = useCallback(
    (src: Source): ExamItem[] =>
      buildExam({
        target: src.target,
        items: pcicItemsForLevel(level),
        cards: src.cards,
        tenses: src.tenses,
        gapSources: src.gapSources,
        lookup: findPcicItem,
        seed: Date.now(),
      }),
    [level],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const db = getDb();
      const onboarding = await db.getOnboarding();
      const target: PcicTarget = (onboarding?.target as PcicTarget | undefined) ?? 'es';
      setPcicTarget(target);
      const [cards, grammarRows, strictAccents] = await Promise.all([
        db.getPcicCards(),
        db.getGameProgress(GRAMMAR_PROGRESS_KEY),
        db.getStrictAccents(),
      ]);
      if (!alive) return;
      const doneTopics = [...doneGrammarTopicProgress(target, grammarRows).keys()];
      const src: Source = {
        target,
        cards,
        tenses: target === 'es' ? resolvedTensesFromLessons(doneTopics) : new Set<ResolvedTense>(),
        gapSources: gapSourcesForLevel(level, target, doneTopics),
        strictAccents,
      };
      setSource(src);
      if (!examStatusFor(level, target, cards, grammarRows).unlocked) {
        setPhase('locked');
        return;
      }
      const items = make(src);
      setExam(items);
      setPhase(items.length === 0 ? 'empty' : 'intro');
    })();
    return () => {
      alive = false;
    };
  }, [level, make]);

  const start = () => {
    setIndex(0);
    setResults([]);
    setScore(null);
    setPhase('running');
  };

  const retry = () => {
    if (!source) return;
    setExam(make(source));
    start();
  };

  const finish = async (all: ExamItemResult[]) => {
    const sc = scoreExam(all);
    const db = getDb();
    const today = localDateString();
    await db.saveExamResult(level, sc.pct, sc.passed, today);
    // 5. lépés (2b): az elrontott szó-tétel kártyája `again`-nel visszamegy az SM-2 ismétlésbe
    // (a nyelvtani hibának nincs kártyája, annak az eredmény-lap a lecke-linkje a visszacsatolás).
    // A friss kártyák a memóriában is frissülnek, hogy az újrapróba ne húzza újra a most elrontott szót.
    const back = source ? requeueWrongWords(source.cards, all, today) : [];
    for (const card of back) await db.upsertPcicCard(card);
    if (source && back.length > 0) {
      const fresh = new Map(back.map((c) => [c.itemId, c]));
      setSource({ ...source, cards: source.cards.map((c) => fresh.get(c.itemId) ?? c) });
    }
    setScore(sc);
    setPhase('result');
  };

  const answered = (correct: boolean) => {
    const all = [...results, { item: exam[index], correct }];
    setResults(all);
    if (index + 1 >= exam.length) finish(all);
    else setIndex(index + 1);
  };

  const levelIdx = PCIC_LEVELS.indexOf(level);
  const nextLevel = PCIC_LEVELS[levelIdx + 1];
  const goNext = async () => {
    if (!nextLevel) return;
    await getDb().setPcicLevel(nextLevel);
    router.back();
  };

  const counts = (skill: ExamItem['skill']) => exam.filter((i) => i.skill === skill).length;

  // 6. lépés (2c): a gyenge szó- (vagy olvasás-)pontnál a tanulófülre vissza, az aktuális szint paklijára.
  const practiceWords = async () => {
    await getDb().setPcicLevel(level);
    router.back();
  };

  const shell = (children: ReactNode) => (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>{children}</View>
  );

  if (phase === 'loading') {
    return shell(<ActivityIndicator style={styles.centered} color={colors.tint} />);
  }

  if (phase === 'locked' || phase === 'empty') {
    return shell(
      <View style={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text style={[styles.title, { color: colors.text }]}>{phase === 'locked' ? s.exam.lockedTitle : s.exam.title(level)}</Text>
          <Text style={[styles.line, { color: colors.textMuted }]}>{phase === 'locked' ? s.exam.lockedBody : s.exam.emptyBody}</Text>
        </Card>
        <ExamButton testID="exam-back" label={s.exam.back} onPress={() => router.back()} />
      </View>,
    );
  }

  if (phase === 'intro') {
    return shell(
      <View style={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text style={[styles.title, { color: colors.text }]}>{s.exam.title(level)}</Text>
          {counts('words') > 0 && <Text style={[styles.line, { color: colors.text }]}>{s.exam.introWords(counts('words'))}</Text>}
          {counts('grammar') > 0 && <Text style={[styles.line, { color: colors.text }]}>{s.exam.introGrammar(counts('grammar'))}</Text>}
          {counts('reading') > 0 && <Text style={[styles.line, { color: colors.text }]}>{s.exam.introReading(counts('reading'))}</Text>}
          <Text style={[styles.line, { color: colors.textMuted }]}>{s.exam.introRules}</Text>
          <Text style={[styles.line, { color: colors.text }]}>{s.exam.introPass(EXAM_PASS_PCT)}</Text>
        </Card>
        <ExamButton testID="exam-start" label={s.exam.start} onPress={start} />
        <ExamButton testID="exam-not-now" secondary label={s.exam.notNow} onPress={() => router.back()} />
      </View>,
    );
  }

  if (phase === 'result' && score) {
    // 6. lépés (2c): készségenként pont és %, a gyenge pontoknál link (nyelvtan: a leggyakrabban elrontott
    // leckék; szó, olvasás: vissza a tanulófülre ezen a szinten).
    const skills = skillResults(score);
    const isWeak = (skill: ExamItem['skill']) => skills.some((r) => r.skill === skill && r.weak);
    const contentLang = source?.target === 'en' ? 'es' : 'en';
    const lessonLinks = isWeak('grammar') ? weakLessons(results) : [];
    const skillLabels: Record<ExamItem['skill'], string> = { words: s.exam.skillWords, grammar: s.exam.skillGrammar, reading: s.exam.skillReading };
    return shell(
      <ScrollView contentContainerStyle={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <ResultBadge testID="exam-verdict" correct={score.passed} label={score.passed ? s.exam.passedTitle(level) : s.exam.notYet} />
          <Text testID="exam-score" style={[styles.title, { color: colors.text }]}>
            {s.exam.score(score.correct, score.total, score.pct)}
          </Text>
          {!score.passed && <Text style={[styles.line, { color: colors.textMuted }]}>{s.exam.needPass(EXAM_PASS_PCT)}</Text>}
        </Card>
        {skills.length > 0 && (
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            {skills.map((r) => (
              <ExamSkillRow key={r.skill} result={r} label={skillLabels[r.skill]} colors={colors} />
            ))}
          </Card>
        )}
        {lessonLinks.map((l) => {
          const topic = syllabusTopic(l.topicId, source?.target ?? 'es');
          return (
            <ExamButton
              key={l.topicId}
              testID={`exam-lesson-${l.topicId}`}
              secondary
              label={s.exam.skillReviewLesson(topic?.title[contentLang] ?? topic?.title.en ?? l.topicId)}
              onPress={() => router.push(`/grammar/${l.topicId}` as never)}
            />
          );
        })}
        {isWeak('words') && <ExamButton testID="exam-review-words" secondary label={s.exam.skillReviewWords} onPress={practiceWords} />}
        {!isWeak('words') && isWeak('reading') && (
          <ExamButton testID="exam-practice-sentences" secondary label={s.exam.skillPracticeSentences} onPress={practiceWords} />
        )}
        {score.passed && nextLevel && pcicItemsForLevel(nextLevel).length > 0 && (
          <ExamButton testID="exam-continue" label={s.exam.continueTo(nextLevel)} onPress={goNext} />
        )}
        {!score.passed && <ExamButton testID="exam-retry" label={s.exam.tryAgain} onPress={retry} />}
        <ExamButton testID="exam-exit" secondary label={s.exam.exit} onPress={() => router.back()} />
      </ScrollView>,
    );
  }

  if (leaving) {
    return shell(
      <View style={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text style={[styles.title, { color: colors.text }]}>{s.exam.leaveTitle}</Text>
          <Text style={[styles.line, { color: colors.textMuted }]}>{s.exam.leaveBody}</Text>
        </Card>
        <ExamButton testID="exam-leave" label={s.exam.leave} onPress={() => router.back()} />
        <ExamButton testID="exam-keep-going" secondary label={s.exam.keepGoing} onPress={() => setLeaving(false)} />
      </View>,
    );
  }

  const pct = exam.length > 0 ? (index / exam.length) * 100 : 0;
  return shell(
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable testID="exam-close" accessibilityRole="button" accessibilityLabel={s.exam.leaveTitle} hitSlop={12} onPress={() => setLeaving(true)}>
          <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
        </Pressable>
        <Text testID="exam-counter" style={[styles.counter, { color: colors.textMuted }]}>
          {s.exam.question(index + 1, exam.length)}
        </Text>
        <View style={styles.closeSpacer} />
      </View>
      {g.brutal ? (
        <SegmentBar testID="exam-progress" filled={segmentsFilled(pct, 8)} segments={8} style={styles.brutalProgress} />
      ) : (
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.fill, { backgroundColor: colors.tint, width: `${pct}%` }]} />
        </View>
      )}
      {source && exam[index] && <ExamItemView key={index} item={exam[index]} source={source} onDone={answered} />}
    </KeyboardAvoidingView>,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: spacing.xl },
  flex: { flex: 1 },
  centered: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md },
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
