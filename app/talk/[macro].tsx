import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { getTopicName } from '@/data/topics';
import type { Level } from '@/data/words';
import {
  TALK_LEVELS,
  getMacro,
  macroName,
  macroWords,
  topicsByMacro,
} from '@/lib/talk/catalog';
import { getTalkPack } from '@/lib/talk/packs';
import { MIN_QUIZ_WORDS } from '@/lib/talk/quiz';

// Egy téma (PCIC makró) átbeszélése: előbb szintet választasz, aztán
// formátumot. A három formátum közül a szókvíz mindig játszható, ha a
// cellának van szava (futásidőben épül), a sztori és a párbeszéd megírt
// pakkot igényel, addig „Hamarosan".
export default function TalkMacroScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const { macro: macroParam } = useLocalSearchParams<{ macro: string }>();
  const macro = Number(macroParam);

  const [contentLang, setContentLang] = useState('es');
  const [uiLang, setUiLang] = useState('hu');
  const [level, setLevel] = useState<Level>('A1');

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    setContentLang(onboarding?.target ?? 'es');
    setUiLang(source === 'hu' ? 'hu' : source === 'es' ? 'es' : source === 'de' ? 'de' : 'en');
    // A tanuló saját szintje a kiinduló választás, de bármelyikre átválthat,
    // ez a fül lényege.
    const levelData = await db.getLevel();
    const own = levelData.level as Level;
    if (TALK_LEVELS.includes(own)) setLevel(own);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const def = getMacro(macro);
  const topics = topicsByMacro(contentLang).get(macro) ?? [];
  const pack = def ? getTalkPack(contentLang, macro, level) : undefined;
  const words = def ? macroWords(macro, level, contentLang) : [];
  const quizReady = words.length >= MIN_QUIZ_WORDS;

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={[styles.back, { color: colors.text }]}>←</Text>
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
        {def ? `${def.icon}  ${macroName(def, uiLang)}` : s.talk.title}
      </Text>
      <View style={styles.backSpacer} />
    </View>
  );

  if (!def) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <Text style={[styles.empty, { color: colors.tabIconDefault }]}>{s.talk.comingSoon}</Text>
      </View>
    );
  }

  const formats: {
    key: string;
    name: string;
    blurb: string;
    ready: boolean;
    onPress: () => void;
  }[] = [
    {
      key: 'story',
      name: s.talk.formatStory,
      blurb: s.talk.formatStoryBlurb,
      ready: !!pack,
      onPress: () => router.push(`/games/story?talk=${pack?.story.id}` as never),
    },
    {
      key: 'chat',
      name: s.talk.formatChat,
      blurb: s.talk.formatChatBlurb,
      ready: !!pack,
      onPress: () => router.push(`/games/chat?talk=${pack?.chat.id}` as never),
    },
    {
      key: 'quiz',
      name: s.talk.formatQuiz,
      blurb: s.talk.formatQuizBlurb,
      ready: quizReady,
      onPress: () => router.push(`/talk/quiz?macro=${macro}&level=${level}` as never),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.topicList, { color: colors.tabIconDefault }]}>
          {topics.map((mt) => getTopicName(mt.topic, uiLang)).join(' · ')}
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{s.talk.pickLevel}</Text>
        <View style={styles.levelRow}>
          {TALK_LEVELS.map((lvl) => {
            const has = macroWords(macro, lvl, contentLang).length > 0;
            const active = lvl === level;
            return (
              <Pressable
                key={lvl}
                disabled={!has}
                onPress={() => setLevel(lvl)}
                style={[
                  styles.levelBtn,
                  { backgroundColor: active ? colors.tint : colors.card, opacity: has ? 1 : 0.35 },
                ]}>
                <Text
                  style={[
                    styles.levelBtnText,
                    { color: active ? colors.background : colors.text },
                  ]}>
                  {lvl}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {words.length === 0 ? (
          <Text style={[styles.empty, { color: colors.tabIconDefault }]}>{s.talk.levelNoWords}</Text>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{s.talk.pickFormat}</Text>
            {formats.map((f) => (
              <Pressable
                key={f.key}
                disabled={!f.ready}
                onPress={f.onPress}
                style={[styles.formatCard, { backgroundColor: colors.card, opacity: f.ready ? 1 : 0.5 }]}>
                <View style={styles.formatHead}>
                  <Text style={[styles.formatName, { color: colors.text }]}>{f.name}</Text>
                  {!f.ready && (
                    <Text style={[styles.soon, { color: colors.tabIconDefault }]}>{s.talk.comingSoon}</Text>
                  )}
                </View>
                <Text style={[styles.formatBlurb, { color: colors.tabIconDefault }]}>{f.blurb}</Text>
              </Pressable>
            ))}
          </>
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
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 8,
    gap: 12,
  },
  back: { fontSize: 26 },
  backSpacer: { width: 26 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  topicList: { fontSize: 12, lineHeight: 17, marginBottom: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginTop: 6, marginBottom: 8 },
  levelRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  levelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  levelBtnText: { fontSize: 14, fontWeight: '700' },
  formatCard: { borderRadius: 14, padding: 14, marginBottom: 10 },
  formatHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formatName: { fontSize: 17, fontWeight: '600' },
  soon: { fontSize: 12 },
  formatBlurb: { fontSize: 13, marginTop: 5, lineHeight: 18 },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 30 },
});
