import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { getDb } from '@/lib/database';
import { getTopicName } from '@/data/topics';
import {
  MACROS,
  macroName,
  topicsByMacro,
  levelsWithWords,
  type MacroDef,
} from '@/lib/talk/catalog';
import { levelsWithPack, packCount } from '@/lib/talk/packs';
import FeedbackButton from '@/components/FeedbackModal';

// Átbeszélő fül (Kálmán, 2026-09-08): „legyen egy külön fül, amiben ott
// lennének az összes téma", és a témát a saját szintjétől függetlenül lehessen
// átbeszélni. A tanulófa (tree) témái szinthez kötöttek, ez a fül a PCIC
// makró-témák alá csoportosítva mutatja MINDET, szintválasztóval mögötte.
//
// A kártya két számot mutat: hány fa-téma esik a makró alá (ez az „összes
// téma" felsorolás), és hány szinten van már megírt sztori/párbeszéd.
export default function TalkScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();

  const [contentLang, setContentLang] = useState('es');
  const [uiLang, setUiLang] = useState('hu');
  const [level, setLevel] = useState('A1');
  const [pair, setPair] = useState('hu→es');

  const load = useCallback(async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    const source = onboarding?.source ?? 'hu';
    setContentLang(onboarding?.target ?? 'es');
    // Ugyanaz a nyelv-létra, mint a tree fülön: a tartalom nyelve dönti el,
    // MELYIK témafa jön, a tanuló saját nyelve azt, HOGYAN olvasható.
    setUiLang(source === 'hu' ? 'hu' : source === 'es' ? 'es' : source === 'de' ? 'de' : 'en');
    setPair(`${source}→${onboarding?.target ?? 'es'}`);
    const levelData = await db.getLevel();
    setLevel(levelData.level);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const byMacro = topicsByMacro(contentLang);
  const ready = packCount(contentLang);

  const openMacro = (m: MacroDef) => {
    router.push(`/talk/${m.macro}` as never);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{s.talk.title}</Text>
        <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>{s.talk.subtitle}</Text>
        <Text style={[styles.readyLine, { color: colors.text }]}>{s.talk.readyLine(ready)}</Text>

        {MACROS.map((m) => {
          const topics = byMacro.get(m.macro) ?? [];
          if (topics.length === 0) return null;
          const packLevels = levelsWithPack(contentLang, m.macro);
          const wordLevels = levelsWithWords(m.macro, contentLang);
          const names = topics.map((mt) => getTopicName(mt.topic, uiLang)).join(' · ');
          return (
            <Pressable
              key={m.macro}
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() => openMacro(m)}>
              <View style={styles.cardHead}>
                <Text style={styles.cardIcon}>{m.icon}</Text>
                <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={2}>
                  {macroName(m, uiLang)}
                </Text>
                <Text style={[styles.cardCount, { color: colors.tabIconDefault }]}>
                  {s.talk.topicsIn(topics.length)}
                </Text>
              </View>
              <Text style={[styles.cardTopics, { color: colors.tabIconDefault }]} numberOfLines={2}>
                {names}
              </Text>
              <View style={styles.levelRow}>
                {wordLevels.map((lvl) => (
                  <View
                    key={lvl}
                    style={[
                      styles.levelChip,
                      packLevels.includes(lvl)
                        ? { backgroundColor: colors.tint }
                        : { borderColor: colors.tabIconDefault, borderWidth: 1 },
                    ]}>
                    <Text
                      style={[
                        styles.levelChipText,
                        { color: packLevels.includes(lvl) ? colors.background : colors.tabIconDefault },
                      ]}>
                      {lvl}
                    </Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <FeedbackButton level={level} languagePair={pair} currentCard="talk-tab" draggable />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  readyLine: { fontSize: 13, marginTop: 10, marginBottom: 14 },
  card: { borderRadius: 14, padding: 14, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { fontSize: 24 },
  cardName: { flex: 1, fontSize: 17, fontWeight: '600' },
  cardCount: { fontSize: 12 },
  cardTopics: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  levelRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  levelChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  levelChipText: { fontSize: 11, fontWeight: '700' },
});
