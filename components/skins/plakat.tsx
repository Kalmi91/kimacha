import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';

// Poster: a diagonal red band (-22°) and a black circle on the right in the background, a
// slogan strip with a megaphone icon under the header. The word's -6° rotation is the theme's `wordRotate` field
// (KText). No hammer and sickle or red star (forbidden motif).

function PlakatBackdrop() {
  const g = useGrammarColors();
  return (
    <View testID="decor-plakat-art" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
      <View testID="decor-plakat-stripe" style={[styles.stripe, { backgroundColor: g.a }]} />
      <View testID="decor-plakat-disc" style={[styles.disc, { backgroundColor: g.ink }]} />
    </View>
  );
}

function PlakatHeader({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const s = t().settings.themes;
  return (
    <View>
      {children}
      <View testID="decor-plakat-slogan" style={[styles.slogan, { backgroundColor: g.ink }]}>
        <Text testID="decor-plakat-megaphone" style={styles.megaphone}>
          📣
        </Text>
        <Text variant="title" numberOfLines={1} style={[styles.sloganText, { color: g.bg }]}>
          {s.posterSlogan}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  stripe: { position: 'absolute', left: -80, right: -80, top: '38%', height: 56, transform: [{ rotate: '-22deg' }] },
  disc: { position: 'absolute', top: 72, right: -32, width: 84, height: 84, borderRadius: 42 },
  slogan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginVertical: 4,
  },
  megaphone: { fontSize: 12 },
  sloganText: { fontSize: 11, letterSpacing: 1 },
});

export const plakatDecor: SkinDecor = {
  Backdrop: PlakatBackdrop,
  HeaderOrnament: PlakatHeader,
};
