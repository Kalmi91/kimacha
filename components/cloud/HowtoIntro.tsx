import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/KText';

import { ActionButton, TitleText } from '@/components/grammar/Themed';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, lineHeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { browserLanguage, howtoSources } from '@/lib/cloud/howto';
import { useGrammarColors } from '@/lib/grammarColors';
import { cloudStringsFor } from '@/lib/i18n';
import { pairOf } from '@/lib/languagePair';
import ScreenFeedback from '@/lib/screenFeedback';
import { useTheme } from '@/lib/ThemeContext';

function HowtoButton({ testID, label, onPress }: { testID?: string; label: string; onPress: () => void }) {
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

// onSignIn: a visitor who already has an account (another device) goes to the welcome screen's Sign in from here
export default function HowtoIntro({ onDone, onSignIn }: { onDone: () => void; onSignIn: () => void }) {
  const src = howtoSources(browserLanguage());
  const s = cloudStringsFor(src.lang);
  const { theme } = useTheme();
  const g = useGrammarColors();
  const { width, height } = useWindowDimensions();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const videoWidth = Math.max(0, Math.min(width - spacing.xl * 2, height * 0.7 * 9 / 16));

  useEffect(() => {
    const video = videoRef.current;
    return () => video?.pause();
  }, []);

  const play = () => {
    setPlaying(true);
    void videoRef.current?.play().catch(() => {
      // The controls stay visible so the visitor can retry a blocked play.
    });
  };

  return (
    <View testID="howto-screen" style={[styles.container, { backgroundColor: Colors[theme].background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TitleText variant="title" style={[styles.title, { color: g.ink }]}>{s.howtoTitle}</TitleText>
        <View style={{ width: videoWidth, aspectRatio: 9 / 16 }}>
          {React.createElement('video', {
            ref: videoRef,
            src: src.video,
            poster: src.poster,
            preload: 'none',
            playsInline: true,
            crossOrigin: 'anonymous',
            controls: playing,
            onEnded: onDone,
            onError: () => setFailed(true),
            style: { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'black' },
          }, src.track ? React.createElement('track', {
            kind: 'subtitles',
            default: true,
            src: src.track.src,
            srcLang: src.track.srclang,
            label: src.lang,
          }) : null)}
          {!playing ? (
            <View style={styles.playOverlay}>
              <HowtoButton testID="howto-play" label={s.howtoPlay} onPress={play} />
            </View>
          ) : null}
        </View>
        {failed ? <Text style={[styles.failed, { color: g.ink }]}>{s.howtoFailed}</Text> : null}
        <View style={styles.buttons}>
          <HowtoButton testID="howto-skip" label={playing ? s.howtoContinue : s.howtoSkip} onPress={onDone} />
          <HowtoButton testID="howto-signin" label={s.welcomeSignIn} onPress={onSignIn} />
        </View>
      </ScrollView>
      <ScreenFeedback level="-" languagePair={pairOf('es')} currentCard="cloud-howto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // the top padding keeps the title clear of the feedback button in the top right corner
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, paddingTop: spacing.xxl + spacing.xl, gap: spacing.md },
  title: { fontSize: fontSize.xl, lineHeight: lineHeight.xl, textAlign: 'center' },
  playOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  failed: { fontSize: fontSize.md, lineHeight: lineHeight.md, textAlign: 'center' },
  buttons: { width: '100%', maxWidth: 360, gap: spacing.md },
  button: { alignSelf: 'stretch', maxWidth: 360 },
  classicButton: { minHeight: tapTarget, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  classicButtonText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
});
