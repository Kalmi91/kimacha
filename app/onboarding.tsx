import { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text } from '@/components/KText';
import { router } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { getDb } from '@/lib/database';
import { t, setLanguage } from '@/lib/i18n';
import { PCIC_VIEW_LEVELS, pcicItemsForLevel, setPcicTarget, type PcicLevel, type PcicTarget } from '@/data/pcic';
import LevelRow from '@/components/LevelRow';
import PlacementEntry from '@/components/exam/PlacementEntry';
import { BrutalButton } from '@/components/grammar/Brutal';
import { OnboardingIntro, OnboardingThemeStep } from '@/components/OnboardingSteps';

// Onboarding asks for the direction again, like the old (non-Kimacha Play) branch, but
// only for the two supported pairs (lib/languages.ts supportedPairs): learning Spanish
// from English (en→es), or English from Spanish (es→en). The choice also decides the UI
// language (setLanguage to the source language), so the "Welcome" and the level-picker
// steps already appear in it. An existing installation never sees this screen
// (app/_layout.tsx decides based on getOnboarding()), so the picker does not show up there.
export default function OnboardingScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  // on the brutalist palette a large, uppercase, ink-coloured title.
  const welcomeStyle = [styles.welcome, { color: colors.tint }, g.brutal && [styles.brutalWelcome, { color: g.ink }]];
  const s = t();
  const [step, setStep] = useState<'language' | 'welcome' | 'intro' | 'theme' | 'level'>('language');
  const [source, setSource] = useState<'en' | 'es'>('en');
  const [target, setTarget] = useState<PcicTarget>('es');

  // "English" -> en→es (today's app, every label in English);
  // "Español" -> es→en (every label in Spanish). The UI language and the active PCIC
  // direction switch immediately, so the Welcome screen already comes up in the right language.
  const handleChooseLanguage = (chosenSource: 'en' | 'es') => {
    const chosenTarget: PcicTarget = chosenSource === 'en' ? 'es' : 'en';
    setSource(chosenSource);
    setTarget(chosenTarget);
    setLanguage(chosenSource);
    setPcicTarget(chosenTarget);
    setStep('welcome');
  };

  const handleSelectLevel = async (level: PcicLevel) => {
    const db = getDb();
    await db.setOnboarding(source, target);
    await db.setPcicLevel(level);
    router.replace('/(tabs)');
  };

  if (step === 'language') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Text variant="title" style={welcomeStyle}>
            Which language do you speak? / ¿Qué idioma hablas?
          </Text>
          {g.brutal ? (
            <View style={styles.langButtonGroup}>
              <BrutalButton testID="onboarding-lang-en" fill="a" label="English" onPress={() => handleChooseLanguage('en')} style={styles.brutalBtn} />
              <BrutalButton testID="onboarding-lang-es" fill="b" label="Español" onPress={() => handleChooseLanguage('es')} style={styles.brutalBtn} />
            </View>
          ) : (
          <View style={styles.langButtonGroup}>
            <Pressable accessibilityRole="button" style={[styles.startBtn, { backgroundColor: colors.tint }]} onPress={() => handleChooseLanguage('en')}>
              <Text style={[styles.startBtnText, { color: colors.onTint }]}>English</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={[styles.startBtn, { backgroundColor: colors.tint }]} onPress={() => handleChooseLanguage('es')}>
              <Text style={[styles.startBtnText, { color: colors.onTint }]}>Español</Text>
            </Pressable>
          </View>
          )}
        </View>
      </View>
    );
  }

  // after the welcome comes the intro, then the 5-theme picker, only then the level.
  if (step === 'intro') {
    return <OnboardingIntro titleStyle={welcomeStyle} onStart={() => setStep('theme')} />;
  }

  if (step === 'theme') {
    return <OnboardingThemeStep titleStyle={welcomeStyle} onNext={() => setStep('level')} />;
  }

  if (step === 'level') {
    // en-es: A1/A2/B1 (the existing "0 items = don't offer it" filter); es-en: only A1,
    // always offered, even while it is still empty (the 50 English words come later) - in that
    // case a sentence under the row says so. In en-es the selectable view levels
    // (A1/A2/B1/B2), not the raw PCIC_LEVELS.
    // es-en also has A1 + A2 data, the same filter applies to both directions.
    const levels: PcicLevel[] = PCIC_VIEW_LEVELS.filter((lvl) => pcicItemsForLevel(lvl).length > 0);
    // The labels are in the UI language (they used to be hardcoded in English).
    const levelLabels: Record<PcicLevel, string> = {
      A1: s.pcic.levelBeginner,
      A2: s.pcic.levelElementary,
      B1: s.pcic.levelIntermediate,
      B2: s.pcic.levelUpperIntermediate,
    };
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text variant="title" style={welcomeStyle}>{s.pcic.chooseLevel}</Text>
        {levels.map((lvl) => {
          const total = pcicItemsForLevel(lvl).length;
          return (
            <View key={lvl}>
              <LevelRow
                level={lvl}
                label={levelLabels[lvl]}
                introduced={0}
                total={total}
                active={false}
                colors={colors}
                onPress={() => handleSelectLevel(lvl)}
              />
              {target === 'en' && total === 0 && (
                <Text style={[styles.noWordsYet, { color: colors.tabIconDefault }]}>Todavía no hay palabras.</Text>
              )}
            </View>
          );
        })}
        {/* a quiet entry to the placement test below the level rows. */}
        <PlacementEntry onPress={() => router.push('/placement')} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text variant="title" style={welcomeStyle}>{s.onboarding.welcome}</Text>
        {g.brutal ? (
          <BrutalButton testID="onboarding-start" label={s.onboarding.start} onPress={() => setStep('intro')} style={styles.brutalBtn} />
        ) : (
        <Pressable accessibilityRole="button" style={[styles.startBtn, { backgroundColor: colors.tint }]} onPress={() => setStep('intro')}>
          <Text style={[styles.startBtnText, { color: colors.onTint }]}>{s.onboarding.start}</Text>
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
  welcome: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  brutalWelcome: { fontSize: 24, fontWeight: '500', textTransform: 'uppercase' },
  brutalBtn: { minWidth: 240 },
  // the two language buttons one under the other, with the existing startBtn style.
  langButtonGroup: {
    gap: 14,
    alignItems: 'center',
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
  // "no words yet" row under the empty A1 (es→en, until the English word list is ready).
  noWordsYet: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 10,
  },
});
