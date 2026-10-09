import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';

// Plakát: átlós piros sáv (-22°) és fekete kör jobb oldalt a háttérben, a
// fejléc alatt szlogen-csík megafon-ikonnal. A szó -6°-os forgatása a téma `wordRotate` mezője
// (KText). Sarló-kalapács és vörös csillag nincs (tiltott motívum).

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
