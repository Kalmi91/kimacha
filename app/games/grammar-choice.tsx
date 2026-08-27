import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { normalizeWordToken } from '@/data/words';
import { getGameDef, gameName } from '@/lib/games/registry';
import { getGrammarTopics, cumulativeCorpusWordIds, type GrammarTopicData } from '@/lib/games/content';
import { buildGrammarRound, wrongExplanation, type GrammarRoundItem } from '@/lib/games/grammarChoice';
import { buildGlossMap } from '@/lib/games/gloss';
import { hashString } from '@/lib/shuffle';
import { getGameBest, recordGameResult } from '@/lib/games/scoring';
import GlossText from '@/components/games/GlossText';

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
  const [round, setRound] = useState<GrammarRoundItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showMore, setShowMore] = useState(false);
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startTopic = (tp: GrammarTopicData) => {
    const seed = hashString(`${tp.topic}:${Date.now()}`);
    setTopic(tp);
    setRound(buildGrammarRound(tp, seed));
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setShowMore(false);
    setScreen('playing');
  };

  const current = round[index];

  const selectOption = (optIdx: number) => {
    if (selected !== null || !current) return;
    setSelected(optIdx);
    if (optIdx === current.correctIndex) setCorrectCount((c) => c + 1);
  };

  const next = () => {
    if (!topic) return;
    if (index + 1 < round.length) {
      setIndex((i) => i + 1);
      setSelected(null);
      setShowMore(false);
      return;
    }
    getDb().setGameProgress('grammar-choice', topic.topic, 'done', { correct: correctCount, total: round.length }).catch(() => {});
    recordGameResult('grammar-choice', correctCount).then((r) => setBest(r.best));
    setScreen('summary');
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
        <Text style={[styles.summaryScore, { color: colors.tint }]}>{s.games.summaryScore(correctCount, round.length)}</Text>
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

  // screen === 'playing'
  const answered = selected !== null;
  const isCorrect = answered && selected === current.correctIndex;
  const pickedText = answered ? current.options[selected] : undefined;
  const [before, after] = current.item.sentence.split('___');

  const knownIds = cumulativeCorpusWordIds(topic.level, learnedLang);
  const overrides = Object.fromEntries((topic.glossary ?? []).map((g) => [normalizeWordToken(g.word), g.gloss]));

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

      <ScrollView contentContainerStyle={styles.playBody}>
        <Text style={[styles.progress, { color: colors.tabIconDefault }]}>{s.games.grammarChoice.progress(index + 1, round.length)}</Text>

        <View style={[styles.sentenceCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sentence, { color: colors.text }]}>
            {before}
            <Text style={{ color: answered ? (isCorrect ? '#22C55E' : '#EF4444') : colors.tint, fontWeight: '700' }}>
              {answered ? pickedText : '____'}
            </Text>
            {after}
          </Text>
        </View>

        <View style={styles.options}>
          {current.options.map((opt, i) => {
            const isPicked = selected === i;
            const isRightAnswer = i === current.correctIndex;
            let bg = colors.card;
            let border = colors.tabIconDefault;
            if (answered && isRightAnswer) {
              bg = '#22C55E22';
              border = '#22C55E';
            } else if (answered && isPicked && !isRightAnswer) {
              bg = '#EF444422';
              border = '#EF4444';
            }
            return (
              <Pressable key={opt} style={[styles.option, { backgroundColor: bg, borderColor: border }]} onPress={() => selectOption(i)} disabled={answered}>
                <Text style={[styles.optionText, { color: colors.text }]}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>

        {answered ? (
          <View style={[styles.explainCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.explainHeader, { color: isCorrect ? '#22C55E' : '#EF4444' }]}>
              {isCorrect ? s.games.correctFeedback : s.games.wrongFeedback}
            </Text>
            <Text style={[styles.explainText, { color: colors.text }]}>{current.item.why[contentLang] ?? current.item.why.en}</Text>
            {!isCorrect && pickedText !== undefined ? (
              <Text style={[styles.explainText, { color: colors.tabIconDefault }]}>{wrongExplanation(current.item, pickedText, contentLang) ?? ''}</Text>
            ) : null}
            {current.item.examples.map((ex, i) => (
              <GlossText
                key={i}
                text={ex}
                glosses={buildGlossMap(ex, { learnedLang, nativeLang: contentLang, knownWordIds: knownIds, overrides })}
                learnedLang={learnedLang}
                style={[styles.example, { color: colors.text }]}
              />
            ))}
            {topic.more ? (
              <View>
                <Pressable onPress={() => setShowMore((v) => !v)}>
                  <Text style={[styles.moreToggle, { color: colors.tint }]}>{showMore ? `▾ ${s.games.moreLabel}` : `▸ ${s.games.moreLabel}`}</Text>
                </Pressable>
                {showMore ? <Text style={[styles.explainText, { color: colors.tabIconDefault }]}>{topic.more[contentLang] ?? topic.more.en}</Text> : null}
              </View>
            ) : null}
            <Pressable style={[styles.btn, { backgroundColor: colors.tint, marginTop: 12 }]} onPress={next}>
              <Text style={styles.btnText}>{s.games.understood}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

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
