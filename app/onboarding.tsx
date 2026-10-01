import { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text } from '@/components/KText';
import { router } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { getDb } from '@/lib/database';
import { t, setLanguage } from '@/lib/i18n';
import { PCIC_VIEW_LEVELS, pcicItemsForLevel, pcicItemsForViewLevel, realLevelOfView, setPcicTarget, type PcicLevel, type PcicTarget } from '@/data/pcic';
import LevelRow from '@/components/LevelRow';
import { BrutalButton } from '@/components/grammar/Brutal';
import { OnboardingIntro, OnboardingThemeStep } from '@/components/OnboardingSteps';

// PLAN-ketiranyu 4. lépés (2026-09-28, jóváhagyott vázlat 1-5. pont): az
// onboarding megint irányt kérdez, mint a régi (nem Kimacha Play) ág, de
// csak a két támogatott párra (lib/languages.ts supportedPairs): angolból
// tanulsz spanyolul (en→es), vagy spanyolból angolul (es→en). A választás a
// felület nyelvét is eldönti (setLanguage a kiinduló nyelvre), az "Üdvözlés"
// és a szint-választó lépés már ebben a nyelvben jelenik meg. Meglévő
// telepítés ezt a screent sose látja (app/_layout.tsx a getOnboarding()
// alapján dönt), tehát ott a választó nem jön elő (5. pont).
export default function OnboardingScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  // NY19: brutalista palettán nagy, nagybetűs, ink színű cím.
  const welcomeStyle = [styles.welcome, { color: colors.tint }, g.brutal && [styles.brutalWelcome, { color: g.ink }]];
  const s = t();
  const [step, setStep] = useState<'language' | 'welcome' | 'intro' | 'theme' | 'level'>('language');
  const [source, setSource] = useState<'en' | 'es'>('en');
  const [target, setTarget] = useState<PcicTarget>('es');

  // 2. pont: "English" -> en→es (a mostani app, minden felirat angol);
  // "Español" -> es→en (minden felirat spanyol). A felület nyelve és a PCIC
  // aktív iránya azonnal vált, hogy az Üdvözlés képernyő már jó nyelven jöjjön.
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
            <Pressable style={[styles.startBtn, { backgroundColor: colors.tint }]} onPress={() => handleChooseLanguage('en')}>
              <Text style={[styles.startBtnText, { color: colors.onTint }]}>English</Text>
            </Pressable>
            <Pressable style={[styles.startBtn, { backgroundColor: colors.tint }]} onPress={() => handleChooseLanguage('es')}>
              <Text style={[styles.startBtnText, { color: colors.onTint }]}>Español</Text>
            </Pressable>
          </View>
          )}
        </View>
      </View>
    );
  }

  // PLAN-temak 4C: üdvözlés után a bevezető, utána az 5 témás választó, csak aztán a szint.
  if (step === 'intro') {
    return <OnboardingIntro titleStyle={welcomeStyle} onStart={() => setStep('theme')} />;
  }

  if (step === 'theme') {
    return <OnboardingThemeStep titleStyle={welcomeStyle} onNext={() => setStep('level')} />;
  }

  if (step === 'level') {
    // 3. pont: en-es-ben A1/A2/B1 (a meglévő "0 tétel = ne kínáljuk fel"
    // szűrő); es-en-ben csak A1, mindig felkínálva, akkor is, ha még üres (az
    // 50 angol szó az 5. lépésben jön) - ilyenkor a sor alatt egy mondat mondja ki.
    // 2026-09-28 review, 2. pont: en-es-ben a választható nézet-szintek
    // (A1/A2/B1/B2, PLAN-learn-words-open 2. lépés), nem a nyers PCIC_LEVELS.
    // PLAN-esen: es-en-ben is A1 + A2 van adat, ugyanaz a szűrő mindkét irányra.
    const levels: PcicLevel[] =
      PCIC_VIEW_LEVELS.filter((lvl) => pcicItemsForViewLevel(lvl).length > 0).map(realLevelOfView);
    // PLAN-ketiranyu 4. lépés javítás (2026-09-28 review, 3. pont): a
    // feliratok a felület nyelvén (data/pcic.ts LEVEL_LABELS angolra égetve volt).
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
        <Pressable style={[styles.startBtn, { backgroundColor: colors.tint }]} onPress={() => setStep('intro')}>
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
  // 1. pont: a két nyelv-gomb egymás alatt, a meglévő startBtn stílussal.
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
  // 3. pont: "még nincs szó" sor az üres A1 alatt (es→en, amíg az 5. lépés nincs kész).
  noWordsYet: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 10,
  },
});
