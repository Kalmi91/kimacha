import { useCallback, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import { localDateString } from '@/lib/usageStats';
import { charDiff } from '@/lib/charDiff';
import { speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import { answerInputProps } from '@/lib/inputProps';
import { requeueAfterGrade } from '@/lib/pcicSession';
import { sm2Review, type Sm2Card, type Sm2Grade } from '@/lib/sm2';
import type { MistakesBatch } from '@/lib/mistakes/format';
import { cardsForBatches, pickMistakeSession, suggestedMistakeGrade, type MistakeCard } from '@/lib/mistakes/deck';
import CardShell from '@/components/learn/CardShell';
import DockedAction, { DOCK_RESERVE } from '@/components/learn/DockedAction';
import { useDockLift } from '@/components/learn/useDockLift';

// PLAN-hibaim.md 4. lépés ("Pakli"): the PCIC card surface (CardShell,
// DockedAction) over the cards lib/mistakes/deck.ts builds from every loaded
// batch, scheduled with the same lib/sm2.ts SM-2 used on the PCIC tab, on its
// own mistake_cards table. The grading buttons/labels and the pre-selected
// grade are 1:1 with the PCIC tab's (PcicRevealedAnswer.tsx), per Kálmán's
// "a PCIC szövegeivel" in the approved screen description.

const GRADES: Sm2Grade[] = ['again', 'good'];

const CHIP_LABEL: Record<MistakeCard['kind'], (s: ReturnType<typeof t>) => string> = {
  sentence: (s) => s.mistakes.chipSentence,
  word: (s) => s.mistakes.chipWord,
  drill: (s) => s.mistakes.chipGrammar,
};

export default function MistakesDeckScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const { dockLift } = useDockLift();

  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState('');
  const [cardsById, setCardsById] = useState<Map<string, MistakeCard>>(new Map());
  const [queue, setQueue] = useState<Sm2Card[]>([]);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);
  const [dockH, setDockH] = useState(DOCK_RESERVE);

  const load = useCallback(async () => {
    const db = getDb();
    const rows = await db.getMistakeBatches();
    const batches: MistakesBatch[] = [];
    for (const row of rows) {
      try {
        batches.push(JSON.parse(row.json));
      } catch {
        // saveMistakeBatch only stores an already-validated payload.
      }
    }
    const cards = cardsForBatches(batches);
    const progress = await db.getMistakeCards();
    const day = localDateString();
    setToday(day);
    setCardsById(new Map(cards.map((c) => [c.cardId, c])));
    setQueue(pickMistakeSession(progress, cards, day));
    setTyped('');
    setChecked(false);
    setLoading(false);
    // setTyped is listed for the same React Compiler reason as
    // app/grammar/deck/[topic].tsx's load: onChangeText={setTyped} below
    // makes it look reactive, it is not.
  }, [setTyped]);

  useLoadOnMount(load);

  const current = queue[0];
  const currentCard = current ? cardsById.get(current.itemId) : undefined;
  const complete = !loading && queue.length === 0;

  const handleCheck = () => {
    if (!currentCard) return;
    setChecked(true);
    speak(currentCard.answer, speechLang('es'));
  };

  const handleGrade = async (grade: Sm2Grade) => {
    if (!current) return;
    const next = sm2Review(current, grade, today);
    await getDb().upsertMistakeCard(next);
    setQueue((prev) => requeueAfterGrade(prev, next, today));
    setTyped('');
    setChecked(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.back, { color: colors.text }]}>←</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {s.mistakes.title}
      </Text>
      <View style={styles.backSpacer} />
    </View>
  );

  if (complete || !currentCard) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.doneBody}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={[styles.doneTitle, { color: colors.text }]}>{s.mistakes.allDone}</Text>
          <Pressable style={[styles.btn, { backgroundColor: colors.tint }]} onPress={() => router.back()}>
            <Text style={styles.btnTextOnTint}>{s.mistakes.title}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const nextGrade: Sm2Grade = suggestedMistakeGrade(typed, currentCard.answer);

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}

      <ScrollView
        style={styles.cardScroll}
        contentContainerStyle={[styles.cardScrollContent, { paddingBottom: 16 + dockH + dockLift }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <CardShell compact colors={colors} chip={CHIP_LABEL[currentCard.kind](s)} onPress={() => Keyboard.dismiss()}>
          <Text style={[styles.promptBig, { color: colors.text }]}>{currentCard.prompt}</Text>
          {currentCard.kind === 'drill' && (
            <Text style={[styles.promptEn, { color: colors.tabIconDefault }]}>{currentCard.promptEn}</Text>
          )}

          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }]}
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={checked ? () => handleGrade(nextGrade) : handleCheck}
            editable={!checked}
            autoFocus
            {...answerInputProps}
          />

          {checked && (
            <View style={styles.resultSection}>
              <Text style={styles.diffLine}>
                {charDiff(typed, currentCard.answer, { case: true, accents: false }).map((d, i) => (
                  <Text key={i} style={d.missing ? styles.diffMissing : d.wrong ? styles.diffWrong : { color: colors.text }}>
                    {d.ch}
                  </Text>
                ))}
              </Text>
              <View style={styles.frontRow}>
                <Text style={[styles.correctAnswer, { color: colors.tint }]}>{currentCard.answer}</Text>
                <Pressable onPress={() => speak(currentCard.answer, speechLang('es'))} style={styles.speakBtn}>
                  <Text style={styles.speakIcon}>🔊</Text>
                </Pressable>
              </View>

              {currentCard.wrong && (
                <View style={styles.youSaidBlock}>
                  <Text style={[styles.youSaidLabel, { color: colors.tabIconDefault }]}>{s.mistakes.youSaid}</Text>
                  <Text style={[styles.youSaidText, { color: colors.text }]}>{currentCard.wrong}</Text>
                </View>
              )}

              {currentCard.patternRule && (
                <Text style={[styles.patternRule, { color: colors.tabIconDefault }]}>{currentCard.patternRule}</Text>
              )}
            </View>
          )}

          {checked && (
            <View style={styles.gradesRow}>
              {GRADES.map((g) => {
                const isPre = nextGrade === g;
                return (
                  <Pressable
                    key={g}
                    style={({ pressed }) => [
                      styles.gradeBtn,
                      {
                        backgroundColor: pressed ? (g === 'good' ? '#22C55E' : '#EF4444') : g === 'good' ? '#38BDF8' : '#1D4ED8',
                        borderColor: pressed ? (g === 'good' ? '#22C55E' : '#EF4444') : isPre ? colors.text : 'transparent',
                        borderWidth: isPre ? 3 : 1,
                      },
                    ]}
                    onPress={() => handleGrade(g)}
                  >
                    <Text style={styles.gradeLabel}>{s.pcic[g]}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </CardShell>
      </ScrollView>

      <DockedAction
        label={checked ? s.pcic.next(s.pcic[nextGrade]) : `✓ ${s.card.check}`}
        onPress={checked ? () => handleGrade(nextGrade) : handleCheck}
        tone={checked ? 'next' : 'check'}
        color={checked ? '#22C55E' : undefined}
        bottom={dockLift}
        colors={colors}
        onHeight={setDockH}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'flex-start' },
  centered: { justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  back: { fontSize: 22, width: 32 },
  backSpacer: { width: 32 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  cardScroll: { flex: 1, width: '100%' },
  cardScrollContent: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 8 },
  promptBig: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  promptEn: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  input: { width: '100%', borderWidth: 2, borderRadius: 12, padding: 14, fontSize: 18, textAlign: 'center', marginTop: 12 },
  resultSection: { alignItems: 'center', marginTop: 16 },
  diffLine: { fontSize: 20, fontWeight: '700', textAlign: 'center', letterSpacing: 1, marginBottom: 6 },
  diffWrong: { backgroundColor: '#EF4444', color: '#FFFFFF' },
  diffMissing: { backgroundColor: '#EAB308', color: '#FFFFFF', textDecorationLine: 'underline' },
  frontRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  correctAnswer: { flex: 1, flexShrink: 1, fontSize: 22, fontWeight: '600', textAlign: 'center' },
  speakBtn: { padding: 4, flexShrink: 0 },
  speakIcon: { fontSize: 22 },
  youSaidBlock: { marginTop: 12, alignItems: 'center' },
  youSaidLabel: { fontSize: 12, fontWeight: '700' },
  youSaidText: { fontSize: 15, textDecorationLine: 'line-through', opacity: 0.7, marginTop: 2 },
  patternRule: { fontSize: 13, textAlign: 'center', marginTop: 10 },
  gradesRow: { flexDirection: 'row', gap: 8, marginTop: 24, width: '100%' },
  gradeBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  gradeLabel: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  doneBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  doneEmoji: { fontSize: 52 },
  doneTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  btn: { marginTop: 10, alignSelf: 'stretch', paddingVertical: 14, borderRadius: 26, alignItems: 'center' },
  btnTextOnTint: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
