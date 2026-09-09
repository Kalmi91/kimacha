import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { getGameDef, gameName } from '@/lib/games/registry';
import { getGrammarTopics, type GrammarTopicData } from '@/lib/games/content';
import { getGameBest, recordGameResult } from '@/lib/games/scoring';
import GrammarDrill from '@/components/grammar/GrammarDrill';

// GAMES.md 4.11 (F3, grammar-choice): "Melyik a helyes?" plusz magyarázat.
// K21 DÖNTÉS: a magyarázat szabály + 2 példa + miért rossz a többi opció, a
// kivételek/határesetek egy külön, összecsukott "Több" blokkban (topic.more),
// bármikor elérhető a fejléc "Szabály" gombjával (nem csak per-item), ez a
// "visszanézhető szabály-lista" olcsóbb, egyenértékű megvalósítása.
// K20/SCOPE-DÖNTÉS: 3 topic tartalommal (ser-estar, articulos-genero, por-para),
// a motor mind az 59 témát elbírja, új téma = egy JSON-fájl.

type Screen = 'topics' | 'playing' | 'summary';

export default function GrammarChoiceScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const gameDef = getGameDef('grammar-choice')!;

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('hu');

  const [topics, setTopics] = useState<GrammarTopicData[]>([]);
  const [best, setBest] = useState(0);
  const [screen, setScreen] = useState<Screen>('topics');

  const [topic, setTopic] = useState<GrammarTopicData | null>(null);
  const [runKey, setRunKey] = useState(0); // remounts the drill for a fresh run
  const [correctCount, setCorrectCount] = useState(0);
  const [roundLength, setRoundLength] = useState(0);
  const [ruleOpen, setRuleOpen] = useState(false);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    setContentLang(source === 'hu' || source === 'es' || source === 'de' ? source : 'en');

    setTopics(getGrammarTopics(target));

    const bestRow = await getGameBest('grammar-choice');
    setBest(bestRow?.bestScore ?? 0);
    // setBest is listed because the React Compiler infers it as a dependency of
    // this async callback; it is stable, so nothing changes at runtime, but an
    // empty array here counts as broken memoization.
  }, [setBest]);

  useEffect(() => {
    load();
  }, [load]);

  const startTopic = (tp: GrammarTopicData) => {
    setTopic(tp);
    setRunKey((k) => k + 1);
    setCorrectCount(0);
    setRoundLength(0);
    setScreen('playing');
  };

  if (topics.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyHeader}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
        </View>
        <View style={styles.emptyBody}>
          <Text style={[styles.emptyText, { color: colors.tabIconDefault }]}>{s.games.grammarChoice.comingSoon}</Text>
        </View>
      </View>
    );
  }

  if (screen === 'topics' || !topic) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{gameName(gameDef, contentLang)}</Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>{s.games.grammarChoice.pickTopic}</Text>
        <ScrollView contentContainerStyle={styles.list}>
          {topics.map((tp) => (
            <Pressable key={tp.topic} style={[styles.card, { backgroundColor: colors.card }]} onPress={() => startTopic(tp)}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{tp.title[contentLang] ?? tp.title.en}</Text>
              <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>{s.games.grammarChoice.topicItemCount(tp.items.length)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (screen === 'summary') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 16 }]}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>{s.games.summaryTitle}</Text>
        <Text style={[styles.summaryScore, { color: colors.tint }]}>{s.games.summaryScore(correctCount, roundLength)}</Text>
        <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>
          {s.games.best}: {best}
        </Text>
        <View style={styles.summaryButtons}>
          <Pressable style={[styles.btn, styles.btnGhost, { borderColor: colors.tint }]} onPress={() => setScreen('topics')}>
            <Text style={[styles.btnGhostText, { color: colors.tint }]}>{s.games.backToHub}</Text>
          </Pressable>
          <Pressable style={[styles.btn, { backgroundColor: colors.tint }]} onPress={() => startTopic(topic)}>
            <Text style={styles.btnText}>{s.games.playAgain}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // screen === 'playing': the drill itself is components/grammar/GrammarDrill,
  // shared with the grammar course (app/grammar/[topic].tsx) so the "explain
  // every answer" behaviour has one implementation, not two.
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('topics')} hitSlop={12}>
          <Text style={[styles.back, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {topic.title[contentLang] ?? topic.title.en}
        </Text>
        <Pressable onPress={() => setRuleOpen(true)} hitSlop={12}>
          <Text style={[styles.ruleBtnText, { color: colors.tint }]}>📋</Text>
        </Pressable>
      </View>

      <GrammarDrill
        key={runKey}
        topic={topic}
        learnedLang={learnedLang}
        contentLang={contentLang}
        onFinish={(correct, total) => {
          setCorrectCount(correct);
          setRoundLength(total);
          getDb().setGameProgress('grammar-choice', topic.topic, 'done', { correct, total }).catch(() => {});
          recordGameResult('grammar-choice', correct).then((r) => setBest(r.best));
          setScreen('summary');
        }}
      />

      <Modal visible={ruleOpen} transparent animationType="fade" onRequestClose={() => setRuleOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setRuleOpen(false)}>
          <Pressable style={[styles.ruleModal, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.explainHeader, { color: colors.text }]}>{s.games.ruleButton}</Text>
            <Text style={[styles.explainText, { color: colors.text }]}>{topic.rule[contentLang] ?? topic.rule.en}</Text>
            {topic.more ? <Text style={[styles.explainText, { color: colors.tabIconDefault, marginTop: 8 }]}>{topic.more[contentLang] ?? topic.more.en}</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  back: { fontSize: 22 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  ruleBtnText: { fontSize: 20 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
  emptyHeader: { paddingHorizontal: 16, paddingTop: 8 },
  emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 16, padding: 16, gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardSub: { fontSize: 13 },
  playBody: { padding: 16, gap: 12 },
  progress: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  sentenceCard: { borderRadius: 16, padding: 20 },
  sentence: { fontSize: 20, lineHeight: 28, textAlign: 'center' },
  options: { gap: 10 },
  option: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  optionText: { fontSize: 17, fontWeight: '600' },
  explainCard: { borderRadius: 16, padding: 16, gap: 8 },
  explainHeader: { fontSize: 16, fontWeight: '700' },
  explainText: { fontSize: 14, lineHeight: 20 },
  example: { fontSize: 14, fontStyle: 'italic' },
  moreToggle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  btn: { paddingVertical: 14, borderRadius: 24, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnGhostText: { fontWeight: '600' },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  summaryTitle: { fontSize: 28, fontWeight: '800' },
  summaryScore: { fontSize: 22, fontWeight: '700' },
  summaryButtons: { flexDirection: 'row', gap: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  ruleModal: { borderRadius: 20, padding: 24, gap: 12, width: '100%', maxWidth: 400 },
});
