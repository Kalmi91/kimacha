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

  const [questions] = useState<ExamQuestion[]>(() => {
    return getExamQuestionsFor(direction[1], level).sort(() => Math.random() - 0.5).slice(0, 10);
  });
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  const handleResult = async (isCorrect: boolean) => {
    const newCorrect = correct + (isCorrect ? 1 : 0);
    setCorrect(newCorrect);
    if (index + 1 >= 10) {
      setDone(true);
      if (newCorrect >= 9) {
        const levelIdx = LEVELS.indexOf(level);
        if (levelIdx < LEVELS.length - 1) {
          const newLevel = LEVELS[levelIdx + 1];
          const db = getDb();
          await db.updateLevel(newLevel, 0, 0, 0);
          onLevelUp(newLevel);
        }
      }
    } else {
      setIndex(index + 1);
    }
  };

  if (done) {
    const passed = correct >= 9;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={styles.doneEmoji}>{passed ? '🏆' : '📚'}</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {passed ? `${level} ↑` : 'Még nem, de közel vagy!'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>
          {correct}/10
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
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={styles.badgeText}>{s.exam.tag}</Text>
        </View>
        <Text style={[styles.counter, { color: colors.tabIconDefault }]}>
          {index + 1}/10
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
});
