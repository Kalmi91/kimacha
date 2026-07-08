import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Stack, ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { getDb } from '@/lib/database';
import { initI18n, setLanguage } from '@/lib/i18n';
import { sendAnalyticsIfNeeded } from '@/lib/analytics';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';

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

  return (
    <NavThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="spelling" options={{ headerShown: false }} />
      </Stack>
    </NavThemeProvider>
  );
}
