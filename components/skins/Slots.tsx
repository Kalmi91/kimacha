import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/KText';
import { useSkinDecor } from '@/components/skins';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';

// the places of the decoration layers in the screens. Without a decoration (the default) they render nothing
// / return the base content, so today's look is unchanged.

// The first child of the screen's root View: the background decoration goes behind the content.
export function SkinBackdrop() {
  const { Backdrop } = useSkinDecor();
  if (!Backdrop) return null;
  return (
    <View testID="decor-backdrop" pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Backdrop />
    </View>
  );
}

export function SkinHeader({ children }: { children: ReactNode }) {
  const { HeaderOrnament } = useSkinDecor();
  return HeaderOrnament ? <HeaderOrnament>{children}</HeaderOrnament> : <>{children}</>;
}

export function SkinCardFrame({ children }: { children: ReactNode }) {
  const { CardFrame } = useSkinDecor();
  return CardFrame ? <CardFrame>{children}</CardFrame> : <>{children}</>;
}

export function SkinWord({ word, lang, children }: { word: string; lang?: string; children: ReactNode }) {
  const { WordRenderer } = useSkinDecor();
  return WordRenderer ? (
    <WordRenderer word={word} lang={lang}>
      {children}
    </WordRenderer>
  ) : (
    <>{children}</>
  );
}

// the text label under the sound button (🔊), if the theme asks for it (senior: "Felolvas", i.e. "Read aloud").
export function SkinSpeakLabel() {
  const { speakLabel } = useSkinDecor();
  const g = useGrammarColors();
  if (!speakLabel) return null;
  return (
    <Text testID="skin-speak-label" style={{ color: g.ink, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
      {t().settings.themes.readAloud}
    </Text>
  );
}
