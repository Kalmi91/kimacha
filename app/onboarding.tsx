import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, Dimensions, Alert, Platform } from 'react-native';
import { router } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { languages, isPairSupported } from '@/lib/languages';
import { getDb } from '@/lib/database';
import { t, setLanguage } from '@/lib/i18n';

const { width } = Dimensions.get('window');
const FLAG_SIZE = width > 400 ? 56 : 48;

type Step = 'source' | 'target';

export default function OnboardingScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const s = t();

  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState<string | null>(null);

  const handleSelect = async (code: string) => {
    if (step === 'source') {
      setSource(code);
      setStep('target');
      return;
    }

    if (!source) return;

    if (!isPairSupported(source, code)) {
      if (Platform.OS === 'web') {
        alert(s.onboarding.pairNotAvailable);
      } else {
        Alert.alert('', s.onboarding.pairNotAvailable);
      }
      return;
    }

    const db = getDb();
    await db.setOnboarding(source, code);
    setLanguage(source);
    router.replace('/(tabs)');
  };

  const availableTargets = languages.filter(l => l.code !== source);
  const items = step === 'source' ? languages : availableTargets;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          {step === 'source' ? s.onboarding.whatLanguage : s.onboarding.whatLearn}
        </Text>
        <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>
          {step === 'source' ? s.onboarding.selectSource : s.onboarding.selectTarget}
        </Text>

        <View style={styles.grid}>
          {items.map(lang => {
            const disabled = step === 'target' && source ? !isPairSupported(source, lang.code) : false;

            return (
              <Pressable
                key={lang.code}
                style={[
                  styles.langCard,
                  { backgroundColor: colors.card, opacity: disabled ? 0.35 : 1 },
                ]}
                onPress={() => handleSelect(lang.code)}
              >
                <Text style={styles.flag}>{lang.flag}</Text>
                <Text style={[styles.langName, { color: colors.text }]}>{lang.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {step === 'target' && (
          <Pressable onPress={() => { setStep('source'); setSource(null); }}>
            <Text style={[styles.back, { color: colors.tint }]}>{s.onboarding.back}</Text>
          </Pressable>
        )}
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
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    maxWidth: 360,
  },
  langCard: {
    width: 100,
    height: 100,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  flag: {
    fontSize: FLAG_SIZE,
    marginBottom: 6,
  },
  langName: {
    fontSize: 13,
    fontWeight: '600',
  },
  back: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 24,
  },
});
