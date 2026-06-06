import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { type ExamItem } from '@/lib/examBuilder';

type ReadingItem = Extract<ExamItem, { kind: 'reading_mc' }>;

interface Props {
  item: ReadingItem;
  onResult: (correct: boolean) => void;
}

export default function ExamReadingCard({ item, onResult }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    const correct = idx === item.correctIndex;
    setTimeout(() => onResult(correct), 1200);
  };

  const optionColors = ['#2563EB', '#1D4ED8', '#3B82F6', '#1E40AF'];

  return (
    <ScrollView contentContainerStyle={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.readingLabel, { color: colors.tabIconDefault }]}>ES → EN</Text>
      <Text style={[styles.text, { color: colors.text }]}>{item.text}</Text>
      <View style={[styles.divider, { backgroundColor: colors.tabIconDefault }]} />
      <Text style={[styles.question, { color: colors.text }]}>{item.question}</Text>
      <View style={styles.options}>
        {item.options.map((opt, idx) => {
          let bg = optionColors[idx % optionColors.length];
          if (answered) {
            if (idx === item.correctIndex) bg = '#22C55E';
            else if (idx === selected) bg = '#EF4444';
            else bg = colors.tabIconDefault;
          }
          return (
            <Pressable
              key={idx}
              style={[styles.optionBtn, { backgroundColor: bg }]}
              onPress={() => handleSelect(idx)}
            >
              <Text style={styles.optionLetter}>{String.fromCharCode(65 + idx)})</Text>
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    minHeight: 280,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  readingLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    width: '80%',
    opacity: 0.3,
  },
  question: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  options: {
    width: '100%',
    gap: 10,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 10,
  },
  optionLetter: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '700',
  },
  optionText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
});
