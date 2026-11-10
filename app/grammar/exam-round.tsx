import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import ExamButton from '@/components/exam/ExamButton';
import ClozeTask from '@/components/exam/mock/ClozeTask';
import { FAB_CLEARANCE } from '@/components/learn/DockedAction';
import { pcicItemsForLevel, type PcicLevel, type PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { buildGlossaryIndex, mockGlossary, type GlossaryEntry } from '@/lib/exam/mock/glossary';
import type { MockClozeTask } from '@/lib/exam/mock/types';
import { isExamLearned } from '@/lib/exam/unlock';
import {
  ROUND_TEXTS,
  examRoundFile,
  examRunKey,
  nextSeen,
  parseExamRun,
  pickRoundTexts,
  scoreText,
  type ExamAnswers,
  type ExamRoundText,
  type ExamRun,
} from '@/lib/grammar/examRound';
import { GRAMMAR_RANDOM_KEY, appendEvidence, evidenceFromRows, type TopicEvidence } from '@/lib/grammar/randomRound';
import { hasLesson, syllabusForLevel, syllabusTopic } from '@/lib/grammar/syllabus';
import { t } from '@/lib/i18n';
import { sourceFor } from '@/lib/languagePair';
import { useLearner } from '@/lib/learner';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import ScreenFeedback from '@/lib/screenFeedback';
import { useTheme } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';

// The exam round (Grammar tab, the first button of the exam strip): two gap texts in exam format, one text per page,
// 6 gaps with 3 options each, no feedback until "Check". The texts are picked so that the weakest topics of the level get
// the most gaps (lib/grammar/examRound.ts). Every gap names its grammar topic: the result page shows the right word and the
// topic of each gap, and every answer is saved as test evidence of its topic (kind `cloze`, the same game_progress rows
// the level test writes), so the exam strip's percent and "Weakest now" move. The run (texts, position, picks, checked)
// is kept in the resume store; the evidence of a text is written exactly once, in the same queue step that saves
// `checked`, so a result page restored from the store writes nothing.

interface Loaded {
  learnedLang: string;
  contentLang: string;
  userLevel: string;
  level: string;
  texts: ExamRoundText[];
  /** Every text id of the file (for the finished-rounds list). */
  allIds: string[];
  glossaryIndex: ReturnType<typeof buildGlossaryIndex>;
  learned: ReadonlySet<string>;
}

export default function ExamRoundScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().examRound;
  const router = useRouter();
  const params = useLocalSearchParams<{ level?: string }>();
  const { refresh } = useLearner();

  // 'loading' | 'empty' | the loaded round
  const [state, setState] = useState<'loading' | 'empty' | Loaded>('loading');
  const [run, setRun] = useState<ExamRun | null>(null);
  const [evidence, setEvidence] = useState<Map<string, TopicEvidence>>(new Map());
  // the saves run one after the other, in the order of the actions
  const queue = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((job: () => Promise<void>) => {
    queue.current = queue.current.then(job).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const db = getDb();
      const { target, source } = await refresh(['direction']);
      const level = params.level ?? '';
      const file = examRoundFile(target, level);
      if (!file || file.texts.length < ROUND_TEXTS) {
        if (alive) setState('empty');
        return;
      }
      const userLevel = (await db.getLevel()).level;
      const ids = syllabusForLevel(level as never, target).filter((tp) => hasLesson(target, tp.id)).map((tp) => tp.id);
      const ev = evidenceFromRows(await db.getGameProgress(GRAMMAR_RANDOM_KEY));
      const contentLang = sourceFor(target, source);
      const pair = `${contentLang}→${target}`;
      const saved = parseExamRun(await loadResumeValue(db, examRunKey(pair, level)));
      const cards = await db.getPcicCards().catch(() => []);
      if (!alive) return;
      const byId = new Map(file.texts.map((x) => [x.id, x]));
      // an open round whose texts are all still in the file continues; anything else starts a new round (the finished texts stay in `seen`)
      const resumable = saved !== null && saved.texts.length === ROUND_TEXTS && saved.texts.every((id) => byId.has(id));
      let current: ExamRun;
      if (resumable) current = saved;
      else {
        const seen = (saved?.seen ?? []).filter((id) => byId.has(id));
        const seed = Date.now() % 2147483647;
        const picked = pickRoundTexts(file.texts, ids, ev, seen, seed);
        current = { texts: picked.map((x) => x.id), index: 0, answers: {}, checked: false, seed, seen };
        enqueue(async () => void (await saveResumeValue(db, examRunKey(pair, level), current)));
      }
      const texts = current.texts.map((id) => byId.get(id)!);
      setEvidence(ev);
      setRun(current);
      setState({
        learnedLang: target,
        contentLang,
        userLevel,
        level,
        texts,
        allIds: file.texts.map((x) => x.id),
        glossaryIndex: buildGlossaryIndex(pcicItemsForLevel(level as PcicLevel), target as PcicTarget, source),
        learned: new Set(cards.filter(isExamLearned).map((c) => c.itemId)),
      });
    })().catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the load runs once per visit
  }, []);

  const loaded = typeof state === 'object' ? state : null;
  const text = loaded && run ? loaded.texts[run.index] : null;

  // the text as a mock-exam cloze task (no audio), for the existing ClozeTask renderer
  const task = useMemo<MockClozeTask | null>(
    () =>
      text
        ? {
            id: text.id,
            kind: 'cloze',
            skill: 'reading',
            instruction: s.instruction,
            title: text.title,
            text: text.text,
            gaps: text.gaps.map((g) => ({ options: g.options, correct: g.correct })),
          }
        : null,
    [text, s.instruction],
  );
  const glossary = useMemo<GlossaryEntry[]>(
    () => (loaded && task ? mockGlossary(task, loaded.glossaryIndex, loaded.learned) : []),
    [loaded, task],
  );

  const shell = (children: React.ReactNode) => <View style={[styles.screen, { backgroundColor: colors.background }]}>{children}</View>;

  if (state === 'empty') {
    return shell(
      <View style={styles.flex}>
        <View style={styles.header}>
          <Pressable testID="exam-round-close" accessibilityRole="button" accessibilityLabel={s.leave} hitSlop={12} onPress={() => router.back()}>
            <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
          </Pressable>
        </View>
        <Text testID="exam-round-empty" style={[styles.line, { color: colors.textMuted }]}>{s.empty}</Text>
      </View>,
    );
  }
  if (!loaded || !run || !text || !task) return shell(<ActivityIndicator style={styles.flex} color={colors.tint} />);

  const pair = `${loaded.contentLang}→${loaded.learnedLang}`;
  const saveRun = (r: ExamRun) => enqueue(async () => void (await saveResumeValue(getDb(), examRunKey(pair, loaded.level), r)));
  const titleOf = (id: string) => {
    const tp = syllabusTopic(id, loaded.learnedLang);
    return tp ? (tp.title[loaded.contentLang] ?? tp.title.en) : id;
  };
  const wordOf = (i: number, option: number | null) => (option === null ? '-' : (text.gaps[i].options[option] ?? '-'));

  const answered = (gap: string, value: string | number | boolean | null) => {
    if (run.checked || typeof value !== 'number') return;
    const next: ExamRun = { ...run, answers: { ...run.answers, [gap]: value } };
    setRun(next);
    saveRun(next);
  };

  const check = () => {
    const rows = scoreText(text, run.answers);
    // two gaps of one topic: both go onto the same evidence, in gap order, before the save
    const nextEvidence = new Map(evidence);
    const touched: string[] = [];
    for (const r of rows) {
      const answer = { id: `${text.id}#${r.n}`, kind: 'cloze' as const, ok: r.ok, at: localDateString() };
      nextEvidence.set(r.topic, appendEvidence(nextEvidence.get(r.topic), answer));
      if (!touched.includes(r.topic)) touched.push(r.topic);
    }
    const next: ExamRun = { ...run, checked: true };
    setEvidence(nextEvidence);
    setRun(next);
    enqueue(async () => {
      const db = getDb();
      for (const topic of touched) await db.setGameProgress(GRAMMAR_RANDOM_KEY, topic, 'evidence', nextEvidence.get(topic));
      await saveResumeValue(db, examRunKey(pair, loaded.level), next);
    });
  };

  const nextText = () => {
    const next: ExamRun = { ...run, index: run.index + 1, answers: {}, checked: false };
    setRun(next);
    saveRun(next);
  };

  const finish = () => {
    // the run is cleared (no texts), the finished texts stay in `seen`
    const cleared: ExamRun = { texts: [], index: 0, answers: {}, checked: false, seed: run.seed, seen: nextSeen(run.seen, run.texts, loaded.allIds) };
    saveRun(cleared);
    router.back();
  };

  const complete = Object.keys(run.answers).length >= text.gaps.length && text.gaps.every((_, i) => typeof run.answers[String(i)] === 'number');
  const part = `${text.id}:${run.checked ? 'result' : 'text'}`;
  const header = (
    <View style={styles.header}>
      <Pressable testID="exam-round-close" accessibilityRole="button" accessibilityLabel={s.leave} hitSlop={12} onPress={() => router.back()}>
        <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
      </Pressable>
      <Text testID="exam-round-header" style={[styles.counter, { color: colors.textMuted }]}>
        {`${s.title(loaded.level)} · ${s.textOf(run.index + 1, run.texts.length)}`}
      </Text>
      <ScreenFeedback placement="inline" level={loaded.userLevel} languagePair={pair} currentCard={`grammar-exam-round:${loaded.level}:${part}`} />
    </View>
  );

  if (!run.checked) {
    return shell(
      <View style={styles.flex}>
        {header}
        <ScrollView testID="exam-round-scroll" contentContainerStyle={styles.body}>
          <ClozeTask
            key={text.id}
            task={task}
            answer={run.answers as ExamAnswers}
            onAnswer={answered}
            target={loaded.learnedLang as PcicTarget}
            canSpeak={false}
            glossary={glossary}
          />
          <ExamButton testID="exam-round-check" label={s.check} disabled={!complete} onPress={check} />
        </ScrollView>
      </View>,
    );
  }

  const rows = scoreText(text, run.answers);
  const right = rows.filter((r) => r.ok).length;
  const repeat = rows.filter((r) => !r.ok).map((r) => r.topic).filter((id, i, all) => all.indexOf(id) === i);
  const last = run.index >= run.texts.length - 1;
  return shell(
    <View style={styles.flex}>
      {header}
      <ScrollView testID="exam-round-scroll" contentContainerStyle={styles.body}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text testID="exam-round-score" style={[styles.title, { color: colors.text }]}>{s.score(right, rows.length)}</Text>
        </Card>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          {rows.map((r, i) => (
            <View key={r.n} testID={`exam-round-gap-${r.n}`} style={styles.gapRow}>
              {r.ok ? (
                <Text style={[styles.gapLine, { color: colors.success }]}>{`✓ ${wordOf(i, r.picked)}`}</Text>
              ) : (
                <Text style={[styles.gapLine, { color: colors.danger }]}>
                  {`✗ ${wordOf(i, r.picked)} → `}
                  <Text style={styles.bold}>{wordOf(i, r.right)}</Text>
                </Text>
              )}
              <Text style={[styles.topicLine, { color: colors.textMuted }]}>{titleOf(r.topic)}</Text>
            </View>
          ))}
        </Card>
        {repeat.length > 0 ? (
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            <Text style={[styles.rowsTitle, { color: colors.textMuted }]}>{s.repeat}</Text>
            {repeat.map((id) => (
              <Pressable
                key={id}
                testID={`exam-round-repeat-${id}`}
                accessibilityRole="button"
                accessibilityLabel={titleOf(id)}
                style={styles.repeatRow}
                onPress={() => router.push(`/grammar/${id}` as never)}
              >
                <Text style={[styles.repeatName, { color: colors.text }]} numberOfLines={2}>{titleOf(id)}</Text>
              </Pressable>
            ))}
          </Card>
        ) : null}
        <Text style={[styles.note, { color: colors.textMuted }]}>{s.countsNote}</Text>
        {last ? (
          <ExamButton testID="exam-round-done" label={s.done} onPress={finish} />
        ) : (
          <ExamButton testID="exam-round-next" label={s.nextText} onPress={nextText} />
        )}
      </ScrollView>
    </View>,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: spacing.xl },
  flex: { flex: 1 },
  body: { padding: spacing.lg, paddingBottom: FAB_CLEARANCE, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  line: { fontSize: fontSize.md, textAlign: 'center', padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  close: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  counter: { fontSize: fontSize.sm },
  gapRow: { gap: spacing.xs },
  gapLine: { fontSize: fontSize.md },
  bold: { fontWeight: fontWeight.bold },
  topicLine: { fontSize: fontSize.sm },
  rowsTitle: { fontSize: fontSize.sm },
  repeatRow: { minHeight: 44, justifyContent: 'center' },
  repeatName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  note: { fontSize: fontSize.sm, textAlign: 'center' },
});
