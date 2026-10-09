import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack, ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { bottomGutter } from '@/lib/bottomGutter';
import { isDarkTheme } from '@/constants/Colors';
import { FONT_FILES } from '@/constants/Fonts';
import { getDb } from '@/lib/database';
import { initI18n, setLanguage, subscribeLanguage } from '@/lib/i18n';
import { setPcicTarget, type PcicTarget } from '@/data/pcic';
import { FORCED_PAIR, needsPairCorrection } from '@/lib/languages';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';
import { brutalHeaderOptions } from '@/lib/brutalHeader';
import { startUsageTimer, stopUsageTimer, noteInteraction } from '@/lib/usageTimer';
import { watchAppStateForSpeech } from '@/lib/speech';
import { applyWebTestParams, getWebTestParams } from '@/lib/webTestHooks';
import { useAppResume } from '@/lib/useAppResume';
import UsageToast from '@/components/UsageToast';
import StatusBarStrip from '@/components/StatusBarStrip';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
initI18n();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FONT_FILES,
  });
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  // PLAN-ketiranyu 4. lépés (7. pont): a Settings irányváltó sora setLanguage()-t
  // hív, ami itt egy verziószámot léptet; a szám a lenti <RootLayoutNav key>-je,
  // tehát váltáskor az egész navigációs fa (a tab-fülek felirata is) frissen
  // rendereldik, nem csak a fókuszban lévő képernyő.
  const [langVersion, setLangVersion] = useState(0);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => subscribeLanguage(() => setLangVersion((v) => v + 1)), []);

  // FB470: hidegindításkor az utoljára használt fülre / leckére lép vissza (lib/useAppResume.ts).
  useAppResume(onboardingDone);

  useEffect(() => {
    async function check() {
      const db = getDb();
      // Web teszt-horog (scripts/ui-overlap.mjs): csak webes URL-paraméterekből, natívon null.
      const testParams = getWebTestParams();
      if (testParams) await applyWebTestParams(db, testParams);
      let result = await db.getOnboarding();
      // Kimacha Play: single en-es pair (Kálmán, 2026-09-22). An install that
      // still has an older pair (hu-es, es-hu, hu-en, ...) is corrected to
      // en-es here, silently, at startup; its old DB rows stay, they are just
      // no longer the active pair.
      if (result && needsPairCorrection(result)) {
        await db.setOnboarding(FORCED_PAIR.source, FORCED_PAIR.target);
        result = await db.getOnboarding();
      }
      if (result) {
        setLanguage(result.source);
        // PLAN-ketiranyu 4. lépés: a PCIC-fül aktív iránya is a tárolt
        // target-tel induljon, ne mindig en-es-sel (data/pcic.ts activeTarget).
        setPcicTarget(result.target as PcicTarget);
      }
      setOnboardingDone(!!result);
    }
    if (loaded) check();
  }, [loaded]);

  useEffect(() => {
    if (loaded && onboardingDone !== null) {
      SplashScreen.hideAsync();
      if (!onboardingDone) {
        router.replace('/onboarding');
      }
    }
  }, [loaded, onboardingDone]);

  if (!loaded || onboardingDone === null) {
    return null;
  }

  return (
    <ThemeProvider>
      <RootLayoutNav key={langVersion} />
    </ThemeProvider>
  );
}

function RootLayoutNav() {
  const { theme } = useTheme();
  const g = useGrammarColors();
  const { skin } = useSkin();
  // FB202: a rendszer navigációs sávja alá futó képernyők egy helyen kapják meg a
  // rést, nem képernyőnkénti foltként (lib/bottomGutter.ts).
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const gutter = bottomGutter(segments as string[], insets.bottom);

  // Active-usage timer runs for the whole app lifetime; noteInteraction() is
  // wired at the root via a capture-phase touch responder below, so no
  // individual screen/handler needs to be patched.
  useEffect(() => {
    startUsageTimer();
    // FB232: a TTS-motor háttérbe / előtérbe váltásnál leáll, hogy ne akadjon be.
    const unwatchSpeech = watchAppStateForSpeech();
    return () => {
      stopUsageTimer();
      unwatchSpeech();
    };
  }, []);

  return (
    <NavThemeProvider value={isDarkTheme(theme) ? DarkTheme : DefaultTheme}>
      <View
        style={{ flex: 1, paddingBottom: gutter }}
        onStartShouldSetResponderCapture={() => {
          noteInteraction();
          return false; // never claim the touch, just observe it
        }}
      >
        <StatusBarStrip />
        <Stack screenOptions={brutalHeaderOptions(g, skin)}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="credits" options={{ headerShown: false }} />
          <Stack.Screen name="themes" options={{ headerShown: false }} />
          <Stack.Screen name="theme-mix" options={{ headerShown: false }} />
          <Stack.Screen name="grammar" options={{ headerShown: false }} />
          <Stack.Screen name="mistakes" options={{ headerShown: false }} />
          <Stack.Screen name="exam" options={{ headerShown: false }} />
          <Stack.Screen name="placement" options={{ headerShown: false }} />
          <Stack.Screen name="mock-exam" options={{ headerShown: false }} />
        </Stack>
        <UsageToast hidden={(segments as string[])[0] === 'onboarding'} />
      </View>
    </NavThemeProvider>
  );
}
