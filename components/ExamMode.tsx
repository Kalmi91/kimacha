import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { LEVELS, type Level } from '@/data/words';
import { getExamQuestionsFor, type ExamQuestion } from '@/data/exams';
import ExamCard from '@/components/ExamCard';
import FeedbackButton from '@/components/FeedbackModal';

const MAX_LIVES = 5;

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

  const buildQuestions = (): ExamQuestion[] =>
    getExamQuestionsFor(direction[1], level).sort(() => Math.random() - 0.5).slice(0, 10);

  const [questions, setQuestions] = useState<ExamQuestion[]>(() => buildQuestions());
  const [index, setIndex] = useState(0);
  const [livesLeft, setLivesLeft] = useState(MAX_LIVES);
  const [passed, setPassed] = useState(false);
  const [failed, setFailed] = useState(false);

  const total = questions.length;

  const handleResult = async (isCorrect: boolean) => {
    const newLives = isCorrect ? livesLeft : livesLeft - 1;

    if (!isCorrect && newLives === 0) {
      // 5th mistake — fail
      setLivesLeft(0);
      setFailed(true);
      return;
    }

    setLivesLeft(newLives);

    if (index + 1 >= total) {
      // Finished with at least 1 life remaining
      setPassed(true);
      const levelIdx = LEVELS.indexOf(level);
      if (levelIdx < LEVELS.length - 1) {
        const newLevel = LEVELS[levelIdx + 1];
        const db = getDb();
        await db.updateLevel(newLevel, 0, 0, 0);
        onLevelUp(newLevel);
      }
    } else {
      setIndex(index + 1);
    }
  };

  const handleRetry = () => {
    setQuestions(buildQuestions());
    setIndex(0);
    setLivesLeft(MAX_LIVES);
    setPassed(false);
    setFailed(false);
  };

  // FAIL screen
  if (failed) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={styles.doneEmoji}>📚</Text>
        <Text style={[styles.title, { color: colors.text }]}>Elfogytak az életek</Text>
        <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>
          {index + 1}/{total}
        </Text>
        <View style={styles.btnRow}>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.accent }]}
            onPress={handleRetry}
          >
            <Text style={styles.btnText}>Újra</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.tint }]}
            onPress={onExit}
          >
            <Text style={styles.btnText}>Kilépés</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // PASS screen
  if (passed) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={styles.doneEmoji}>🏆</Text>
        <Text style={[styles.title, { color: colors.text }]}>{level} ↑</Text>
        <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>
          {total}/{total}
        </Text>
        <Pressable
          style={[styles.btn, { backgroundColor: colors.tint }]}
          onPress={onExit}
        >
          <Text style={styles.btnText}>→</Text>
        </Pressable>
      </View>
    );
  }

  const eq = questions[index];
  const livesDisplay = '❤️'.repeat(livesLeft) + '🖤'.repeat(MAX_LIVES - livesLeft);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={onExit} hitSlop={8} style={styles.exitBtn}>
            <Text style={[styles.exitText, { color: colors.tabIconDefault }]}>✕</Text>
          </Pressable>
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text style={styles.badgeText}>{s.exam.tag}</Text>
          </View>
        </View>
        <Text style={[styles.counter, { color: colors.tabIconDefault }]}>
          {index + 1}/{total}
        </Text>
      </View>
      <Text style={styles.lives}>{livesDisplay}</Text>
      {eq && <ExamCard key={index} question={eq} onResult={handleResult} />}
      <FeedbackButton level={level} languagePair={direction.join('→')} currentCard={`exam:${index + 1}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', position: 'absolute', top: 16, left: 20, right: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exitBtn: { padding: 4 },
  exitText: { fontSize: 20, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  counter: { fontSize: 14 },
  lives: { fontSize: 22, textAlign: 'center', marginBottom: 12, marginTop: 60 },
  doneEmoji: { fontSize: 64, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 24 },
  btnRow: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  btn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, minWidth: 120, alignItems: 'center' },
  btnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
});
