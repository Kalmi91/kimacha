import { StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { getDb } from '@/lib/database';
import { t, setLanguage } from '@/lib/i18n';

// Kimacha Play: single en-es pair (Kálmán, 2026-09-22), so onboarding no
// longer asks which languages to use, it just greets the learner once
// (FB121) and starts the course with the fixed pair.
export default function OnboardingScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const handleStart = async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    setLanguage('en');
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.welcome, { color: colors.tint }]}>{s.onboarding.welcome}</Text>
        <Pressable style={[styles.startBtn, { backgroundColor: colors.tint }]} onPress={handleStart}>
          <Text style={styles.startBtnText}>{s.onboarding.start}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  welcome: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  startBtn: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
  },
  startBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
