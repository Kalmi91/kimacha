import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useLoadOnMount } from '@/lib/useLoadOnMount';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { normalizeWordToken } from '@/data/words';
import { getGameDef, gameName } from '@/lib/games/registry';
import { getStories, cumulativeCorpusWordIds, type StoryData, type StoryTrack } from '@/lib/games/content';
import { getTalkStory } from '@/lib/talk/packs';
import { collectNewWords, shuffledQuestionOptions } from '@/lib/games/story';
import { buildGlossMap } from '@/lib/games/gloss';
import { hashString } from '@/lib/shuffle';
import { getGameBest, recordGameResult } from '@/lib/games/scoring';
import { loadVoices, hasVoiceFor, speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import GlossText from '@/components/games/GlossText';
import GameSettingsSheet, { type SettingField } from '@/components/games/GameSettingsSheet';

// GAMES.md 4.5 (F4, story): jelenetenkénti olvasás + könnyű megértés-kérdés
// (K12), a fordítás/betűméret/felolvasás beállítható (4.5 "Beállítás"), a
// sztori végén a "ezeket tanultad" recap CSAK olvasható lista (K3: a játék
// nem ír a cards táblába, a régi 4.5-ös "SRS insert" gomb-ötletet a K3
// DÖNTÉS felülírja). A jelenet szövege és a kérdés is a görgetőn belül
// marad látható, tehát "a jelenet újraolvasható" (K12) triviálisan igaz,
// nincs külön reread-mechanizmus.

type Screen = 'list' | 'reading' | 'summary';
type TranslationMode = 'never' | 'tap' | 'always';
type FontSize = 'small' | 'normal' | 'large';

const TRACKS: StoryTrack[] = ['cdmx', 'crime', 'scifi'];
const FONT_SIZES: Record<FontSize, number> = { small: 16, normal: 19, large: 23 };

export default function StoryScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const gameDef = getGameDef('story')!;
  // Átbeszélő fül: a `talk` paraméterrel EGY konkrét pakk-sztorija nyílik meg,
  // lista nélkül. A Game fül felől a paraméter hiányzik, ott minden a régi.
  const { talk } = useLocalSearchParams<{ talk?: string }>();
  const autoOpened = useRef(false);

  const [learnedLang, setLearnedLang] = useState('es');
  const [contentLang, setContentLang] = useState('hu');

  const [stories, setStories] = useState<StoryData[]>([]);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [best, setBest] = useState(0);
  const [screen, setScreen] = useState<Screen>('list');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [fontSize, setFontSize] = useState<FontSize>('normal');
  const [translationMode, setTranslationMode] = useState<TranslationMode>('tap');
  const [speechOn, setSpeechOn] = useState(true);
  const [canSpeak, setCanSpeak] = useState(false);

  const [story, setStory] = useState<StoryData | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [translationShown, setTranslationShown] = useState(false);
  const [answered, setAnswered] = useState<string | null>(null); // the picked option's own text
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredScenes, setAnsweredScenes] = useState(0);

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    const target = onboarding?.target ?? 'es';
    setLearnedLang(target);
    setContentLang(source === 'hu' || source === 'es' || source === 'de' ? source : 'en');

    if (talk) {
      const only = getTalkStory(target, talk);
      setStories(only ? [only] : []);
    } else {
      setStories(getStories(target));
    }

    const progress = await db.getGameProgress('story');
    setDoneIds(new Set(progress.filter((p) => p.state === 'done').map((p) => p.itemId)));

    const bestRow = await getGameBest('story');
    setBest(bestRow?.bestScore ?? 0);

    const saved = await db.getGameSettings('story');
    if (saved) {
      if (saved.fontSize === 'small' || saved.fontSize === 'normal' || saved.fontSize === 'large') {
        setFontSize(saved.fontSize);
      }
      if (saved.translationMode === 'never' || saved.translationMode === 'tap' || saved.translationMode === 'always') {
        setTranslationMode(saved.translationMode);
      }
      if (typeof saved.speechOn === 'boolean') setSpeechOn(saved.speechOn);
    }

    await loadVoices();
    setCanSpeak(hasVoiceFor(speechLang(target)));
  }, [talk]);

  useLoadOnMount(load);

  const saveSettings = (next: { fontSize: FontSize; translationMode: TranslationMode; speechOn: boolean }) => {
    getDb().setGameSettings('story', next).catch(() => {});
  };

  const onSettingChange = (key: string, value: string | number | boolean) => {
    if (key === 'fontSize') {
      const v = value as FontSize;
      setFontSize(v);
      saveSettings({ fontSize: v, translationMode, speechOn });
    } else if (key === 'translationMode') {
      const v = value as TranslationMode;
      setTranslationMode(v);
      saveSettings({ fontSize, translationMode: v, speechOn });
    } else if (key === 'speechOn') {
      setSpeechOn(!!value);
      saveSettings({ fontSize, translationMode, speechOn: !!value });
    }
  };

  const settingsFields: SettingField[] = useMemo(
    () => [
      {
        key: 'fontSize',
        type: 'select',
        label: s.games.story.settingsFontSize,
        options: [
          { value: 'small', label: s.games.story.fontSmall },
          { value: 'normal', label: s.games.story.fontNormal },
          { value: 'large', label: s.games.story.fontLarge },
        ],
      },
      {
        key: 'translationMode',
        type: 'select',
        label: s.games.story.settingsTranslation,
        options: [
          { value: 'never', label: s.games.story.translationNever },
          { value: 'tap', label: s.games.story.translationTap },
          { value: 'always', label: s.games.story.translationAlways },
        ],
      },
      { key: 'speechOn', type: 'toggle', label: s.games.story.settingsSpeech },
    ],
    [s]
  );

  const openStory = (st: StoryData) => {
    setStory(st);
    setSceneIndex(0);
    setTranslationShown(translationMode === 'always');
    setAnswered(null);
    setCorrectCount(0);
    setAnsweredScenes(0);
    setScreen('reading');
  };

  // Az Átbeszélőből érkezve rögtön az olvasásnál kezdünk, de csak egyszer:
  // a sztori végén a lista/összegzés képernyő maradjon elérhető.
  useEffect(() => {
    if (!talk || autoOpened.current || stories.length !== 1) return;
    autoOpened.current = true;
    openStory(stories[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talk, stories]);

  const scene = story?.scenes[sceneIndex];

  useEffect(() => {
    if (screen !== 'reading' || !scene || !canSpeak || !speechOn) return;
    const text = scene.text[learnedLang] ?? Object.values(scene.text)[0];
    if (text) speak(text, speechLang(learnedLang));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, scene?.id, canSpeak, speechOn]);

  const questionRound = useMemo(() => {
    if (!scene) return null;
    return shuffledQuestionOptions(scene, hashString(`${story?.id}:${scene.id}`));
  }, [scene, story?.id]);

  const pickAnswer = (optText: string, isCorrect: boolean) => {
    if (answered !== null) return;
    setAnswered(optText);
    setAnsweredScenes((n) => n + 1);
    if (isCorrect) setCorrectCount((c) => c + 1);
  };

  const nextScene = () => {
    if (!story) return;
    if (sceneIndex + 1 < story.scenes.length) {
      setSceneIndex((i) => i + 1);
      setTranslationShown(translationMode === 'always');
      setAnswered(null);
      return;
    }
    getDb()
      .setGameProgress('story', story.id, 'done', { correct: correctCount, total: answeredScenes })
      .catch(() => {});
    recordGameResult('story', correctCount).then((r) => setBest(r.best));
    setDoneIds((prev) => new Set(prev).add(story.id));
    setScreen('summary');
  };

  const storiesByTrack = useMemo(() => {
    const map = new Map<StoryTrack, StoryData[]>();
    for (const tr of TRACKS) map.set(tr, []);
    for (const st of stories) map.get(st.track)?.push(st);
    return map;
  }, [stories]);

  if (stories.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.text }]}>←</Text>
          </Pressable>
        </View>
        <View style={styles.emptyBody}>
          <Text style={[styles.emptyText, { color: colors.tabIconDefault }]}>{s.games.story.comingSoon}</Text>
        </View>
      </View>
    );
  }

  if (screen === 'list' || !story) {
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
        <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>{s.games.story.pickStory}</Text>
        <ScrollView contentContainerStyle={styles.list}>
          {TRACKS.map((tr) => {
            const items = storiesByTrack.get(tr) ?? [];
            if (items.length === 0) return null;
            return (
              <View key={tr} style={styles.trackSection}>
                <Text style={[styles.trackHeader, { color: colors.text }]}>{s.games.story[`track_${tr}` as 'track_cdmx']}</Text>
                <View style={styles.cardRow}>
                  {items.map((st) => (
                    <Pressable key={st.id} testID="story-card" style={[styles.card, { backgroundColor: colors.card }]} onPress={() => openStory(st)}>
                      <Text style={styles.cardCover}>{st.cover}</Text>
                      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                        {st.title[contentLang] ?? st.title.en}
                      </Text>
                      <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>
                        {st.level} · {s.games.story.estMinutes(st.estMinutes)}
                      </Text>
                      {doneIds.has(st.id) ? <Text style={styles.cardDone}>✓</Text> : null}
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <GameSettingsSheet
          visible={settingsOpen}
          title={s.games.settings}
          fields={settingsFields}
          values={{ fontSize, translationMode, speechOn }}
          onChange={onSettingChange}
          onClose={() => setSettingsOpen(false)}
        />
      </View>
    );
  }

  if (screen === 'summary') {
    const learned = collectNewWords(story);
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.summaryBody}>
          <Text style={styles.startEmoji}>{story.cover}</Text>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>{s.games.story.finishTitle}</Text>
          {answeredScenes > 0 ? (
            <Text style={[styles.cardSub, { color: colors.tint }]}>{s.games.summaryScore(correctCount, answeredScenes)}</Text>
          ) : null}
          <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>
            {s.games.best}: {best}
          </Text>

          <View style={styles.learnedBox}>
            <Text style={[styles.learnedHeader, { color: colors.text }]}>{s.games.story.learnedWordsHeader}</Text>
            {learned.length === 0 ? (
              <Text style={[styles.cardSub, { color: colors.tabIconDefault }]}>{s.games.story.noNewWords}</Text>
            ) : (
              learned.map((w) => (
                <View key={w.word} style={[styles.learnedRow, { borderColor: colors.tabIconDefault }]}>
                  <Text style={[styles.learnedWord, { color: colors.tint }]}>{w.word}</Text>
                  <Text style={[styles.learnedGloss, { color: colors.text }]}>{w.gloss[contentLang] ?? Object.values(w.gloss)[0]}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.summaryButtons}>
            <Pressable style={[styles.btn, styles.btnGhost, styles.summaryBtn, { borderColor: colors.tint }]} onPress={() => setScreen('list')}>
              <Text style={[styles.btnGhostText, { color: colors.tint }]}>{s.games.backToHub}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.summaryBtn, { backgroundColor: colors.tint }]} onPress={() => openStory(story)}>
              <Text style={styles.btnText}>{s.games.playAgain}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // screen === 'reading'
  if (!scene) return null;
  const knownIds = cumulativeCorpusWordIds(story.level, learnedLang);
  const overrides = Object.fromEntries(
    story.scenes.flatMap((sc) => sc.newWords ?? []).map((nw) => [normalizeWordToken(nw.word), nw.gloss])
  );
  const sceneText = scene.text[learnedLang] ?? Object.values(scene.text)[0];
  const translationText = scene.translation?.[contentLang] ?? (scene.translation ? Object.values(scene.translation)[0] : undefined);
  const isAnswered = answered !== null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('list')} hitSlop={12}>
          <Text style={[styles.back, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.progress, { color: colors.text }]}>
          {s.games.story.sceneOf(sceneIndex + 1, story.scenes.length)}
        </Text>
        <Pressable onPress={() => scene && speak(sceneText ?? '', speechLang(learnedLang))} hitSlop={12}>
          <Text style={styles.gearBtnText}>🔊</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.readBody}>
        <View style={[styles.sceneCard, { backgroundColor: colors.card }]}>
          <GlossText
            text={sceneText ?? ''}
            glosses={buildGlossMap(sceneText ?? '', { learnedLang, nativeLang: contentLang, knownWordIds: knownIds, overrides })}
            learnedLang={learnedLang}
            style={[styles.sceneText, { color: colors.text, fontSize: FONT_SIZES[fontSize], lineHeight: FONT_SIZES[fontSize] * 1.4 }]}
          />
          {translationMode === 'tap' && !translationShown ? (
            <Pressable onPress={() => setTranslationShown(true)}>
              <Text style={[styles.showTranslation, { color: colors.tint }]}>{s.games.story.showTranslation}</Text>
            </Pressable>
          ) : null}
          {(translationMode === 'always' || (translationMode === 'tap' && translationShown)) && translationText ? (
            <Text style={[styles.translationText, { color: colors.tabIconDefault }]}>{translationText}</Text>
          ) : null}
        </View>

        {questionRound && scene.question ? (
          <View style={[styles.questionCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.questionPrompt, { color: colors.text }]}>
              {scene.question.prompt[contentLang] ?? Object.values(scene.question.prompt)[0]}
            </Text>
            {questionRound.options.map((opt, i) => {
              const optText = (opt[learnedLang] as string) ?? (Object.entries(opt).find(([k]) => k !== 'correct')?.[1] as string);
              const isCorrectOpt = i === questionRound.correctIndex;
              const isPicked = answered === optText;
              let bg = colors.background;
              let border = colors.tabIconDefault;
              if (isAnswered && isCorrectOpt) {
                bg = '#22C55E22';
                border = '#22C55E';
              } else if (isAnswered && isPicked && !isCorrectOpt) {
                bg = '#EF444422';
                border = '#EF4444';
              }
              return (
                <Pressable
                  key={optText + i}
                  testID="story-option"
                  style={[styles.optionBtn, { backgroundColor: bg, borderColor: border }]}
                  onPress={() => pickAnswer(optText, isCorrectOpt)}
                  disabled={isAnswered}
                >
                  <Text style={[styles.optionText, { color: colors.text }]}>{optText}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Pressable
          testID="story-continue"
          style={[styles.btn, { backgroundColor: colors.tint, opacity: scene.question && !isAnswered ? 0.5 : 1 }]}
          onPress={nextScene}
          disabled={!!scene.question && !isAnswered}
        >
          <Text style={styles.btnText}>{s.games.story.continueBtn}</Text>
        </Pressable>
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
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 4 },
  gearBtnText: { fontSize: 20 },
  emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  list: { padding: 16, gap: 20 },
  trackSection: { gap: 8 },
  trackHeader: { fontSize: 16, fontWeight: '700' },
  cardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47%', borderRadius: 16, padding: 14, gap: 4 },
  cardCover: { fontSize: 32 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  cardSub: { fontSize: 12 },
  cardDone: { position: 'absolute', top: 10, right: 10, fontSize: 16, color: '#22C55E', fontWeight: '800' },
  startEmoji: { fontSize: 48 },
  progress: { fontSize: 15, fontWeight: '600' },
  readBody: { padding: 16, gap: 16, paddingBottom: 48 },
  sceneCard: { borderRadius: 16, padding: 20, gap: 12 },
  sceneText: { fontWeight: '500' },
  showTranslation: { fontSize: 13, fontWeight: '600' },
  translationText: { fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  questionCard: { borderRadius: 16, padding: 16, gap: 10 },
  questionPrompt: { fontSize: 15, fontWeight: '700' },
  optionBtn: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  optionText: { fontSize: 15 },
  btn: { paddingVertical: 14, borderRadius: 24, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnGhostText: { fontWeight: '600' },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  summaryBody: { padding: 24, alignItems: 'center', gap: 10 },
  summaryTitle: { fontSize: 26, fontWeight: '800' },
  summaryButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  // Kálmán 2026-09-09: a két gomb egyenlő széles, ne a felirat hossza döntse el.
  summaryBtn: { flex: 1 },
  learnedBox: { width: '100%', gap: 8, marginTop: 12 },
  learnedHeader: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  learnedRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8, gap: 8 },
  learnedWord: { fontSize: 15, fontWeight: '700' },
  learnedGloss: { fontSize: 14, flexShrink: 1, textAlign: 'right' },
});
