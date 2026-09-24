import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import { localDateString } from '@/lib/usageStats';
import { hasLesson, syllabusTopic } from '@/lib/grammar/syllabus';
import type { MistakesBatch } from '@/lib/mistakes/format';
import { cardsForBatches, pickMistakeSession } from '@/lib/mistakes/deck';

// PLAN-hibaim.md 3. lépés ("Riport"): one row per loaded batch (newest
// first, from getMistakeBatches()), a wrong-words list, the grammar patterns
// to review (linking to an existing lesson when there is one), and the
// doubtful (uncertain-correction) sentences the deck leaves out.

export default function MistakesReportScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<MistakesBatch[]>([]);
  const [dueCount, setDueCount] = useState(0);

  const load = useCallback(async () => {
    const db = getDb();
    const rows = await db.getMistakeBatches();
    const parsed: MistakesBatch[] = [];
    for (const row of rows) {
      try {
        parsed.push(JSON.parse(row.json));
      } catch {
        // saveMistakeBatch only ever stores a payload that already passed
        // validateMistakesPayload, so this should not happen; skip rather
        // than crash the report on a corrupted row.
      }
    }
    const cards = cardsForBatches(parsed);
    const progress = await db.getMistakeCards();
    const session = pickMistakeSession(progress, cards, localDateString());
    setBatches(parsed);
    setDueCount(session.length);
    setLoading(false);
  }, []);

  useLoadOnMount(load);

  const header = (
    <View style={styles.headerRow}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.back, { color: colors.text }]}>←</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]}>{s.mistakes.title}</Text>
      <View style={styles.backSpacer} />
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (batches.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <Text style={[styles.emptyText, { color: colors.tabIconDefault }]}>{s.mistakes.empty}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {header}
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable
          testID="mistakes-practice-btn"
          style={[styles.practiceBtn, { backgroundColor: colors.tint }]}
          onPress={() => router.push('/mistakes/deck' as never)}
        >
          <Text style={styles.practiceBtnText}>{s.mistakes.practice(dueCount)}</Text>
        </Pressable>

        {batches.map((batch) => {
          const doubtfulSentences = batch.sentences.filter((sn) => sn.doubtful);
          return (
            <View key={batch.batchId} style={[styles.batchCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.batchTitle, { color: colors.text }]}>{batch.title}</Text>
              <Text style={[styles.batchDate, { color: colors.tabIconDefault }]}>{batch.date}</Text>

              {batch.wrongWords.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{s.mistakes.wrongWordsTitle}</Text>
                  {batch.wrongWords.map((w, i) => (
                    <View key={i} style={styles.itemRow}>
                      <Text style={{ color: colors.text }}>
                        <Text style={styles.strike}>{w.wrong}</Text>
                        {' → '}
                        <Text style={styles.correction}>{w.es}</Text>
                      </Text>
                      {!!w.note && <Text style={[styles.note, { color: colors.tabIconDefault }]}>{w.note}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {batch.patterns.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{s.mistakes.reviewAgainTitle}</Text>
                  {batch.patterns.map((p) => (
                    <View key={p.id} style={styles.patternBlock}>
                      <Text style={[styles.patternTitle, { color: colors.text }]}>{p.title}</Text>
                      <Text style={[styles.patternRule, { color: colors.tabIconDefault }]}>{p.rule}</Text>
                      {p.lessons.map((lessonId) =>
                        hasLesson('es', lessonId) ? (
                          <Pressable
                            key={lessonId}
                            style={[styles.lessonBtn, { borderColor: colors.tint }]}
                            onPress={() => router.push(`/grammar/${lessonId}` as never)}
                          >
                            <Text style={[styles.lessonBtnText, { color: colors.tint }]}>
                              {syllabusTopic(lessonId)?.title.en ?? lessonId}
                            </Text>
                          </Pressable>
                        ) : (
                          <Text key={lessonId} style={[styles.noLesson, { color: colors.tabIconDefault }]}>
                            {s.mistakes.noLesson}
                          </Text>
                        )
                      )}
                    </View>
                  ))}
                </View>
              )}

              {doubtfulSentences.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>⚠ {s.mistakes.doubtfulTitle}</Text>
                  {doubtfulSentences.map((sn) => (
                    <View key={sn.id} style={styles.itemRow}>
                      <Text style={{ color: colors.text }}>
                        <Text style={styles.strike}>{sn.wrong}</Text>
                        {' → '}
                        <Text style={styles.correction}>{sn.es}</Text>
                      </Text>
                      <Text style={[styles.note, { color: colors.tabIconDefault }]}>{sn.en}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  centered: { justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  back: { fontSize: 22, width: 32 },
  backSpacer: { width: 32 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center', marginTop: 24 },
  body: { paddingBottom: 40, gap: 14 },
  practiceBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  practiceBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  batchCard: { borderRadius: 16, padding: 16, gap: 4 },
  batchTitle: { fontSize: 16, fontWeight: '700' },
  batchDate: { fontSize: 12, marginBottom: 4 },
  section: { marginTop: 10, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  itemRow: { gap: 2 },
  strike: { textDecorationLine: 'line-through', opacity: 0.6 },
  correction: { fontWeight: '700' },
  note: { fontSize: 12 },
  patternBlock: { gap: 4, marginBottom: 4 },
  patternTitle: { fontSize: 14, fontWeight: '600' },
  patternRule: { fontSize: 13 },
  lessonBtn: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 },
  lessonBtnText: { fontSize: 13, fontWeight: '600' },
  noLesson: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
});
