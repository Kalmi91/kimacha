import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/KText';
import { useSkinDecor } from '@/components/skins';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';

// a dísz-rétegek helyei a képernyőkben. Dísz nélkül (alapértelmezés) semmit
// nem renderelnek / az alap tartalmat adják vissza, így a mai kinézet változatlan.

// A képernyő gyökér-View-jának első gyereke: a háttér-dísz a tartalom mögé kerül.
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

// a hang-gomb (🔊) alá kerülő szöveges felirat, ha a téma kéri (senior: "Felolvas").
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
