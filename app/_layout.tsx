import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack, ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { bottomGutter } from '@/lib/bottomGutter';
import { isDarkTheme } from '@/constants/Colors';
import { FONT_FILES } from '@/constants/Fonts';
import { startBoardSync } from '@/lib/cloud/boardSync';
import { getDb } from '@/lib/database';
import { initI18n, setLanguage, subscribeLanguage } from '@/lib/i18n';
import { FORCED_PAIR, needsPairCorrection } from '@/lib/languages';
import { LearnerProvider, LearnerStore } from '@/lib/learner';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';
import { brutalHeaderOptions } from '@/lib/brutalHeader';
import { startUsageTimer, stopUsageTimer, noteInteraction } from '@/lib/usageTimer';
import { touchCountsAsLearning } from '@/lib/usageRoutes';
import { noteSpeechTouch, watchAppStateForSpeech } from '@/lib/speech';
import { applyWebTestParams, getWebTestParams } from '@/lib/webTestHooks';
import { useAppResume } from '@/lib/useAppResume';
import CloudGate from '@/components/cloud/CloudGate';
import UsageToast from '@/components/UsageToast';
import StatusBarStrip from '@/components/StatusBarStrip';
import SpeechFeedback from '@/components/SpeechFeedback';
import { ScreenFeedbackFrame } from '@/lib/screenFeedback';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
initI18n();

function RootLayout() {
  const [loaded, error] = useFonts({
    ...FONT_FILES,
  });
  const [themeReady, setThemeReady] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  // The learner's settings (direction, level, switches); the startup check below fills the direction in.
  const [learner] = useState(() => new LearnerStore());
  // The Settings direction-switch row calls setLanguage(), which bumps a version number here; the number is the key of <RootLayoutNav> below,
  // so on a switch the whole navigation tree (including the tab labels) is re-rendered
  // fresh, not just the focused screen.
  const [langVersion, setLangVersion] = useState(0);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => subscribeLanguage(() => setLangVersion((v) => v + 1)), []);

  // The weekly leaderboard push (lib/cloud/boardSync.ts); it sends nothing until the learner has joined it.
  useEffect(() => startBoardSync(), []);

  // On a cold start it returns to the last used tab / lesson (lib/useAppResume.ts).
  useAppResume(onboardingDone);

  useEffect(() => {
    async function check() {
      const db = getDb();
      // Web test hook (scripts/ui-overlap.mjs): only from web URL parameters, null on native.
      const testParams = getWebTestParams();
      if (testParams) await applyWebTestParams(db, testParams);
      // Reading the direction also sets the PCIC tab's active direction to the stored
      // target, not always en-es (the store calls data/pcic.ts setPcicTarget).
      let result = await learner.refresh(['direction']);
      // An install whose stored pair is not one of the supported pairs (lib/languages.ts supportedPairs: all
      // 12 ordered pairs of en / es / hu / de), e.g. a language that no longer exists, is corrected to en-es
      // here, silently, at startup; its old DB rows stay, they are just no longer the active pair.
      if (result.onboarded && needsPairCorrection({ source: result.source!, target: result.target })) {
        await learner.setOnboarding(FORCED_PAIR.source, FORCED_PAIR.target);
        result = await learner.refresh(['direction']);
      }
      if (result.onboarded) setLanguage(result.source!);
      setOnboardingDone(result.onboarded);
    }
    if (loaded) check();
  }, [loaded, learner]);

  useEffect(() => {
    if (loaded && onboardingDone !== null && themeReady) {
      SplashScreen.hideAsync();
      if (!onboardingDone) {
        router.replace('/onboarding');
      }
    }
  }, [loaded, onboardingDone, themeReady]);

  if (!loaded || onboardingDone === null) {
    return null;
  }

  return (
    <LearnerProvider store={learner}>
      <ThemeProvider onReady={() => setThemeReady(true)}>
        <RootLayoutNav key={langVersion} />
      </ThemeProvider>
    </LearnerProvider>
  );
}

// Web only: the cloud sign-in gate sits above the whole tree, so the tree (and its DB start-up) mounts only after the
// saved progress is loaded. On native the default export is RootLayout itself: no new render branch, no new hook.
function WebRoot() {
  return (
    <CloudGate>
      <RootLayout />
    </CloudGate>
  );
}

export default Platform.OS === 'web' ? WebRoot : RootLayout;

function RootLayoutNav() {
  const { theme } = useTheme();
  const g = useGrammarColors();
  const { skin } = useSkin();
  // Screens that run under the system navigation bar get the
  // gap in one place, not as a per-screen patch (lib/bottomGutter.ts).
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const gutter = bottomGutter(segments as string[], insets.bottom);

  // Active-usage timer runs for the whole app lifetime; noteInteraction() is
  // wired at the root via a capture-phase touch responder below, so no
  // individual screen/handler needs to be patched.
  useEffect(() => {
    startUsageTimer();
    // The TTS engine stops when switching to the background / foreground, so it does not get stuck.
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
          if (touchCountsAsLearning(segments)) noteInteraction(); // not on the board and settings screens
          noteSpeechTouch(); // the first touch lets the automatic read-aloud speak again
          return false; // never claim the touch, just observe it
        }}
      >
        <StatusBarStrip />
        {/* the one 💬 button of the stack screens (exam, placement, grammar, mistakes...): a screen only names its card (lib/screenFeedback.tsx). */}
        <Stack
          screenOptions={brutalHeaderOptions(g, skin)}
          screenLayout={({ children }) => <ScreenFeedbackFrame>{children}</ScreenFeedbackFrame>}
        >
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
        <SpeechFeedback />
        <UsageToast hidden={(segments as string[])[0] === 'onboarding'} />
      </View>
    </NavThemeProvider>
  );
}
