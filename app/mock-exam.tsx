import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import { getDb } from '@/lib/database';
import { PCIC_LEVELS, pcicItemsForLevel, setPcicTarget, type PcicTarget } from '@/data/pcic';
import { t } from '@/lib/i18n';
import { speechLang } from '@/lib/languages';
import { hasVoiceFor, loadVoices, stop as stopSpeaking } from '@/lib/speech';
import { useTheme } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import { Card } from '@/components/grammar/Brutal';
import ExamButton from '@/components/exam/ExamButton';
import MockTaskCard from '@/components/exam/MockTaskCard';
import { MockResultView, MockReviewView } from '@/components/exam/MockResultView';
import { mockAvailable, MOCK_LEVELS } from '@/lib/exam/mock/blueprint';
import { buildMockExam, mockExamSignature } from '@/lib/exam/mock/build';
import { buildGlossaryIndex, mockGlossary } from '@/lib/exam/mock/glossary';
import { buildLexicon } from '@/lib/exam/mock/writing';
import { scoreMockExam, type MockResult } from '@/lib/exam/mock/score';
import {
  CLOCK_WARNING_SECONDS,
  clearMockSession,
  formatClock,
  readMockOverview,
  saveMockLast,
  saveMockSession,
  secondsLeft,
  type MockSession,
} from '@/lib/exam/mock/session';
import type { MockAnswers, MockExam, MockLevel, MockTaskAnswer } from '@/lib/exam/mock/types';
import { isExamLearned } from '@/lib/exam/unlock';

// PLAN-vizsga E. szakasz (15-16. lépés, Kálmán 2026-10-01): a próbavizsga képernyője a hivatalos
// felépítéssel. Intro -> papíronként: papír-intro, óra, feladatok (nincs azonnali jelzés) ->
// eredmény (csoportonként 30 / 50) -> átnézés. A szóbeli ebben a szeletben helyőrző (E2 a).
// Papíronként mentve (E4 b): egy kész papír válaszai megmaradnak, a félbehagyott papír elölről
// indul. Állapot: lib/exam/mock/session.ts, feladatsor: lib/exam/mock/build.ts.

type Phase = 'loading' | 'unavailable' | 'empty' | 'intro' | 'paperIntro' | 'task' | 'speaking' | 'result' | 'review';

export default function MockExamScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  const router = useRouter();
  const params = useLocalSearchParams<{ level?: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [target, setTarget] = useState<PcicTarget>('es');
  const [level, setLevel] = useState<MockLevel>('A1');
  const [exam, setExam] = useState<MockExam | null>(null);
  const [learned, setLearned] = useState<ReadonlySet<string>>(new Set());
  // A célnyelv ismert szavai az írás értelmességi ellenőrzéséhez (lib/exam/mock/writing.ts).
  const [lexicon, setLexicon] = useState<ReadonlySet<string> | undefined>(undefined);
  const [saved, setSaved] = useState<MockSession | null>(null);
  const [canSpeak, setCanSpeak] = useState(true);
  const [paperIdx, setPaperIdx] = useState(0);
  const [taskIdx, setTaskIdx] = useState(0);
  const [answers, setAnswers] = useState<MockAnswers>({});
  const [done, setDone] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [result, setResult] = useState<MockResult | null>(null);
  const [leaving, setLeaving] = useState(false);
  const closingRef = useRef(false);

  // --- Betöltés: irány, szint-szavak, tanult szavak (szójegyzethez), mentett vizsga.
  useEffect(() => {
    let alive = true;
    (async () => {
      const db = getDb();
      const onboarding = await db.getOnboarding();
      const tgt: PcicTarget = (onboarding?.target as PcicTarget | undefined) ?? 'es';
      setPcicTarget(tgt);
      const lvl = params.level ?? '';
      if (!mockAvailable(tgt, lvl)) {
        if (alive) setPhase('unavailable');
        return;
      }
      const [cards, overview] = await Promise.all([db.getPcicCards(), readMockOverview(db, tgt, MOCK_LEVELS[tgt])]);
      await loadVoices();
      if (!alive) return;
      const items = pcicItemsForLevel(lvl);
      const fresh = () => buildMockExam({ target: tgt, level: lvl, items, seed: Date.now() });
      // A mentett vizsga csak akkor folytatható, ha a magjából ugyanaz a feladatsor épül vissza.
      const session = overview[lvl]?.session ?? null;
      const rebuilt = session ? buildMockExam({ target: tgt, level: lvl, items, seed: session.seed }) : null;
      const resumable = session && rebuilt && mockExamSignature(rebuilt) === session.sig ? session : null;
      const built = resumable ? rebuilt! : fresh();
      setTarget(tgt);
      setLevel(lvl);
      setLearned(new Set(cards.filter(isExamLearned).map((c) => c.itemId)));
      setLexicon(buildLexicon(PCIC_LEVELS.flatMap((l) => pcicItemsForLevel(l)), tgt));
      setCanSpeak(hasVoiceFor(speechLang(tgt)));
      setSaved(resumable);
      setExam(built);
      setPhase(built.papers.every((p) => p.tasks.length === 0) ? 'empty' : 'intro');
    })();
    return () => {
      alive = false;
      stopSpeaking();
    };
  }, [params.level]);

  const glossaryIndex = useMemo(() => buildGlossaryIndex(pcicItemsForLevel(level), target), [level, target]);
  const paper = exam?.papers[paperIdx];
  const task = paper?.tasks[taskIdx];
  const left = paper ? secondsLeft(startedAt, paper.minutes, now) : 0;

  // --- Óra: papíronként külön megy; időbélyegből számol, a másodperc-tick csak frissíti a képernyőt.
  useEffect(() => {
    if (phase !== 'task') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase, paperIdx]);

  const finish = async (all: MockAnswers, ex: MockExam) => {
    const res = scoreMockExam(ex, all, { lexicon });
    const db = getDb();
    await saveMockLast(db, target, level, res, localDateString());
    await clearMockSession(db, target, level);
    setSaved(null);
    setResult(res);
    setPhase('result');
  };

  // Egy papír lezárása (a tanuló befejezte, vagy lejárt az óra): válaszai mentődnek, jön a következő.
  const closePaper = async (byClock: boolean) => {
    if (!exam || !paper || closingRef.current) return;
    closingRef.current = true;
    stopSpeaking();
    setLeaving(false);
    if (byClock) setTimedOut(true);
    const nextDone = [...done, paper.id];
    setDone(nextDone);
    if (paperIdx + 1 >= exam.papers.length) {
      await finish(answers, exam);
    } else {
      await saveMockSession(getDb(), target, level, { seed: exam.seed, sig: mockExamSignature(exam), done: nextDone, answers });
      setPaperIdx(paperIdx + 1);
      setTaskIdx(0);
      setPhase('paperIntro');
    }
    closingRef.current = false;
  };

  // A lejáró óra a legfrissebb állapotból zárja a papírt (az effekt a renderelt closePaper-t hívja).
  const closeRef = useRef(closePaper);
  useEffect(() => {
    closeRef.current = closePaper;
  });
  useEffect(() => {
    if (phase === 'task' && left <= 0) void closeRef.current(true);
  }, [phase, left]);

  const startPaper = () => {
    if (!paper) return;
    if (paper.placeholder) {
      setPhase('speaking');
      return;
    }
    if (paper.tasks.length === 0) {
      void closePaper(false);
      return;
    }
    const t0 = Date.now();
    setStartedAt(t0);
    setNow(t0);
    setTaskIdx(0);
    setPhase('task');
  };

  const nextTask = () => {
    stopSpeaking();
    if (paper && taskIdx + 1 < paper.tasks.length) setTaskIdx(taskIdx + 1);
    else void closePaper(false);
  };

  const onAnswer = (taskId: string, key: string, value: string | number | boolean | null) => {
    setAnswers((prev) => ({ ...prev, [taskId]: { ...(prev[taskId] ?? {}), [key]: value } as MockTaskAnswer }));
  };

  const resetRun = (ex: MockExam) => {
    setExam(ex);
    setAnswers({});
    setDone([]);
    setTimedOut(false);
    setResult(null);
    setPaperIdx(0);
    setTaskIdx(0);
  };

  const rebuild = () => buildMockExam({ target, level, items: pcicItemsForLevel(level), seed: Date.now() });

  const begin = () => {
    resetRun(exam!);
    setPaperIdx(0);
    setPhase('paperIntro');
  };

  const resume = () => {
    if (!exam || !saved) return;
    setAnswers(saved.answers);
    setDone(saved.done);
    setTimedOut(false);
    setPaperIdx(Math.max(0, exam.papers.findIndex((p) => !saved.done.includes(p.id))));
    setTaskIdx(0);
    setPhase('paperIntro');
  };

  const startOver = async () => {
    await clearMockSession(getDb(), target, level);
    setSaved(null);
    resetRun(rebuild());
    setPhase('paperIntro');
  };

  const retry = () => {
    setSaved(null);
    resetRun(rebuild());
    setPhase('intro');
  };

  const shell = (children: ReactNode) => <View style={[styles.screen, { backgroundColor: colors.background }]}>{children}</View>;
  const card = (children: ReactNode) => (
    <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
      {children}
    </Card>
  );

  if (phase === 'loading') return shell(<ActivityIndicator style={styles.centered} color={colors.tint} />);

  if (phase === 'unavailable' || phase === 'empty' || !exam) {
    return shell(
      <View style={styles.body}>
        {card(<Text style={[styles.line, { color: colors.textMuted }]}>{phase === 'empty' ? s.emptyBody : s.unavailableBody}</Text>)}
        <ExamButton testID="mock-back" label={s.exit} onPress={() => router.back()} />
      </View>,
    );
  }

  if (phase === 'intro') {
    const rule = exam.rule;
    return shell(
      <ScrollView contentContainerStyle={styles.body}>
        {card(
          <>
            <Text style={[styles.title, { color: colors.text }]}>{s.title(level)}</Text>
            <Text style={[styles.line, { color: colors.textMuted }]}>{exam.official ? s.modelNote(level) : s.modelNoteIntl(level)}</Text>
            {exam.papers.map((p) => (
              <Text key={p.id} testID={`mock-paper-${p.id}`} style={[styles.line, { color: colors.text }]}>
                {p.placeholder ? s.paperLineSoon(p.name, p.minutes) : s.paperLine(p.name, p.minutes, p.tasks.length, p.points)}
              </Text>
            ))}
            <Text style={[styles.line, { color: colors.text }]}>{rule.kind === 'groups' ? s.passRule(rule.groups[0].needed, rule.groups[0].of) : rule.kind === 'total' ? s.passRuleTotal(rule.needed, rule.of) : s.passRuleAverage(rule.passPct)}</Text>
            <Text style={[styles.note, { color: colors.textMuted }]}>{s.shortNote}</Text>
          </>,
        )}
        {saved ? (
          <>
            <ExamButton testID="mock-resume" label={s.resume(Math.min(saved.done.length + 1, exam.papers.length), exam.papers.length)} onPress={resume} />
            <ExamButton testID="mock-start-over" secondary label={s.startOver} onPress={startOver} />
          </>
        ) : (
          <ExamButton testID="mock-begin" label={s.begin} onPress={begin} />
        )}
        <ExamButton testID="mock-exit" secondary label={s.exit} onPress={() => router.back()} />
      </ScrollView>,
    );
  }

  if (phase === 'paperIntro' && paper) {
    return shell(
      <ScrollView contentContainerStyle={styles.body}>
        {card(
          <>
            <Text style={[styles.note, { color: colors.tint }]}>{s.paperOf(paperIdx + 1, exam.papers.length)}</Text>
            <Text style={[styles.title, { color: colors.text }]}>{paper.name}</Text>
            <Text style={[styles.line, { color: colors.textMuted }]}>
              {paper.placeholder ? s.paperLineSoon(paper.name, paper.minutes) : s.paperMeta(paper.minutes, paper.tasks.length, paper.points)}
            </Text>
            {paper.tasks.some((tk) => tk.skill === 'listening') && !canSpeak && <Text style={[styles.note, { color: colors.warning }]}>{s.noVoice}</Text>}
            {timedOut && <Text style={[styles.note, { color: colors.warning }]}>{s.timeUp}</Text>}
          </>,
        )}
        <ExamButton testID="mock-start-paper" label={s.startPaper} onPress={startPaper} />
      </ScrollView>,
    );
  }

  if (phase === 'speaking') {
    return shell(
      <ScrollView contentContainerStyle={styles.body}>
        {card(
          <>
            <Text testID="mock-speaking-title" style={[styles.title, { color: colors.text }]}>
              {s.speakingTitle}
            </Text>
            <Text style={[styles.line, { color: colors.textMuted }]}>{exam.rule.kind === 'groups' ? s.speakingBody : s.speakingBodyScaled}</Text>
          </>,
        )}
        <ExamButton testID="mock-speaking-continue" label={s.continue} onPress={() => void closePaper(false)} />
      </ScrollView>,
    );
  }

  if (phase === 'result' && result) {
    return shell(<MockResultView result={result} timedOut={timedOut} onReview={() => setPhase('review')} onRetry={retry} onExit={() => router.back()} />);
  }

  if (phase === 'review' && result) {
    return shell(<MockReviewView result={result} onBack={() => setPhase('result')} />);
  }

  if (leaving) {
    return shell(
      <View style={styles.body}>
        {card(
          <>
            <Text style={[styles.title, { color: colors.text }]}>{s.leaveTitle}</Text>
            <Text style={[styles.line, { color: colors.textMuted }]}>{s.leaveBody}</Text>
          </>,
        )}
        <ExamButton testID="mock-leave" label={s.leave} onPress={() => router.back()} />
        <ExamButton testID="mock-keep-going" secondary label={s.keepGoing} onPress={() => setLeaving(false)} />
      </View>,
    );
  }

  if (phase === 'task' && paper && task) {
    const last = taskIdx + 1 >= paper.tasks.length;
    return shell(
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable testID="mock-close" accessibilityRole="button" accessibilityLabel={s.leaveTitle} hitSlop={12} onPress={() => setLeaving(true)}>
            <Text style={[styles.close, { color: colors.textMuted }]}>✕</Text>
          </Pressable>
          <Text style={[styles.paperName, { color: colors.text }]} numberOfLines={1}>
            {paper.name}
          </Text>
          <Text testID="mock-clock" style={[styles.clock, { color: left <= CLOCK_WARNING_SECONDS ? colors.warning : colors.tint }]}>
            ⏱ {formatClock(left)}
          </Text>
        </View>
        <Text testID="mock-task-counter" style={[styles.counter, { color: colors.textMuted }]}>
          {s.taskOf(taskIdx + 1, paper.tasks.length)}
        </Text>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <MockTaskCard
            key={task.id}
            task={task}
            answer={answers[task.id] ?? {}}
            onAnswer={(key, value) => onAnswer(task.id, key, value)}
            target={target}
            canSpeak={canSpeak}
            glossary={mockGlossary(task, glossaryIndex, learned)}
          />
          <ExamButton testID="mock-next-task" label={last ? s.finishPaper : s.nextTask} onPress={nextTask} />
        </ScrollView>
      </KeyboardAvoidingView>,
    );
  }

  return shell(<ActivityIndicator style={styles.centered} color={colors.tint} />);
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
  note: { fontSize: fontSize.sm, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg },
  close: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  paperName: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  clock: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  counter: { fontSize: fontSize.sm, textAlign: 'center', paddingTop: spacing.xs },
});
