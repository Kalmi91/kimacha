import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { LEVELS, type Level } from '@/data/words';
import { hasVoiceFor, loadVoices, stop as stopSpeaking } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import { buildMockExam } from '@/lib/exam/buildMockExam';
import { scoreExam, type ExamAnswers, type ExamResult } from '@/lib/exam/score';
import type { MockExam } from '@/lib/exam/types';
import ExamTaskCard from '@/components/exam/ExamTaskCard';
import FeedbackButton from '@/components/FeedbackModal';

// The mock exam screen. Replaces the old five-lives quiz: this one has papers
// with their own clocks, no feedback while you work, a scored report at the end
// and the real exam's group pass rule (lib/exam/*).

type Phase = 'intro' | 'sectionIntro' | 'task' | 'result' | 'review';

interface Props {
  level: Level;
  direction: [string, string];
  onLevelUp: (newLevel: Level) => void;
  onExit: () => void;
}

function mmss(totalSeconds: number): string {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const sec = Math.max(0, totalSeconds) % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function MockExamMode({ level, direction, onLevelUp, onExit }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const [nativeLang, learnedLang] = direction;

  const [exam, setExam] = useState<MockExam>(() => buildMockExam(learnedLang, nativeLang, level));
  const [phase, setPhase] = useState<Phase>('intro');
  const [sectionIndex, setSectionIndex] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);
  const [answers, setAnswers] = useState<ExamAnswers>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [canSpeak, setCanSpeak] = useState(true);

  const advanceRef = useRef<() => void>(() => {});

  const section = exam.sections[sectionIndex];
  const task = section?.tasks[taskIndex];

  useEffect(() => {
    loadVoices().then(() => setCanSpeak(hasVoiceFor(speechLang(learnedLang))));
    return () => stopSpeaking();
  }, [learnedLang]);

  // One clock per paper, exactly as in the published exam structure. When it
  // runs out the paper ends where it stands; unanswered items simply score 0.
  useEffect(() => {
    if (phase !== 'task') return;
    const id = setInterval(() => {
      setSecondsLeft((v) => {
        // Only the tick that actually reaches zero closes the paper. Ticks that
        // arrive afterwards (the interval is cleared on the next render, not
        // instantly) must not close the following papers as well.
        if (v <= 1) {
          if (v === 1) advanceRef.current();
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, sectionIndex]);

  const finishExam = async (finalAnswers: ExamAnswers) => {
    stopSpeaking();
    const scored = scoreExam(exam, finalAnswers);
    setResult(scored);
    setPhase('result');
    if (scored.passed) {
      const levelIdx = LEVELS.indexOf(level);
      if (levelIdx < LEVELS.length - 1) {
        const newLevel = LEVELS[levelIdx + 1];
        await getDb().updateLevel(newLevel, 0, 0, 0);
        onLevelUp(newLevel);
      }
    }
  };

  // Closing a paper needs the answer sheet as it stands, which is why it reads
  // it through the setState updater instead of the render-time snapshot: the
  // clock can fire between renders.
  const nextSection = () => {
    stopSpeaking();
    setAnswers((current) => {
      if (sectionIndex + 1 >= exam.sections.length) {
        finishExam(current);
      } else {
        setSectionIndex((i) => i + 1);
        setTaskIndex(0);
        setPhase('sectionIntro');
      }
      return current;
    });
  };

  // Kept current from an effect rather than assigned during render: writing
  // to a ref while rendering is not allowed.
  useEffect(() => {
    advanceRef.current = nextSection;
  });

  const startSection = () => {
    setSecondsLeft(section.minutes * 60);
    setTaskIndex(0);
    setPhase('task');
  };

  const nextTask = () => {
    Keyboard.dismiss();
    stopSpeaking();
    if (taskIndex + 1 < section.tasks.length) {
      setTaskIndex((i) => i + 1);
      return;
    }
    nextSection();
  };

  const onAnswer = (taskId: string, key: string, value: string | boolean | number | null) => {
    setAnswers((prev) => ({ ...prev, [taskId]: { ...(prev[taskId] ?? {}), [key]: value } }));
  };

  const restart = () => {
    stopSpeaking();
    setExam(buildMockExam(learnedLang, nativeLang, level));
    setAnswers({});
    setResult(null);
    setSectionIndex(0);
    setTaskIndex(0);
    setPhase('intro');
  };

  const totalItems = useMemo(
    () =>
      exam.sections.reduce(
        (sum, sec) => sum + sec.tasks.reduce((n, tk) => n + (('questions' in tk && tk.questions?.length) || 0), 0),
        0
      ),
    [exam]
  );

  // ---------------------------------------------------------------- intro ---
  if (phase === 'intro') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.introBody}>
          <Text style={[styles.examTitle, { color: colors.text }]}>{exam.modelName}</Text>
          <Text style={[styles.examSub, { color: colors.tabIconDefault }]}>{s.exam.simulationOf(exam.modelNote)}</Text>

          {exam.sections.map((sec, i) => (
            <View key={sec.skill} style={[styles.sectionRow, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionNo, { color: colors.tint }]}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionName, { color: colors.text }]}>{sec.name}</Text>
                <Text style={[styles.sectionMeta, { color: colors.tabIconDefault }]}>
                  {s.exam.sectionMeta(sec.minutes, sec.tasks.length, sec.points)}
                </Text>
              </View>
            </View>
          ))}

          <Text style={[styles.passRule, { color: colors.text }]}>{s.exam.passRuleTitle}</Text>
          {exam.groups.map((group, i) => (
            <Text key={i} style={[styles.passRuleLine, { color: colors.tabIconDefault }]}>
              {s.exam.passRuleGroup(
                i + 1,
                group.skills.map((skill) => exam.sections.find((sec) => sec.skill === skill)?.name ?? skill).join(' + '),
                group.needed,
                group.of
              )}
            </Text>
          ))}
          <Text style={[styles.note, { color: colors.tabIconDefault }]}>{s.exam.shortNote}</Text>
          {exam.generatedFallback ? <Text style={[styles.note, { color: colors.tabIconDefault }]}>{s.exam.generatedNote}</Text> : null}

          <Pressable testID="exam-begin" style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={() => setPhase('sectionIntro')}>
            <Text style={styles.primaryBtnText}>{s.exam.begin}</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={onExit}>
            <Text style={[styles.ghostBtnText, { color: colors.tabIconDefault }]}>{s.exam.exit}</Text>
          </Pressable>
        </ScrollView>
        <FeedbackButton level={level} languagePair={direction.join('→')} currentCard={`mockexam:${exam.modelName}:intro`} />
      </View>
    );
  }

  // --------------------------------------------------------- section intro ---
  if (phase === 'sectionIntro' && section) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.introBody}>
          <Text style={[styles.sectionBadge, { color: colors.tint }]}>
            {s.exam.paperOf(sectionIndex + 1, exam.sections.length)}
          </Text>
          <Text style={[styles.examTitle, { color: colors.text }]}>{section.name}</Text>
          <Text style={[styles.examSub, { color: colors.tabIconDefault }]}>
            {s.exam.sectionMeta(section.minutes, section.tasks.length, section.points)}
          </Text>
          {section.skill === 'listening' && !canSpeak ? (
            <Text style={[styles.note, { color: '#F59E0B' }]}>{s.exam.noVoice}</Text>
          ) : null}
          {section.skill === 'speaking' ? <Text style={[styles.note, { color: colors.tabIconDefault }]}>{s.exam.speakingNote}</Text> : null}
          <Pressable testID="exam-start-section" style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={startSection}>
            <Text style={styles.primaryBtnText}>{s.exam.startSection}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ----------------------------------------------------------------- task ---
  if (phase === 'task' && section && task) {
    const low = secondsLeft <= 60;
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={[styles.headerSection, { color: colors.text }]} numberOfLines={1}>
            {section.name}
          </Text>
          <Text testID="exam-clock" style={[styles.headerClock, { color: low ? '#EF4444' : colors.tint }]}>
            ⏱ {mmss(secondsLeft)}
          </Text>
        </View>
        <Text style={[styles.headerTask, { color: colors.tabIconDefault }]}>
          {s.exam.taskOf(taskIndex + 1, section.tasks.length)}
        </Text>

        <ScrollView contentContainerStyle={styles.taskBody} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <ExamTaskCard
            key={task.id}
            task={task}
            answer={answers[task.id] ?? {}}
            onAnswer={(key, value) => onAnswer(task.id, key, value)}
            learnedLang={learnedLang}
            canSpeak={canSpeak}
          />
          <Pressable testID="exam-next-task" style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={nextTask}>
            <Text style={styles.primaryBtnText}>
              {taskIndex + 1 < section.tasks.length ? s.exam.nextTask : s.exam.finishSection}
            </Text>
          </Pressable>
        </ScrollView>
        <FeedbackButton
          level={level}
          languagePair={direction.join('→')}
          currentCard={`mockexam:${exam.modelName}:${section.skill}:${task.id}`}
        />
      </KeyboardAvoidingView>
    );
  }

  // --------------------------------------------------------------- result ---
  if (phase === 'result' && result) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.introBody}>
          <Text style={styles.resultEmoji}>{result.passed ? '🏆' : '📚'}</Text>
          <Text style={[styles.verdict, { color: result.passed ? '#22C55E' : '#EF4444' }]}>
            {result.passed ? s.exam.verdictPass : s.exam.verdictFail}
          </Text>
          <Text style={[styles.examSub, { color: colors.tabIconDefault }]}>
            {result.totalPoints} / {result.totalMax}
          </Text>

          {result.sections.map((sec) => (
            <View key={sec.skill} style={[styles.sectionRow, { backgroundColor: colors.card }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionName, { color: colors.text }]}>{sec.name}</Text>
                <View style={[styles.barTrack, { backgroundColor: colors.background }]}>
                  <View
                    testID={`exam-bar-${sec.skill}`}
                    style={[
                      styles.barFill,
                      { backgroundColor: colors.tint, width: `${sec.maxPoints ? (sec.points / sec.maxPoints) * 100 : 0}%` },
                    ]}
                  />
                </View>
              </View>
              <Text testID={`exam-points-${sec.skill}`} style={[styles.sectionPoints, { color: colors.text }]}>
                {sec.points}/{sec.maxPoints}
              </Text>
            </View>
          ))}

          {result.groups.map((group, i) => (
            <Text key={i} testID={`exam-group-${i}`} style={[styles.groupLine, { color: group.passed ? '#22C55E' : '#EF4444' }]}>
              {s.exam.groupResult(
                i + 1,
                group.skills.map((skill) => exam.sections.find((sec) => sec.skill === skill)?.name ?? skill).join(' + '),
                group.points,
                group.of,
                group.needed,
                group.passed ? s.exam.apto : s.exam.noApto
              )}
            </Text>
          ))}

          <Text style={[styles.note, { color: colors.tabIconDefault }]}>{s.exam.speakingSelfNote}</Text>

          <Pressable testID="exam-review" style={[styles.primaryBtn, { backgroundColor: colors.tint }]} onPress={() => setPhase('review')}>
            <Text style={styles.primaryBtnText}>{s.exam.review}</Text>
          </Pressable>
          <Pressable style={[styles.secondaryBtn, { borderColor: colors.tint }]} onPress={restart}>
            <Text style={[styles.secondaryBtnText, { color: colors.tint }]}>{s.exam.retry}</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={onExit}>
            <Text style={[styles.ghostBtnText, { color: colors.tabIconDefault }]}>{s.exam.exit}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // --------------------------------------------------------------- review ---
  if (phase === 'review' && result) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.introBody}>
          <Text style={[styles.examTitle, { color: colors.text }]}>{s.exam.review}</Text>
          {result.sections.map((sec) => (
            <View key={sec.skill} style={{ width: '100%', gap: 6 }}>
              <Text style={[styles.reviewSection, { color: colors.tint }]}>
                {sec.name} · {sec.correct}/{sec.total}
              </Text>
              {sec.tasks.flatMap((tk) =>
                tk.items
                  .filter((item) => !item.ok)
                  .map((item, i) => (
                    <View key={`${tk.taskId}-${i}`} style={[styles.reviewCard, { backgroundColor: colors.card }]}>
                      <Text style={[styles.reviewLabel, { color: colors.text }]}>{item.label}</Text>
                      <Text style={[styles.reviewLine, { color: '#EF4444' }]}>
                        {s.exam.yourAnswer}: {item.given || ', '}
                      </Text>
                      <Text style={[styles.reviewLine, { color: '#22C55E' }]}>
                        {s.exam.correctAnswer}: {item.expected}
                      </Text>
                      {item.why ? <Text style={[styles.reviewWhy, { color: colors.tabIconDefault }]}>{item.why}</Text> : null}
                    </View>
                  ))
              )}
            </View>
          ))}
          <Pressable style={[styles.secondaryBtn, { borderColor: colors.tint }]} onPress={() => setPhase('result')}>
            <Text style={[styles.secondaryBtnText, { color: colors.tint }]}>{s.exam.backToResult}</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={onExit}>
            <Text style={[styles.ghostBtnText, { color: colors.tabIconDefault }]}>{s.exam.exit}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.note, { color: colors.tabIconDefault, textAlign: 'center', marginTop: 80 }]}>
        {s.exam.emptyExam} ({totalItems})
      </Text>
      <Pressable style={styles.ghostBtn} onPress={onExit}>
        <Text style={[styles.ghostBtnText, { color: colors.tabIconDefault }]}>{s.exam.exit}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  introBody: { padding: 20, gap: 10, alignItems: 'center', paddingBottom: 60 },
  examTitle: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  examSub: { fontSize: 14, textAlign: 'center' },
  sectionBadge: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', borderRadius: 14, padding: 14 },
  sectionNo: { fontSize: 20, fontWeight: '800', width: 22, textAlign: 'center' },
  sectionName: { fontSize: 16, fontWeight: '700' },
  sectionMeta: { fontSize: 12, marginTop: 2 },
  sectionPoints: { fontSize: 16, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  passRule: { fontSize: 15, fontWeight: '700', marginTop: 12 },
  passRuleLine: { fontSize: 13, textAlign: 'center' },
  groupLine: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  note: { fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 6 },
  primaryBtn: { marginTop: 18, paddingHorizontal: 32, paddingVertical: 15, borderRadius: 26, alignSelf: 'stretch', alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  secondaryBtn: { marginTop: 10, paddingHorizontal: 32, paddingVertical: 13, borderRadius: 26, borderWidth: 1.5, alignSelf: 'stretch', alignItems: 'center' },
  secondaryBtnText: { fontSize: 16, fontWeight: '600' },
  ghostBtn: { marginTop: 10, padding: 10 },
  ghostBtnText: { fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14 },
  headerSection: { fontSize: 15, fontWeight: '700', flex: 1 },
  headerClock: { fontSize: 16, fontWeight: '800' },
  headerTask: { fontSize: 12, paddingHorizontal: 18, paddingBottom: 6 },
  taskBody: { padding: 18, paddingBottom: 90, gap: 4 },
  resultEmoji: { fontSize: 56 },
  verdict: { fontSize: 28, fontWeight: '800' },
  reviewSection: { fontSize: 15, fontWeight: '800', marginTop: 14 },
  reviewCard: { borderRadius: 12, padding: 12, gap: 3 },
  reviewLabel: { fontSize: 14, fontWeight: '600' },
  reviewLine: { fontSize: 13 },
  reviewWhy: { fontSize: 13, fontStyle: 'italic', marginTop: 2 },
});
