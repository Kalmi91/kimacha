import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Text } from '@/components/KText';

import CloudLogin from '@/components/cloud/CloudLogin';
import { ActionButton } from '@/components/grammar/Themed';
import Colors from '@/constants/Colors';
import { FONT_FILES } from '@/constants/Fonts';
import { fontSize, fontWeight, lineHeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { getProgress, type LoginData } from '@/lib/cloud/api';
import { clearSession, loadSession, saveSession } from '@/lib/cloud/session';
import { restoreFromCloud, snapshotKey, startSync } from '@/lib/cloud/sync';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';

// The web gate above the whole app (app/_layout.tsx, web only): no app tree until there is a session AND the saved
// progress is in the local DB, so the app's own DB start-up already sees it. Then the sync runs for as long as the page lives.
type Phase = 'login' | 'loading' | 'error' | 'ready';

// The web DB lives in memory and still holds the old account's progress, so the way back to a clean sign-in is a page restart.
function restartAtLogin() {
  clearSession();
  window.location.reload();
}

function Notice({ text, spinner = false, children }: { text: string; spinner?: boolean; children?: ReactNode }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  return (
    <View testID="cloud-notice" style={[styles.notice, { backgroundColor: colors.background }]}>
      <Text style={[styles.noticeText, { color: g.ink }]}>{text}</Text>
      {spinner ? <ActivityIndicator color={colors.tint} /> : null}
      {children}
    </View>
  );
}

function NoticeButton({ testID, label, onPress }: { testID: string; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  return (
    <ActionButton
      testID={testID}
      label={label}
      onPress={onPress}
      brutalStyle={styles.button}
      classicStyle={[styles.button, styles.classicButton, { backgroundColor: colors.tint }]}
      classicTextStyle={[styles.classicButtonText, { color: colors.onTint }]}
    />
  );
}

export default function CloudGate({ children }: { children: ReactNode }) {
  const [fontsLoaded, fontsError] = useFonts({ ...FONT_FILES });
  const [initial] = useState(loadSession);
  const [phase, setPhase] = useState<Phase>(initial ? 'loading' : 'login');
  const token = useRef<string | null>(initial?.token ?? null);
  const stopSync = useRef<(() => void) | null>(null);
  const started = useRef(false);

  // The progress is in hand: restore it, take the baseline, start the sync, let the app mount.
  const enter = useCallback(async (tok: string, payload: string | null) => {
    try {
      await restoreFromCloud(payload);
    } catch {
      setPhase('error');
      return;
    }
    stopSync.current = startSync(tok, await snapshotKey(), restartAtLogin);
    setPhase('ready');
  }, []);

  const restore = useCallback(
    async (tok: string) => {
      setPhase('loading');
      const res = await getProgress(tok);
      if (res.ok) {
        await enter(tok, res.data.payload);
      } else if (res.error === 'bad_token') {
        clearSession();
        token.current = null;
        setPhase('login');
      } else {
        // never mount the app on an empty DB here: its first upload would overwrite the saved progress
        setPhase('error');
      }
    },
    [enter],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (token.current) void restore(token.current);
  }, [restore]);

  useEffect(() => () => stopSync.current?.(), []);

  const onLoggedIn = (data: LoginData) => {
    saveSession({ name: data.displayName, token: data.token });
    token.current = data.token;
    setPhase('loading');
    void enter(data.token, data.payload);
  };

  const retry = () => {
    if (token.current) void restore(token.current);
  };

  if (phase === 'ready') return <>{children}</>;
  if (!fontsLoaded && !fontsError) return null;

  const s = t().cloud;
  return (
    <ThemeProvider>
      {phase === 'login' ? <CloudLogin onLoggedIn={onLoggedIn} /> : null}
      {phase === 'loading' ? <Notice text={s.loading} spinner /> : null}
      {phase === 'error' ? (
        <Notice text={s.loadFailed}>
          <NoticeButton testID="cloud-retry" label={s.retry} onPress={retry} />
          <NoticeButton testID="cloud-back" label={s.backToLogin} onPress={restartAtLogin} />
        </Notice>
      ) : null}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  notice: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  noticeText: { fontSize: fontSize.md, lineHeight: lineHeight.md, textAlign: 'center' },
  button: { alignSelf: 'stretch', maxWidth: 360 },
  classicButton: { minHeight: tapTarget, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  classicButtonText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
});
