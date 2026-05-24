import { StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import FeedbackButton from '@/components/FeedbackModal';

export default function ActiveScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.emoji]}>🎙️</Text>
      <Text style={[styles.title, { color: colors.text }]}>{s.active.title}</Text>
      <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>
        {s.active.comingSoon}
      </Text>
      <Text style={[styles.description, { color: colors.tabIconDefault }]}>
        {s.active.description}
      </Text>
      <FeedbackButton level="-" languagePair="-" currentCard="active-tab" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
