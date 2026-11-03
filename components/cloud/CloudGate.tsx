import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Text } from '@/components/KText';

import CloudLogin from '@/components/cloud/CloudLogin';
import CloudWelcome from '@/components/cloud/CloudWelcome';
import { ActionButton, TitleText } from '@/components/grammar/Themed';
import Colors from '@/constants/Colors';
import { FONT_FILES } from '@/constants/Fonts';
import { fontSize, fontWeight, lineHeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { getProgress, putProgress, type LoginData } from '@/lib/cloud/api';
import { GUEST_OFFER_AFTER, hasVisited, isOfferDone, markOfferDone, markVisited, setCloudGuest, subscribeCardsGraded, subscribeSignInRequests } from '@/lib/cloud/guest';
import { mergeCloudPayloads } from '@/lib/cloud/merge';
import { clearSession, loadSession, saveSession } from '@/lib/cloud/session';
import { exportCloudPayload, restoreFromCloud, snapshotKey, startSync } from '@/lib/cloud/sync';
import { prefetchContentPacks } from '@/lib/games/content/webPacks';
import { useGrammarColors } from '@/lib/grammarColors';
import { rememberedLanguage, setLanguage, t } from '@/lib/i18n';
import { pairOf } from '@/lib/languagePair';
import ScreenFeedback from '@/lib/screenFeedback';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';

// The web gate above the whole app (app/_layout.tsx, web only): with a session there is no app tree until the saved
// progress is in the local DB, so the app's own DB start-up already sees it. Then the sync runs for as long as the page lives.
// Without a session the visitor is a guest (lib/cloud/guest.ts): a first visit goes straight into the app, a later one meets
// the welcome screen first (Sign in / Create account / Skip). A guest has no restore and no sync; a modal over the app offers
// the save after a few cards, and the Settings row opens the sign-in chooser.
type Phase = 'boot' | 'contentError' | 'welcome' | 'guest' | 'loading' | 'error' | 'ready';
type GuestStep = 'ask' | 'create' | 'declined' | 'choose';

// The web DB lives in memory and still holds the old account's progress, so the way back to a clean sign-in is a page restart.
function restartAtLogin() {
  clearSession();
  window.location.reload();
}

function Notice({ title, text, spinner = false, children }: { title?: string; text: string; spinner?: boolean; children?: ReactNode }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  return (
    <View testID="cloud-notice" style={[styles.notice, { backgroundColor: colors.background }]}>
      {title ? <TitleText variant="title" style={[styles.noticeTitle, { color: g.ink }]}>{title}</TitleText> : null}
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

// The guest's modal over the app: the save offer (after GUEST_OFFER_AFTER graded cards), its two answers, and the sign-in
// chooser the Settings row asks for. It has its own ThemeProvider: the gate sits above the app's one.
function GuestOverlay({ onLoggedIn }: { onLoggedIn: (data: LoginData) => void }) {
  const s = t().cloud;
  const [step, setStep] = useState<GuestStep | null>(null);

  useEffect(() => {
    const offCards = subscribeCardsGraded((count) => {
      if (count >= GUEST_OFFER_AFTER && !isOfferDone()) setStep((cur) => cur ?? 'ask');
    });
    const offRequests = subscribeSignInRequests(() => setStep('choose'));
    return () => {
      offCards();
      offRequests();
    };
  }, []);

  // either answer ends the offer for good (the declined note points to Settings)
  const answer = (next: GuestStep) => {
    markOfferDone();
    setStep(next);
  };

  return (
    <Modal visible={step !== null} animationType="fade" onRequestClose={() => setStep((cur) => (cur === 'ask' ? cur : null))}>
      <ThemeProvider>
        {step === 'ask' ? (
          <Notice title={s.askTitle} text={s.askText}>
            <NoticeButton testID="cloud-ask-yes" label={s.askYes} onPress={() => answer('create')} />
            <NoticeButton testID="cloud-ask-no" label={s.askNo} onPress={() => answer('declined')} />
          </Notice>
        ) : null}
        {step === 'create' ? <CloudLogin mode="create" onLoggedIn={onLoggedIn} onBack={() => setStep('declined')} /> : null}
        {step === 'declined' ? (
          <Notice text={s.declinedText}>
            <NoticeButton testID="cloud-declined-ok" label={s.declinedOk} onPress={() => setStep(null)} />
          </Notice>
        ) : null}
        {step === 'choose' ? <CloudWelcome onLoggedIn={onLoggedIn} thirdLabel={s.welcomeCancel} onThird={() => setStep(null)} /> : null}
        {/* the two notes have no feedback button of their own (CloudLogin and CloudWelcome do) */}
        {step === 'ask' || step === 'declined' ? <ScreenFeedback level="-" languagePair={pairOf('es')} currentCard={`cloud-${step}`} /> : null}
      </ThemeProvider>
    </Modal>
  );
}

export default function CloudGate({ children }: { children: ReactNode }) {
  const [fontsLoaded, fontsError] = useFonts({ ...FONT_FILES });
  const [initial] = useState(loadSession);
  // the phase is decided after mount: the static web export renders without localStorage, and the first client render must match it
  const [phase, setPhase] = useState<Phase>('boot');
  const token = useRef<string | null>(initial?.token ?? null);
  const stopSync = useRef<(() => void) | null>(null);
  const started = useRef(false);

  // The progress is in hand: restore it, take the baseline, start the sync, let the app mount.
  const enter = useCallback(async (tok: string, payload: string | null, rev: number) => {
    try {
      await restoreFromCloud(payload);
    } catch {
      setPhase('error');
      return;
    }
    stopSync.current = startSync(tok, await snapshotKey(), restartAtLogin, rev);
    setPhase('ready');
  }, []);

  const restore = useCallback(
    async (tok: string) => {
      setPhase('loading');
      const res = await getProgress(tok);
      if (res.ok) {
        await enter(tok, res.data.payload, res.data.rev);
      } else if (res.error === 'bad_token') {
        clearSession();
        token.current = null;
        setPhase('welcome');
      } else {
        // never mount the app on an empty DB here: its first upload would overwrite the saved progress
        setPhase('error');
      }
    },
    [enter],
  );

  // The lesson packs come first (lib/games/content/webPacks.ts: the web bundle holds no lesson JSON), then the decision.
  const start = useCallback(async () => {
    try {
      await prefetchContentPacks();
    } catch {
      setPhase('contentError');
      return;
    }
    const returning = hasVisited();
    // the language of the last visit, for the welcome screen; a restored session's own language replaces it later
    const lang = rememberedLanguage();
    if (lang) setLanguage(lang);
    // from now on this browser is a returning one, with or without a session (a dead token then lands on the welcome screen)
    markVisited();
    if (token.current) void restore(token.current);
    else setPhase(returning ? 'welcome' : 'guest');
  }, [restore]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  useEffect(() => () => stopSync.current?.(), []);

  // the Settings sign-in row shows only while the guest phase lasts
  useEffect(() => {
    setCloudGuest(phase === 'guest');
    return () => setCloudGuest(false);
  }, [phase]);

  const onLoggedIn = (data: LoginData) => {
    saveSession({ name: data.displayName, token: data.token });
    token.current = data.token;
    setPhase('loading');
    void enter(data.token, data.payload, data.rev);
  };

  // A guest signs in from the modal. A new or empty account just takes over the guest's progress: the sync's first round
  // uploads it, no reload. An account that has progress becomes the base of the merge (mergeCloudPayloads keeps the fields of its
  // FIRST argument that have no rule), the guest's cards melt into it, and the restart loads the result through the restore path.
  // If the upload fails the guest's cards are lost and the account stays as it was.
  const onGuestLoggedIn = async (data: LoginData) => {
    if (data.payload === null) {
      saveSession({ name: data.displayName, token: data.token });
      token.current = data.token;
      stopSync.current = startSync(data.token, null, restartAtLogin, data.rev);
      setPhase('ready');
      return;
    }
    try {
      await putProgress(data.token, mergeCloudPayloads(data.payload, await exportCloudPayload()), false, data.rev);
    } catch {
      // the export failed: the restart below still loads the account as it is
    }
    saveSession({ name: data.displayName, token: data.token });
    window.location.reload();
  };

  const retry = () => {
    if (phase === 'contentError') {
      setPhase('boot');
      void start();
    } else if (token.current) void restore(token.current);
  };

  if (phase === 'ready' || phase === 'guest') {
    return (
      <>
        {children}
        {phase === 'guest' ? <GuestOverlay onLoggedIn={(data) => void onGuestLoggedIn(data)} /> : null}
      </>
    );
  }
  if (!fontsLoaded && !fontsError) return null;

  const s = t().cloud;
  return (
    <ThemeProvider>
      {phase === 'boot' ? <Notice text={s.loading} spinner /> : null}
      {phase === 'contentError' ? (
        <Notice text={s.contentLoadFailed}>
          <NoticeButton testID="cloud-retry" label={s.retry} onPress={retry} />
        </Notice>
      ) : null}
      {phase === 'welcome' ? <CloudWelcome onLoggedIn={onLoggedIn} thirdLabel={s.welcomeSkip} onThird={() => setPhase('guest')} /> : null}
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
  noticeTitle: { fontSize: fontSize.xl, lineHeight: lineHeight.xl, textAlign: 'center' },
  noticeText: { fontSize: fontSize.md, lineHeight: lineHeight.md, textAlign: 'center' },
  button: { alignSelf: 'stretch', maxWidth: 360 },
  classicButton: { minHeight: tapTarget, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  classicButtonText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
});
