import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { normalizeWordToken } from '@/data/words';
import { getGameDef, gameName } from '@/lib/games/registry';
import { getConfusablesSets, cumulativeCorpusWordIds, type ConfusablesSet } from '@/lib/games/content';
import { buildDrillRound, memberFor, reversePrompt, type ConfusablesDrillRoundItem } from '@/lib/games/confusables';
import { buildGlossMap } from '@/lib/games/gloss';
import { hashString } from '@/lib/shuffle';
import { getGameBest, recordGameResult } from '@/lib/games/scoring';
import { loadVoices, hasVoiceFor, speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import GlossText from '@/components/games/GlossText';
import { useLoadOnMount } from '@/lib/useLoadOnMount';

// GAMES.md 4.12 (F3, confusables): tanító-kártya, aztán vegyes dril.
// K23 DÖNTÉS: a hallás utáni dril csak akkor kerül a körbe, ha az eszköznek
// van hangja a tanult nyelvhez (FB144 guard), így a játék sose akad el.

type Screen = 'sets' | 'teach' | 'drill' | 'summary';

export default function ConfusablesScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const gameDef = getGameDef('confusables')!;

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('hu');

  const [sets, setSets] = useState<ConfusablesSet[]>([]);
  const [best, setBest] = useState(0);
  const [screen, setScreen] = useState<Screen>('sets');
  const [allowListening, setAllowListening] = useState(false);

  const [set, setSet] = useState<ConfusablesSet | null>(null);
  const [round, setRound] = useState<ConfusablesDrillRoundItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    setContentLang(source === 'hu' || source === 'es' || source === 'de' ? source : 'en');

    setSets(getConfusablesSets(target));

    const bestRow = await getGameBest('confusables');
    setBest(bestRow?.bestScore ?? 0);

    await loadVoices();
    setAllowListening(hasVoiceFor(speechLang(target)));
  }, []);

  useLoadOnMount(load);

  const openSet = (st: ConfusablesSet) => {
    setSet(st);
    setScreen('teach');
  };

  const startDrill = () => {
    if (!set) return;
    const seed = hashString(`${set.id}:${Date.now()}`);
    setRound(buildDrillRound(set, { allowListening }, seed));
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setScreen('drill');
  };

  const current = round[index];

  const pick = (word: string) => {
    if (selected !== null || !current) return;
    setSelected(word);
    if (word === current.drill.correct) setCorrectCount((c) => c + 1);
  };

  const next = () => {
    if (!set) return;
    if (index + 1 < round.length) {
      setIndex((i) => i + 1);
      setSelected(null);
      return;
    }
    getDb().setGameProgress('confusables', set.id, 'done', { correct: correctCount, total: round.length }).catch(() => {});
    recordGameResult('confusables', correctCount).then((r) => setBest(r.best));
    setScreen('summary');
  };

  if (sets.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
        </View>
        <View style={styles.emptyBody}>
          <Text style={[styles.emptyText, { color: colors.tabIconDefault }]}>{s.games.confusables.comingSoon}</Text>
        </View>
      </View>
    );
  }

  if (screen === 'sets' || !set) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{gameName(gameDef, contentLang)}</Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>{s.games.confusables.pickSet}</Text>
        <ScrollView contentContainerStyle={styles.list}>
          {sets.map((st) => (
            <Pressable key={st.id} testID="confusables-set" style={[styles.card, { backgroundColor: colors.card }]} onPress={() => openSet(st)}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{st.members.map((m) => m.word).join(' / ')}</Text>
              <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>{s.games.confusables.setMembersLabel(st.members.length)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  const knownIds = cumulativeCorpusWordIds(set.level, learnedLang);
  const overrides = Object.fromEntries([
    ...set.members.map((m) => [normalizeWordToken(m.word), m.gloss] as const),
    ...(set.glossary ?? []).map((g) => [normalizeWordToken(g.word), g.gloss] as const),
  ]);

  if (screen === 'teach') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => setScreen('sets')} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {set.members.map((m) => m.word).join(' / ')}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={styles.playBody}>
          {set.members.map((m) => (
            <View key={m.word} style={[styles.memberCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.memberWord, { color: colors.tint }]}>{m.word}</Text>
              <Text style={[styles.explainText, { color: colors.text }]}>{m.gloss[contentLang] ?? m.gloss.en}</Text>
              {m.hint ? <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{m.hint[contentLang] ?? m.hint.en}</Text> : null}
              {m.examples.map((ex, i) => (
                <GlossText
                  key={i}
                  text={ex}
                  glosses={buildGlossMap(ex, { learnedLang, nativeLang: contentLang, knownWordIds: knownIds, overrides })}
                  learnedLang={learnedLang}
                  style={[styles.example, { color: colors.text }]}
                />
              ))}
            </View>
          ))}
          {set.mnemonic ? (
            <View style={[styles.explainCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.explainHeader, { color: colors.text }]}>🧠</Text>
              <Text style={[styles.explainText, { color: colors.text }]}>{set.mnemonic[contentLang] ?? set.mnemonic.en}</Text>
            </View>
          ) : null}
          <Pressable testID="confusables-start-drill" style={[styles.btn, { backgroundColor: colors.tint }]} onPress={startDrill}>
            <Text style={styles.btnText}>{s.games.confusables.startDrill}</Text>
          </Pressable>
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
          <Pressable style={[styles.btn, styles.btnGhost, styles.summaryBtn, { borderColor: colors.tint }]} onPress={() => setScreen('sets')}>
            <Text style={[styles.btnGhostText, { color: colors.tint }]}>{s.games.backToHub}</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.summaryBtn, { backgroundColor: colors.tint }]} onPress={startDrill}>
            <Text style={styles.btnText}>{s.games.playAgain}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // screen === 'drill'
  const answered = selected !== null;
  const isCorrect = answered && selected === current.drill.correct;
  const correctMember = memberFor(set, current.drill.correct);
  const [before, after] = current.drill.type === 'gap' ? (current.drill.sentence ?? '').split('___') : ['', ''];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('sets')} hitSlop={12}>
          <Text style={[styles.back, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {set.members.map((m) => m.word).join(' / ')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.playBody}>
        <Text style={[styles.progress, { color: colors.tabIconDefault }]}>{s.games.confusables.drillProgress(index + 1, round.length)}</Text>

        <View style={[styles.sentenceCard, { backgroundColor: colors.card }]}>
          {current.drill.type === 'gap' ? (
            <Text style={[styles.sentence, { color: colors.text }]}>
              {before}
              <Text style={{ color: answered ? (isCorrect ? '#22C55E' : '#EF4444') : colors.tint, fontWeight: '700' }}>{answered ? selected : '____'}</Text>
              {after}
            </Text>
          ) : current.drill.type === 'reverse' ? (
            <Text style={[styles.sentence, { color: colors.text }]}>
              {s.games.confusables.reversePrompt} “{reversePrompt(set, current.drill, contentLang)}”
            </Text>
          ) : (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={[styles.sentence, { color: colors.text }]}>{s.games.confusables.listenPrompt}</Text>
              <Pressable
                style={[styles.playBtn, { borderColor: colors.tint }]}
                onPress={() => speak(current.drill.sentence ?? '', speechLang(learnedLang))}
              >
                <Text style={styles.playBtnIcon}>🔊</Text>
              </Pressable>
              <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{s.games.confusables.tapToPlay}</Text>
            </View>
          )}
        </View>

        <View style={styles.options}>
          {current.options.map((opt) => {
            const isPicked = selected === opt;
            const isRightAnswer = opt === current.drill.correct;
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
              <Pressable
                key={opt}
                testID="confusables-option"
                style={[styles.option, { backgroundColor: bg, borderColor: border }]}
                onPress={() => pick(opt)}
                disabled={answered}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>

        {answered ? (
          <View style={[styles.explainCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.explainHeader, { color: isCorrect ? '#22C55E' : '#EF4444' }]}>{isCorrect ? s.games.correctFeedback : s.games.wrongFeedback}</Text>
            {!isCorrect && correctMember ? (
              <View>
                <Text style={[styles.memberWord, { color: colors.tint }]}>{correctMember.word}</Text>
                <Text style={[styles.explainText, { color: colors.text }]}>{correctMember.gloss[contentLang] ?? correctMember.gloss.en}</Text>
                {correctMember.examples[0] ? (
                  <GlossText
                    text={correctMember.examples[0]}
                    glosses={buildGlossMap(correctMember.examples[0], { learnedLang, nativeLang: contentLang, knownWordIds: knownIds, overrides })}
                    learnedLang={learnedLang}
                    style={[styles.example, { color: colors.text }]}
                  />
                ) : null}
              </View>
            ) : null}
            <Pressable style={[styles.btn, { backgroundColor: colors.tint, marginTop: 12 }]} onPress={next}>
              <Text style={styles.btnText}>{s.games.understood}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
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
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
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
  memberCard: { borderRadius: 16, padding: 16, gap: 6 },
  memberWord: { fontSize: 20, fontWeight: '800' },
  hint: { fontSize: 13, fontStyle: 'italic' },
  playBtn: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  playBtnIcon: { fontSize: 28 },
  btn: { paddingVertical: 14, borderRadius: 24, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnGhostText: { fontWeight: '600' },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  summaryTitle: { fontSize: 28, fontWeight: '800' },
  summaryScore: { fontSize: 22, fontWeight: '700' },
  summaryButtons: { flexDirection: 'row', gap: 12 },
  // Kálmán 2026-09-09: a két gomb egyenlő széles, ne a felirat hossza döntse el.
  summaryBtn: { flex: 1 },
});
