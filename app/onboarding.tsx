import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { getDb } from '@/lib/database';
import { t, setLanguage } from '@/lib/i18n';
import { PCIC_LEVELS, LEVEL_LABELS, pcicItemsForLevel, type PcicLevel } from '@/data/pcic';
import LevelRow from '@/components/LevelRow';

// Kimacha Play: single en-es pair (Kálmán, 2026-09-22), so onboarding no
// longer asks which languages to use, it just greets the learner once
// (FB121) and starts the course with the fixed pair.
// PLAN-play 10. lépés: az üdvözlés után egy második lépés kéri a PCIC
// kezdő-szintet (Kálmán döntése, s1 anki-ui-terv.html); ez a screen csak új
// telepítésnél fut le egyáltalán (app/_layout.tsx a getOnboarding() alapján
// dönt, meglévő telepítés sosem látja).
export default function OnboardingScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const [step, setStep] = useState<'welcome' | 'level'>('welcome');

  const handleSelectLevel = async (level: PcicLevel) => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    await db.setPcicLevel(level);
    setLanguage('en');
    router.replace('/(tabs)');
  };

  if (step === 'level') {
    const levels = PCIC_LEVELS.filter((lvl) => pcicItemsForLevel(lvl).length > 0);
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.welcome, { color: colors.tint }]}>{s.pcic.chooseLevel}</Text>
        {levels.map((lvl) => (
          <LevelRow
            key={lvl}
            level={lvl}
            label={LEVEL_LABELS[lvl]}
            introduced={0}
            total={pcicItemsForLevel(lvl).length}
            active={false}
            colors={colors}
            onPress={() => handleSelectLevel(lvl)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.welcome, { color: colors.tint }]}>{s.onboarding.welcome}</Text>
        <Pressable style={[styles.startBtn, { backgroundColor: colors.tint }]} onPress={() => setStep('level')}>
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
