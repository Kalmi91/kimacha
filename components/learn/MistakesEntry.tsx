import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/KText';
import { router } from 'expo-router';

import Colors from '@/constants/Colors';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalBox, textOnFill } from '@/components/grammar/Brutal';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import { localDateString } from '@/lib/usageStats';
import { cardsForBatches, pickMistakeSession } from '@/lib/mistakes/deck';
import type { MistakesBatch } from '@/lib/mistakes/format';

type ColorScheme = (typeof Colors)['light'];

// PCIC entry point: standalone, loads its own data too, so that
// app/(tabs)/index.tsx (785 lines) does not grow past 800 because of one state + loading.
// Only renders if there is at least one loaded "Hibáim" ("My mistakes") batch; the PCIC's
// existing fields/buttons (BadgeRow, chips) stay untouched.
export default function MistakesEntry({ colors }: { colors: ColorScheme }) {
  const g = useGrammarColors();
  const [visible, setVisible] = useState(false);
  const [dueCount, setDueCount] = useState(0);

  const load = useCallback(async () => {
    const db = getDb();
    const rows = await db.getMistakeBatches();
    if (rows.length === 0) {
      setVisible(false);
      return;
    }
    const batches: MistakesBatch[] = [];
    for (const row of rows) {
      try {
        batches.push(JSON.parse(row.json));
      } catch {
        // saveMistakeBatch only ever stores an already-validated payload.
      }
    }
    const cards = cardsForBatches(batches);
    const progress = await db.getMistakeCards();
    const session = pickMistakeSession(progress, cards, localDateString());
    setDueCount(session.length);
    setVisible(true);
  }, []);

  useLoadOnMount(load);

  if (!visible) return null;

  // on the brutalist palette a BrutalBox with `a` fill, uppercase weight-500 text.
  if (g.brutal) {
    return (
      <BrutalBox testID="mistakes-entry" fill="a" style={styles.brutalWrap} boxStyle={styles.brutalRow} onPress={() => router.push('/mistakes' as never)}>
        <Text style={[styles.brutalLabel, { color: textOnFill(g, 'a') }]}>{t().mistakes.entry(dueCount)}</Text>
      </BrutalBox>
    );
  }

  return (
    <Pressable style={styles.row} onPress={() => router.push('/mistakes' as never)}>
      <Text style={[styles.label, { color: colors.tint }]}>{t().mistakes.entry(dueCount)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  brutalWrap: { alignSelf: 'center' },
  brutalRow: { paddingVertical: 8, paddingHorizontal: 14 },
  brutalLabel: { fontSize: 13, fontWeight: '500', textTransform: 'uppercase' },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
