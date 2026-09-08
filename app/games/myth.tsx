import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { normalizeWordToken } from '@/data/words';
import { getGameDef, gameName } from '@/lib/games/registry';
import { getMyths, cumulativeCorpusWordIds, type MythItem, type MythTrack } from '@/lib/games/content';
import { buildMythRound } from '@/lib/games/myth';
import { buildGlossMap } from '@/lib/games/gloss';
import { hashString } from '@/lib/shuffle';
import { getGameBest, recordGameResult } from '@/lib/games/scoring';
import GlossText from '@/components/games/GlossText';
import GameSettingsSheet, { type SettingField } from '@/components/games/GameSettingsSheet';

// GAMES.md 4.13 (F4, myth): "Igaz vagy kamu?" K26 DÖNTÉS: mind a négy sáv
// bekapcsolható, sávonként 15 item. K25 DÖNTÉS: a magyarázat forrásnyelven
// (fixen, nincs "tanult nyelven" váltó, a spec 4.13 "Beállítás" mondata ebben
// a pontban a K25 döntés alatt áll). A sorozat-számláló (streak) ÉLŐ, a kör
// leghosszabb sorozata a rekord (game_scores 'myth'), ez a visszatérés-motor.

type Screen = 'start' | 'playing' | 'summary';
type Guess = 'true' | 'myth';

const ALL_TRACKS: MythTrack[] = ['common', 'body', 'mexico', 'language'];
const TRACK_SETTING_KEY: Record<MythTrack, string> = {
  common: 'trackCommon',
  body: 'trackBody',
  mexico: 'trackMexico',
  language: 'trackLanguage',
};

interface Answer {
  item: MythItem;
  guess: Guess;
  correct: boolean;
}

export default function MythScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const gameDef = getGameDef('myth')!;

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('hu');

  const [allItems, setAllItems] = useState<MythItem[]>([]);
  const [best, setBest] = useState(0);
  const [screen, setScreen] = useState<Screen>('start');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [tracks, setTracks] = useState<Record<MythTrack, boolean>>({
    common: true,
    body: true,
    mexico: true,
    language: true,
  });
  const [length, setLength] = useState<string>('10');

  const [round, setRound] = useState<MythItem[]>([]);
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    setContentLang(source === 'hu' || source === 'es' || source === 'de' ? source : 'en');

    setAllItems(getMyths(target));

    const bestRow = await getGameBest('myth');
    setBest(bestRow?.bestScore ?? 0);

    const saved = await db.getGameSettings('myth');
    if (saved) {
      setTracks({
        common: saved.trackCommon !== false,
        body: saved.trackBody !== false,
        mexico: saved.trackMexico !== false,
        language: saved.trackLanguage !== false,
      });
      if (typeof saved.length === 'string') setLength(saved.length);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = (nextTracks: Record<MythTrack, boolean>, nextLength: string) => {
    getDb()
      .setGameSettings('myth', {
        trackCommon: nextTracks.common,
        trackBody: nextTracks.body,
        trackMexico: nextTracks.mexico,
        trackLanguage: nextTracks.language,
        length: nextLength,
      })
      .catch(() => {});
  };

  const onSettingChange = (key: string, value: string | number | boolean) => {
    if (key === 'length') {
      setLength(String(value));
      saveSettings(tracks, String(value));
      return;
    }
    const track = (Object.keys(TRACK_SETTING_KEY) as MythTrack[]).find((tr) => TRACK_SETTING_KEY[tr] === key);
    if (!track) return;
    const next = { ...tracks, [track]: !!value };
    setTracks(next);
    saveSettings(next, length);
  };

  const settingsFields: SettingField[] = useMemo(
    () => [
      ...ALL_TRACKS.map((tr) => ({ key: TRACK_SETTING_KEY[tr], type: 'toggle' as const, label: s.games.myth[TRACK_SETTING_KEY[tr] as 'trackCommon'] })),
      {
        key: 'length',
        type: 'select' as const,
        label: s.games.myth.lengthLabel,
        options: [
          { value: '10', label: '10' },
          { value: '20', label: '20' },
          { value: 'endless', label: s.games.myth.lengthEndless },
        ],
      },
    ],
    [s]
  );

  const startRun = () => {
    const enabledTracks = ALL_TRACKS.filter((tr) => tracks[tr]);
    const seed = hashString(`myth:${Date.now()}`);
    const roundLength = length === 'endless' ? undefined : Number(length);
    const built = buildMythRound(allItems, enabledTracks, roundLength, seed);
    setRound(built);
    setIndex(0);
    setGuess(null);
    setAnswers([]);
    setStreak(0);
    setLongestStreak(0);
    setScreen('playing');
  };

  const current = round[index];

  const answer = (g: Guess) => {
    if (guess !== null || !current) return;
    setGuess(g);
    const correct = g === current.verdict;
    setAnswers((a) => [...a, { item: current, guess: g, correct }]);
    setStreak((prev) => {
      const next = correct ? prev + 1 : 0;
      setLongestStreak((best2) => Math.max(best2, next));
      return next;
    });
  };

  const next = () => {
    if (index + 1 < round.length) {
      setIndex((i) => i + 1);
      setGuess(null);
      return;
    }
    recordGameResult('myth', longestStreak).then((r) => setBest(r.best));
    setScreen('summary');
  };

  if (allItems.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyHeader}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
        </View>
        <View style={styles.emptyBody}>
          <Text style={[styles.emptyText, { color: colors.tabIconDefault }]}>{s.games.myth.comingSoon}</Text>
        </View>
      </View>
    );
  }

  if (screen === 'start') {
    const anyTrackEnabled = ALL_TRACKS.some((tr) => tracks[tr]);
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{gameName(gameDef, contentLang)}</Text>
          <Pressable onPress={() => setSettingsOpen(true)} hitSlop={12}>
            <Text style={[styles.gearBtnText, { color: colors.tint }]}>⚙️</Text>
          </Pressable>
        </View>
        <View style={styles.startBody}>
          <Text style={styles.startEmoji}>{gameDef.icon}</Text>
          <Text style={[styles.startIntro, { color: colors.text }]}>{s.games.myth.intro}</Text>
          <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>
            {s.games.best}: {best}
          </Text>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.tint, opacity: anyTrackEnabled ? 1 : 0.5 }]}
            onPress={startRun}
            disabled={!anyTrackEnabled}
          >
            <Text style={styles.btnText}>{s.games.go}</Text>
          </Pressable>
          {!anyTrackEnabled ? <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>{s.games.myth.noTracksHint}</Text> : null}
        </View>

        <GameSettingsSheet
          visible={settingsOpen}
          title={s.games.settings}
          fields={settingsFields}
          values={{
            trackCommon: tracks.common,
            trackBody: tracks.body,
            trackMexico: tracks.mexico,
            trackLanguage: tracks.language,
            length,
          }}
          onChange={onSettingChange}
          onClose={() => setSettingsOpen(false)}
        />
      </View>
    );
  }

  if (screen === 'summary') {
    const correctCount = answers.filter((a) => a.correct).length;
    const wrong = answers.filter((a) => !a.correct);
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.summaryBody}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>{s.games.summaryTitle}</Text>
          <Text style={[styles.summaryScore, { color: colors.tint }]}>{s.games.summaryScore(correctCount, answers.length)}</Text>
          <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>{s.games.myth.longestStreak(longestStreak)}</Text>
          <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>
            {s.games.best}: {best}
          </Text>
          {wrong.length > 0 ? (
            <View style={styles.wrongList}>
              <Text style={[styles.wrongHeader, { color: colors.text }]}>{s.games.myth.wrongListHeader}</Text>
              {wrong.map((a) => (
                <View key={a.item.id} style={[styles.wrongCard, { backgroundColor: colors.card }]}>
                  <Text style={[styles.wrongClaim, { color: colors.text }]}>{a.item.claim[learnedLang] ?? Object.values(a.item.claim)[0]}</Text>
                  <Text style={[styles.wrongVerdict, { color: a.item.verdict === 'myth' ? '#EF4444' : '#22C55E' }]}>
                    {a.item.verdict === 'myth' ? s.games.myth.verdictMyth : s.games.myth.verdictTrue}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.summaryButtons}>
            <Pressable style={[styles.btn, styles.btnGhost, { borderColor: colors.tint }]} onPress={() => setScreen('start')}>
              <Text style={[styles.btnGhostText, { color: colors.tint }]}>{s.games.backToHub}</Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: colors.tint }]} onPress={startRun}>
              <Text style={styles.btnText}>{s.games.playAgain}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // screen === 'playing'
  if (!current) return null;
  const answered = guess !== null;
  const isCorrect = answered && guess === current.verdict;
  const knownIds = cumulativeCorpusWordIds(current.level, learnedLang);
  const overrides = Object.fromEntries((current.gloss ?? []).map((g) => [normalizeWordToken(g.word), g]));
  const claimText = current.claim[learnedLang] ?? Object.values(current.claim)[0];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('start')} hitSlop={12}>
          <Text style={[styles.back, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.progress, { color: colors.text }]}>{s.games.grammarChoice.progress(index + 1, round.length)}</Text>
        <Text style={[styles.streak, { color: colors.tint }]}>{s.games.myth.streak(streak)}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.playBody}>
        <View style={[styles.claimCard, { backgroundColor: colors.card }]}>
          <GlossText
            text={claimText}
            glosses={buildGlossMap(claimText, { learnedLang, nativeLang: contentLang, knownWordIds: knownIds, overrides })}
            learnedLang={learnedLang}
            style={[styles.claimText, { color: colors.text }]}
          />
        </View>

        {!answered ? (
          <View style={styles.guessButtons}>
            <Pressable testID="myth-true" style={[styles.guessBtn, { backgroundColor: '#22C55E' }]} onPress={() => answer('true')}>
              <Text style={styles.guessBtnText}>{s.games.myth.trueBtn}</Text>
            </Pressable>
            <Pressable testID="myth-myth" style={[styles.guessBtn, { backgroundColor: '#EF4444' }]} onPress={() => answer('myth')}>
              <Text style={styles.guessBtnText}>{s.games.myth.mythBtn}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.explainCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.explainHeader, { color: isCorrect ? '#22C55E' : '#EF4444' }]}>
              {isCorrect ? s.games.correctFeedback : s.games.wrongFeedback}
            </Text>
            <Text style={[styles.verdictLine, { color: colors.text }]}>
              {current.verdict === 'myth' ? s.games.myth.verdictMyth : s.games.myth.verdictTrue}
            </Text>
            <Text style={[styles.explainText, { color: colors.text }]}>{current.explanation[contentLang] ?? current.explanation.en}</Text>
            <Pressable onPress={() => current.source.url && Linking.openURL(current.source.url)} disabled={!current.source.url}>
              <Text style={[styles.sourceLine, { color: colors.tabIconDefault }]}>
                {s.games.myth.sourceLabel} {current.source.label}
              </Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: colors.tint, marginTop: 12 }]} onPress={next}>
              <Text style={styles.btnText}>{s.games.understood}</Text>
            </Pressable>
          </View>
        )}
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
  gearBtnText: { fontSize: 20 },
  emptyHeader: { paddingHorizontal: 16, paddingTop: 8 },
  emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  startBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  startEmoji: { fontSize: 56 },
  startIntro: { fontSize: 16, textAlign: 'center', lineHeight: 22 },
  cardSub: { fontSize: 13, textAlign: 'center' },
  progress: { fontSize: 15, fontWeight: '600' },
  streak: { fontSize: 15, fontWeight: '700' },
  playBody: { padding: 16, gap: 16 },
  claimCard: { borderRadius: 16, padding: 24, minHeight: 140, justifyContent: 'center' },
  claimText: { fontSize: 20, lineHeight: 28, textAlign: 'center', fontWeight: '600' },
  guessButtons: { flexDirection: 'row', gap: 12 },
  guessBtn: { flex: 1, paddingVertical: 22, borderRadius: 18, alignItems: 'center' },
  guessBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 20 },
  explainCard: { borderRadius: 16, padding: 16, gap: 8 },
  explainHeader: { fontSize: 16, fontWeight: '700' },
  verdictLine: { fontSize: 17, fontWeight: '700' },
  explainText: { fontSize: 14, lineHeight: 20 },
  sourceLine: { fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  btn: { paddingVertical: 14, borderRadius: 24, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnGhostText: { fontWeight: '600' },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  summaryBody: { padding: 24, alignItems: 'center', gap: 12 },
  summaryTitle: { fontSize: 28, fontWeight: '800' },
  summaryScore: { fontSize: 22, fontWeight: '700' },
  summaryButtons: { flexDirection: 'row', gap: 12, marginTop: 12 },
  wrongList: { width: '100%', gap: 8, marginTop: 12 },
  wrongHeader: { fontSize: 15, fontWeight: '700' },
  wrongCard: { borderRadius: 12, padding: 12, gap: 4 },
  wrongClaim: { fontSize: 14 },
  wrongVerdict: { fontSize: 13, fontWeight: '700' },
});
