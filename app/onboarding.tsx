import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import { router } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { useLearner } from '@/lib/learner';
import { t, setLanguage } from '@/lib/i18n';
import { PCIC_VIEW_LEVELS, pcicItemsForLevel, type PcicLevel, type PcicTarget } from '@/data/pcic';
import { languages, supportedPairs } from '@/lib/languages';
import LevelRow from '@/components/LevelRow';
import PlacementEntry from '@/components/exam/PlacementEntry';
import { ActionButton } from '@/components/grammar/Themed';
import { OnboardingIntro, OnboardingThemeStep } from '@/components/OnboardingSteps';

// Onboarding asks for the direction in two steps, only for the supported pairs
// (lib/languages.ts supportedPairs): "I speak" (the source: English, Español, Magyar), then "I learn"
// (the targets that pair list allows for that source, two each). The first choice also decides the UI
// language (setLanguage to the source language), so the second step, the "Welcome" and the level-picker
// steps already appear in it (a source without UI strings yet falls back to English). An existing installation never sees this screen
// (app/_layout.tsx decides based on getOnboarding()), so the picker does not show up there.
export default function OnboardingScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  // on the brutalist palette a large, uppercase, ink-coloured title.
  const welcomeStyle = [styles.welcome, { color: colors.tint }, g.brutal && [styles.brutalWelcome, { color: g.ink }]];
  const s = t();
  const [step, setStep] = useState<'language' | 'target' | 'welcome' | 'intro' | 'theme' | 'level'>('language');
  const [source, setSource] = useState<string>('en');
  const [target, setTarget] = useState<PcicTarget>('es');
  const { previewTarget, setOnboarding, setLevel } = useLearner();

  // The targets the supported pairs allow for the chosen source.
  const targetsOf = (src: string) => supportedPairs.filter(([from]) => from === src).map(([, to]) => to);

  // Step 1, "I speak": the UI language switches immediately, so the next step already comes up in it.
  const handleChooseLanguage = (chosenSource: string) => {
    setSource(chosenSource);
    setLanguage(chosenSource);
    setStep('target');
  };

  // Step 2, "I learn": the active PCIC direction switches here, so the level step reads the right deck.
  const handleChooseTarget = (chosenTarget: PcicTarget) => {
    setTarget(chosenTarget);
    previewTarget(chosenTarget, source);
    setStep('welcome');
  };

  const handleSelectLevel = async (level: PcicLevel) => {
    await setOnboarding(source, target);
    await setLevel(level);
    router.replace('/(tabs)');
  };

  if (step === 'language') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Text variant="title" style={welcomeStyle}>
            Which language do you speak? / ¿Qué idioma hablas?
          </Text>
          <View style={styles.langButtonGroup}>
            {languages.map((lang, i) => (
              <ActionButton key={lang.code} brutalTestID={`onboarding-lang-${lang.code}`} fill={i % 2 === 0 ? 'a' : 'b'} label={lang.name} onPress={() => handleChooseLanguage(lang.code)} brutalStyle={styles.brutalBtn} classicStyle={[styles.startBtn, { backgroundColor: colors.tint }]} classicTextStyle={[styles.startBtnText, { color: colors.onTint }]} />
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (step === 'target') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Text variant="title" style={welcomeStyle}>{s.onboarding.learnTitle}</Text>
          <View style={styles.langButtonGroup}>
            {targetsOf(source).map((code, i) => (
              <ActionButton key={code} brutalTestID={`onboarding-target-${code}`} fill={i % 2 === 0 ? 'a' : 'b'} label={languages.find((l) => l.code === code)?.name ?? code} onPress={() => handleChooseTarget(code as PcicTarget)} brutalStyle={styles.brutalBtn} classicStyle={[styles.startBtn, { backgroundColor: colors.tint }]} classicTextStyle={[styles.startBtnText, { color: colors.onTint }]} />
            ))}
          </View>
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
    // (A1/A2/B1/B2/C1), not the raw PCIC_LEVELS.
    // es-en also has A1 + A2 data, the same filter applies to both directions.
    const offered: PcicLevel[] = PCIC_VIEW_LEVELS.filter((lvl) => pcicItemsForLevel(lvl).length > 0);
    // A deck with no card at all yet (a Hungarian-source pair before its gloss is filled) still offers A1,
    // so the onboarding can finish.
    const levels: PcicLevel[] = offered.length > 0 ? offered : ['A1'];
    // The labels are in the UI language (they used to be hardcoded in English).
    const levelLabels: Record<PcicLevel, string> = {
      A1: s.pcic.levelBeginner,
      A2: s.pcic.levelElementary,
      B1: s.pcic.levelIntermediate,
      B2: s.pcic.levelUpperIntermediate,
      C1: s.pcic.levelAdvanced,
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
              {total === 0 && (
                <Text style={[styles.noWordsYet, { color: colors.tabIconDefault }]}>{s.wordList.empty}</Text>
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
        <ActionButton brutalTestID="onboarding-start" label={s.onboarding.start} onPress={() => setStep('intro')} brutalStyle={styles.brutalBtn} classicStyle={[styles.startBtn, { backgroundColor: colors.tint }]} classicTextStyle={[styles.startBtnText, { color: colors.onTint }]} />
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
