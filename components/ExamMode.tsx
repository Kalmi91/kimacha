import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { LEVELS, type Level } from '@/data/words';
import { getExamQuestionsForLevel, examSize, type ExamQuestion } from '@/data/exams';
import ExamCard from '@/components/ExamCard';
import FeedbackButton from '@/components/FeedbackModal';

interface Props {
  level: Level;
  direction: [string, string];
  onLevelUp: (newLevel: Level) => void;
  onExit: () => void;
}

export default function ExamMode({ level, direction, onLevelUp, onExit }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const startRef = useRef(Date.now());

  // Pass = 80% of the questions actually served (== passThreshold when the pool
  // is large enough; degrades gracefully for small pools like C2).
  const pass = Math.max(1, Math.ceil(questions.length * 0.8));

  // Weighted selection: questions the user previously got wrong are more likely
  // to come back, never-seen are medium, known are rare. Weighted shuffle via
  // key = random()^(1/weight), then take the top N.
  const loadQuestions = async () => {
    setLoading(true);
    const pool = getExamQuestionsForLevel(level);
    const db = getDb();
    const last = await db.getExamLastResults(level);
    const weighted = pool.map(q => {
      const lr = last.get(q.id);
      const weight = lr === undefined ? 2 : lr === false ? 3 : 1;
      return { q, key: Math.pow(Math.random(), 1 / weight) };
    });
    weighted.sort((a, b) => b.key - a.key);
    const chosen = weighted
      .slice(0, examSize(level))
      .map(w => w.q)
      .sort(() => Math.random() - 0.5);
    setQuestions(chosen);
    setIndex(0);
    setCorrect(0);
    setDone(false);
    startRef.current = Date.now();
    setLoading(false);
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const handleResult = async (isCorrect: boolean) => {
    const db = getDb();
    const now = Date.now();
    const ms = now - startRef.current;
    startRef.current = now;

    const q = questions[index];
    if (q) await db.recordExamAttempt(q.id, level, isCorrect, ms);

    const newCorrect = correct + (isCorrect ? 1 : 0);
    setCorrect(newCorrect);

    if (index + 1 >= questions.length) {
      const passed = newCorrect >= pass;
      await db.recordExamSession(level, questions.length, newCorrect, passed);
      setDone(true);
      if (passed) {
        const levelIdx = LEVELS.indexOf(level);
        if (levelIdx < LEVELS.length - 1) {
          const newLevel = LEVELS[levelIdx + 1];
          await db.updateLevel(newLevel, 0, 0, 0);
          onLevelUp(newLevel);
        }
      }
    } else {
      setIndex(index + 1);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (done) {
    const passed = correct >= pass;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={styles.doneEmoji}>{passed ? '🏆' : '📚'}</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {passed ? `${level} ↑` : s.exam.notYet}
        </Text>
        <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>
          {correct}/{questions.length}
        </Text>
        {passed ? (
          <Pressable style={[styles.btn, { backgroundColor: colors.tint }]} onPress={onExit}>
            <Text style={styles.btnText}>→</Text>
          </Pressable>
        ) : (
          <View style={styles.failButtons}>
            <Pressable style={[styles.btn, { backgroundColor: colors.tint }]} onPress={loadQuestions}>
              <Text style={styles.btnText}>{s.exam.retry}</Text>
            </Pressable>
            <Pressable style={[styles.btnSecondary, { borderColor: colors.tabIconDefault }]} onPress={onExit}>
              <Text style={[styles.btnSecondaryText, { color: colors.tabIconDefault }]}>{s.exam.backToLearning}</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  const eq = questions[index];
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={styles.badgeText}>{s.exam.tag}</Text>
        </View>
        <Text style={[styles.counter, { color: colors.tabIconDefault }]}>
          {index + 1}/{questions.length}
        </Text>
      </View>
      {eq && <ExamCard question={eq} onResult={handleResult} />}
      <FeedbackButton level={level} languagePair={direction.join('→')} currentCard={`exam:${index + 1}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', position: 'absolute', top: 16, left: 20, right: 20 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  counter: { fontSize: 14 },
  doneEmoji: { fontSize: 64, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 24 },
  btn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, minWidth: 160, alignItems: 'center', alignSelf: 'center' },
  btnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  failButtons: { gap: 12, alignItems: 'center' },
  btnSecondary: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, borderWidth: 1, alignSelf: 'center' },
  btnSecondaryText: { fontSize: 15, fontWeight: '600' },
});
