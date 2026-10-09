import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import { useActiveMinutes, useStreakCount } from '@/components/skins/useSkinStats';
import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { xpLevel } from '@/lib/xp';

// Gamer: an XP bar with an "LVL n" label in the header (from all active minutes, lib/xp.ts) and a
// combo "x3" (from the daily streak, at least x1); a "+15 XP" decoration in the card's corner (not real data).

const XP_GAIN = 15;

function GamerHeader({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const { level, pct } = xpLevel(useActiveMinutes());
  const combo = Math.max(1, useStreakCount());
  return (
    <View>
      <View testID="skin-gamer-xp" style={styles.row}>
        <Text testID="skin-gamer-level" style={[styles.level, { color: g.a }]}>
          {t().settings.themes.gamerLevel} {level}
        </Text>
        <View style={[styles.track, { borderColor: g.a }]}>
          <View testID="skin-gamer-xp-fill" style={{ width: `${pct}%`, height: '100%', backgroundColor: g.a }} />
        </View>
        <Text testID="skin-gamer-combo" style={[styles.combo, { color: g.b }]}>
          x{combo}
        </Text>
      </View>
      {children}
    </View>
  );
}

function GamerCardFrame({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  return (
    <View testID="skin-gamer-frame">
      {children}
      <View testID="decor-gamer-gain" pointerEvents="none" style={styles.gain}>
        <Text style={[styles.gainText, { color: g.a }]}>+{XP_GAIN} XP</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  level: { fontSize: 13, fontWeight: '700' },
  track: { flex: 1, height: 10, borderWidth: 1 },
  combo: { fontSize: 13, fontWeight: '700' },
  gain: { position: 'absolute', top: 6, right: 8 },
  gainText: { fontSize: 11, fontWeight: '700' },
});

export const gamerDecor: SkinDecor = {
  HeaderOrnament: GamerHeader,
  CardFrame: GamerCardFrame,
};
