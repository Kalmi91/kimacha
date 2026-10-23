import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import { HalfDisc } from '@/components/skins/parts';
import type { SkinDecor } from '@/components/skins/types';
import Colors from '@/constants/Colors';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { useSkin } from '@/lib/useSkin';

// Ukiyo-e: a wave at the bottom of the card (two rows of semicircles, in the theme's `wave` color), a red
// seal ("語") in the card's top right corner. The `seal` / `wave` color is the theme's extra color; with other
// colors (My mix) color a is the fallback. A tap on the seal opens a bubble that says what the sign means.

const RADIUS = 11;
const BACK_LIFT = 5;
const COUNT = 20;

function Wave({ color, inset }: { color: string; inset: number }) {
  return (
    <View
      testID="decor-ukiyoe-wave"
      pointerEvents="none"
      style={[styles.waveBox, { left: inset, right: inset, bottom: inset }]}
    >
      <View style={[styles.waveRow, { left: -RADIUS, bottom: BACK_LIFT }]}>
        {Array.from({ length: COUNT }, (_, i) => (
          <HalfDisc key={i} testID="decor-ukiyoe-disc" radius={RADIUS} color={color} style={{ opacity: 0.45 }} />
        ))}
      </View>
      <View style={[styles.waveRow, { left: 0, bottom: 0 }]}>
        {Array.from({ length: COUNT }, (_, i) => (
          <HalfDisc key={i} testID="decor-ukiyoe-disc" radius={RADIUS} color={color} />
        ))}
      </View>
    </View>
  );
}

function UkiyoeCardFrame({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  const { theme } = useTheme();
  const colors = Colors[theme];
  const [open, setOpen] = useState(false);
  const sealColor = g.extra.seal ?? g.a;
  return (
    <View testID="skin-ukiyoe-frame">
      {children}
      <Wave color={g.extra.wave ?? g.a} inset={shape.borderWidth} />
      <Pressable
        testID="decor-ukiyoe-seal"
        accessibilityRole="button"
        accessibilityLabel={t().skins.ukiyoeSealMeaning}
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={[styles.seal, { top: shape.borderWidth + 5, right: shape.borderWidth + 5, backgroundColor: sealColor }]}
      >
        <Text style={styles.sealText}>語</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable testID="decor-ukiyoe-seal-overlay" style={styles.overlay} onPress={() => setOpen(false)}>
          <View testID="decor-ukiyoe-seal-bubble" style={[styles.bubble, { backgroundColor: colors.card }]}>
            <Text style={[styles.bubbleSign, { color: sealColor }]}>語</Text>
            <Text style={[styles.bubbleMeaning, { color: colors.text }]}>{t().skins.ukiyoeSealMeaning}</Text>
            <Text style={[styles.bubbleNote, { color: colors.tabIconDefault }]}>{t().skins.ukiyoeSealNote}</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  waveBox: { position: 'absolute', height: RADIUS + BACK_LIFT, overflow: 'hidden' },
  waveRow: { position: 'absolute', flexDirection: 'row' },
  seal: {
    position: 'absolute',
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  sealText: { color: '#FFFFFF', fontSize: 15, lineHeight: 18 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bubble: { padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, alignItems: 'center', gap: 8 },
  bubbleSign: { fontSize: 40, lineHeight: 48 },
  bubbleMeaning: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  bubbleNote: { fontSize: 15, textAlign: 'center' },
});

export const ukiyoeDecor: SkinDecor = {
  CardFrame: UkiyoeCardFrame,
};
