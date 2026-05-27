import { StyleSheet, Text, View, Pressable } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { type Level } from '@/data/words';
import { type TopicDef, getTopicName } from '@/data/topics';
import FeedbackButton from '@/components/FeedbackModal';

interface TopicProgress {
  done: number;
  total: number;
  wordsInTopic: number;
  wordsReviewed: number;
}

interface Props {
  reviewed: number;
  streak: number;
  level: Level;
  masteredPct: number;
  direction: [string, string];
  onStartExam: () => void;
  examAvailable: boolean;
  currentTopic?: TopicDef | null;
  topicProgress?: TopicProgress | null;
}

export default function DoneScreen({ reviewed, streak, level, masteredPct, direction, onStartExam, examAvailable, currentTopic, topicProgress }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const topicLang = direction[1] === 'hu' ? 'hu' : direction[1] === 'es' ? 'es' : direction[1] === 'de' ? 'de' : 'en';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.doneEmoji}>🎉</Text>
      <Text style={[styles.title, { color: colors.text }]}>{s.done.title}</Text>
      <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>
        {s.done.reviewed(reviewed)}
      </Text>
      <View style={[styles.levelBadge, { backgroundColor: '#38BDF8' }]}>
        <Text style={styles.levelText}>{level}</Text>
      </View>
      {topicProgress && currentTopic && (
        <View style={styles.topicRow}>
          <Text style={[styles.topicIcon]}>
            {currentTopic.type === 'grammar' ? '📗' : '📘'}
          </Text>
          <Text style={[styles.topicText, { color: colors.text }]}>
            {getTopicName(currentTopic, topicLang)}
          </Text>
          <Text style={[styles.topicCounter, { color: colors.tabIconDefault }]}>
            {s.topic.progress(topicProgress.done, topicProgress.total)}
          </Text>
        </View>
      )}
      <View style={[styles.streakBadge, { backgroundColor: colors.card, marginTop: 12 }]}>
        <Text style={[styles.streakNumber, { color: colors.accent }]}>{streak}</Text>
        <Text style={[styles.streakLabel, { color: colors.tabIconDefault }]}>{s.done.streak}</Text>
      </View>
      <Text style={[styles.masteredText, { color: masteredPct >= 70 ? '#22C55E' : colors.tabIconDefault }]}>
        {level}: {masteredPct}% {masteredPct < 70 ? '(vizsga: 70%)' : '✓'}
      </Text>
      {examAvailable && (
        <Pressable style={[styles.examBtn, { backgroundColor: colors.accent, marginTop: 20 }]} onPress={onStartExam}>
          <Text style={styles.examBtnText}>🎓 Vizsga</Text>
        </Pressable>
      )}
      <FeedbackButton level={level} languagePair={direction.join('→')} currentCard="done" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  doneEmoji: { fontSize: 64, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 24 },
  levelBadge: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, alignSelf: 'center' },
  levelText: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 4, alignSelf: 'center' },
  streakNumber: { fontSize: 18, fontWeight: '700' },
  streakLabel: { fontSize: 14 },
  masteredText: { fontSize: 14, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  topicRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, marginTop: 10 },
  topicIcon: { fontSize: 14 },
  topicText: { fontSize: 14, fontWeight: '600' },
  topicCounter: { fontSize: 12, fontWeight: '500' },
  examBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, minWidth: 160, alignItems: 'center', alignSelf: 'center' },
  examBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
});
