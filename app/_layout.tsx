import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack, ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { bottomGutter } from '@/lib/bottomGutter';
import { getDb } from '@/lib/database';
import { initI18n, setLanguage } from '@/lib/i18n';
import { sendAnalyticsIfNeeded } from '@/lib/analytics';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import { startUsageTimer, stopUsageTimer, noteInteraction } from '@/lib/usageTimer';
import UsageToast from '@/components/UsageToast';
import StatusBarStrip from '@/components/StatusBarStrip';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
initI18n();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    async function check() {
      const db = getDb();
      const result = await db.getOnboarding();
      if (result) {
        setLanguage(result.source);
        sendAnalyticsIfNeeded();
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
      <RootLayoutNav />
    </ThemeProvider>
  );
}

function RootLayoutNav() {
  const { theme } = useTheme();
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
    return () => stopUsageTimer();
  }, []);

  return (
    <NavThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <View
        style={{ flex: 1, paddingBottom: gutter }}
        onStartShouldSetResponderCapture={() => {
          noteInteraction();
          return false; // never claim the touch, just observe it
        }}
      >
        <StatusBarStrip />
        <Stack>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="spelling" options={{ headerShown: false }} />
          <Stack.Screen name="games" options={{ headerShown: false }} />
          <Stack.Screen name="grammar" options={{ headerShown: false }} />
        </Stack>
        <UsageToast />
      </View>
    </NavThemeProvider>
  );
}
