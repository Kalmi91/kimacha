import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import { useStreakCount } from '@/components/skins/useSkinStats';
import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';

// Y2K: elforgatott (+8°) matrica "new word / palabra nueva" a kártya jobb felső
// sarkában, csillag-ikonok a kártya körül, a fejlécben streak-chip a valós napi sorozattal.

const STICKER_FALLBACK = '#FF9BD2';

function Star({ style, size }: { style: object; size: number }) {
  const g = useGrammarColors();
  return (
    <View testID="decor-y2k-star" pointerEvents="none" style={[styles.star, style]}>
      <Text style={{ color: g.ink, fontSize: size }}>✦</Text>
    </View>
  );
}

function Y2kCardFrame({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  return (
    <View testID="skin-y2k-frame">
      {children}
      <View
        testID="decor-y2k-sticker"
        pointerEvents="none"
        style={[styles.sticker, { backgroundColor: g.extra.sticker ?? STICKER_FALLBACK, borderColor: g.ink }]}
      >
        <Text numberOfLines={1} style={[styles.stickerText, { color: g.ink }]}>
          {t().settings.themes.newWord}
        </Text>
      </View>
      <Star size={14} style={{ left: 10, top: 8 }} />
      <Star size={10} style={{ right: 12, bottom: 10 }} />
      <Star size={18} style={{ left: 14, bottom: 8 }} />
    </View>
  );
}

function Y2kHeader({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const streak = useStreakCount();
  return (
    <View>
      <View style={styles.headRow}>
        <Star size={14} style={styles.inline} />
        <View testID="skin-y2k-streak" style={[styles.chip, { backgroundColor: g.b, borderColor: g.ink }]}>
          <Text style={[styles.chipText, { color: g.ink }]}>🔥 {streak}</Text>
        </View>
        <Star size={10} style={styles.inline} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  star: { position: 'absolute' },
  inline: { position: 'relative' },
  sticker: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    transform: [{ rotate: '8deg' }],
  },
  stickerText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 },
  chip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  chipText: { fontSize: 13, fontWeight: '700' },
});

export const y2kDecor: SkinDecor = {
  CardFrame: Y2kCardFrame,
  HeaderOrnament: Y2kHeader,
};
