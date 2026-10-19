import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import BadgeRow from '@/components/learn/BadgeRow';
import Colors from '@/constants/Colors';
import { pcicItemsForLevel, setPcicTarget, type PcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { t } from '@/lib/i18n';
import { levelCounts, type LevelCounts } from '@/lib/levelCounter';
import { useTheme } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';

// The counter at the top of the Sentences and Practice tabs (Kálmán 2026-10-12: "lássam fogyni"): the level the Words
// tab header shows (e.g. A2 + "230 words", the same chips and labels) plus the words of that level still due.
// It reads the db itself: it loads on mount, again every time the tab comes back into focus, and again whenever
// `refreshKey` changes, so a screen bumps it after each credited answer and the due number drops at once.
export default function LevelCounter({ refreshKey = 0 }: { refreshKey?: number }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const [counts, setCounts] = useState<LevelCounts | null>(null);
  const [focusSeq, setFocusSeq] = useState(0);
  const mounted = useRef(false);

  // The first focus is the mount itself (the effect below already loads); later ones reload.
  useFocusEffect(
    useCallback(() => {
      if (!mounted.current) {
        mounted.current = true;
        return;
      }
      setFocusSeq((n) => n + 1);
    }, []),
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      const db = getDb();
      // The target decides which direction's deck is loaded (data/pcic.ts setPcicTarget), before the level's items are read.
      const dir = ((await db.getOnboarding())?.target as PcicTarget) ?? 'es';
      setPcicTarget(dir);
      const level = await db.getPcicLevel();
      const next = levelCounts(await db.getPcicCards(), level, pcicItemsForLevel(level).length, localDateString());
      if (alive) setCounts(next);
    })().catch(() => {
      // a failed read leaves the counts as they were
    });
    return () => {
      alive = false;
    };
  }, [refreshKey, focusSeq]);

  if (!counts) return null;
  return (
    <View testID="level-counter" accessible accessibilityLabel={s.levelCounter.a11y(counts.level, counts.total, counts.due)} style={styles.wrap}>
      <BadgeRow
        colors={colors}
        items={[
          { label: counts.level, tone: 'accent' },
          { label: s.pcic.badgeTotal(counts.total) },
          { label: s.pcic.badgeDue(counts.due), tone: 'blue', tabular: true },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexShrink: 1 },
});
