import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import BadgeRow from '@/components/learn/BadgeRow';
import Colors from '@/constants/Colors';
import { PCIC_LEVELS, pcicItemsForLevel, type PcicLevel } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { t } from '@/lib/i18n';
import { useLearner } from '@/lib/learner';
import { levelCounts } from '@/lib/levelCounter';
import { useTheme } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';

// The counter at the top of the Sentences and Practice tabs (Kálmán 2026-10-12: "lássam fogyni"): the level the Words
// tab header shows (e.g. A2 + "230 words", the same chips and labels) plus the words of that level still due.
// It reads the db itself: it loads on mount, again every time the tab comes back into focus, and again whenever
// `refreshKey` changes, so a screen bumps it after each credited answer and the due number drops at once.
// `only` (the Sentences tab, FB631): show that level instead of the learner's, or 'all' = every level summed.
export default function LevelCounter({ refreshKey = 0, only }: { refreshKey?: number; only?: 'all' | PcicLevel }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const { refresh } = useLearner();
  const [counts, setCounts] = useState<{ level: string; total: number; due: number } | null>(null);
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
      // The store sets the direction's deck before the level's items are read.
      const { level } = await refresh(['direction', 'level']);
      const cards = await db.getPcicCards();
      const today = localDateString();
      const of = (l: PcicLevel) => levelCounts(cards, l, pcicItemsForLevel(l).length, today);
      const next =
        only === 'all'
          ? { level: t().sentenceTab.levelAll, total: PCIC_LEVELS.reduce((n, l) => n + of(l).total, 0), due: PCIC_LEVELS.reduce((n, l) => n + of(l).due, 0) }
          : of(only ?? level);
      if (alive) setCounts(next);
    })().catch(() => {
      // a failed read leaves the counts as they were
    });
    return () => {
      alive = false;
    };
  }, [refreshKey, focusSeq, refresh, only]);

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
