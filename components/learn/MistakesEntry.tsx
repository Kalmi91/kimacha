import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import Colors from '@/constants/Colors';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import { localDateString } from '@/lib/usageStats';
import { cardsForBatches, pickMistakeSession } from '@/lib/mistakes/deck';
import type { MistakesBatch } from '@/lib/mistakes/format';

type ColorScheme = (typeof Colors)['light'];

// PLAN-hibaim.md 4. lépés (PCIC-belépő): önálló, adatot is maga tölt, hogy az
// app/(tabs)/index.tsx (785 sor) ne nőjön 800 fölé egy állapot+betöltés miatt.
// Csak akkor renderel, ha van legalább egy betöltött "Hibáim" köteg; a PCIC
// meglévő mezői/gombjai (BadgeRow, chip-ek) érintetlenek maradnak.
export default function MistakesEntry({ colors }: { colors: ColorScheme }) {
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
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
