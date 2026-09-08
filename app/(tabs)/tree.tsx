import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { isTopicMastered, masteredCount } from '@/lib/topicMastery';
import { getDb } from '@/lib/database';
import { getWordsForTopic, getWordsForLevel, type Level } from '@/data/words';
import {
  getTopicsForLevel,
  getSubLevelsForLevel,
  getTopicsForSubLevel,
  getTopicName,
  getSubLevelName,
  type TopicDef,
  type SubLevelDef,
} from '@/data/topics';
import { t } from '@/lib/i18n';
import { setPendingAction } from '@/lib/pendingAction';
import FeedbackButton from '@/components/FeedbackModal';

export default function TreeScreen() {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();

  const [level, setLevel] = useState<Level>('A1');
  const [repsMap, setRepsMap] = useState<Map<number, number>>(new Map());
  // A topic-készültség FSRS-állapotból jön (lib/topicMastery.ts), nem a reps-ből,
  // hogy a fa ugyanazt a "kész"-t mutassa, mint a tanulási képernyő.
  const [stateMap, setStateMap] = useState<Map<number, number>>(new Map());
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [direction, setDirection] = useState<[string, string]>(['es', 'hu']);

  const load = async () => {
    const db = getDb();
    const onboarding = await db.getOnboarding();
    if (onboarding) setDirection([onboarding.source, onboarding.target]);
    const levelData = await db.getLevel();
    const lvl = levelData.level as Level;
    setLevel(lvl);
    const words = getWordsForLevel(lvl, onboarding?.target ?? 'es');
    const ids = words.map(w => w.id);
    const map = await db.getWordReps(ids);
    setRepsMap(map);
    setStateMap(await db.getWordStates(ids));
    const saved = await db.getSelectedTopic();
    setSelectedTopicId(saved);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleSelectTopic = async (topic: TopicDef) => {
    const db = getDb();
    await db.setSelectedTopic(topic.id);
    setSelectedTopicId(topic.id);
    setPendingAction({ type: 'selectTopic' });
    router.push('/');
  };

  // Two different languages meet on this screen: `contentLang` is the language
  // being LEARNED, which decides WHICH topic tree and words are shown, while
  // `uiLang` is the learner's own language, which decides how the names READ.
  // Sharing one variable showed a Spanish beginner the Hungarian names, and
  // then (worse) the Spanish topic tree of the wrong course.
  const contentLang = direction[1];
  const uiLang = direction[0] === 'hu' ? 'hu' : direction[0] === 'es' ? 'es' : direction[0] === 'de' ? 'de' : 'en';

  // Render the tree for any level that has a topic taxonomy (A0, A1); other
  // levels show a placeholder until their topics are authored.
  const topics = getTopicsForLevel(level, contentLang);
  const subLevels = getSubLevelsForLevel(level, contentLang);

  if (topics.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.noTree, { color: colors.tabIconDefault }]}>{level}</Text>
        <View style={styles.feedbackWrap}>
          <FeedbackButton level={level} languagePair={direction.join('→')} currentCard="tree-tab" draggable />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.scrollContent}
    >
      {/* The grammar course sits at the top of the topic map: the tree teaches
          words, the course teaches the rules that hold them together. */}
      <Pressable
        testID="grammar-course-entry"
        style={[styles.grammarEntry, { backgroundColor: colors.card, borderColor: colors.tint }]}
        onPress={() => router.push('/grammar' as never)}
      >
        <Text style={styles.grammarEntryIcon}>📐</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.grammarEntryTitle, { color: colors.text }]}>{s.grammar.entryTitle}</Text>
          <Text style={[styles.grammarEntryBlurb, { color: colors.tabIconDefault }]}>{s.grammar.entryBlurb}</Text>
        </View>
        <Text style={[styles.grammarEntryArrow, { color: colors.tint }]}>→</Text>
      </Pressable>

      {subLevels.map((sub: SubLevelDef, subIdx: number) => {
        const subTopics = getTopicsForSubLevel(level, sub.id, contentLang);
        const doneSub = subTopics.filter(t =>
          isTopicMastered(getWordsForTopic(level, t.id, contentLang).map(w => w.id), stateMap)
        ).length;

        // Build rows of 2-3 nodes
        const rows: TopicDef[][] = [];
        for (let i = 0; i < subTopics.length; i += 3) {
          rows.push(subTopics.slice(i, i + 3));
        }

        return (
          <View key={sub.id}>
            {/* Tier header */}
            <View style={[styles.tierHeader, { backgroundColor: colors.card }]}>
              <Text style={[styles.tierId, { color: colors.tint }]}>{sub.id}</Text>
              <Text style={[styles.tierName, { color: colors.text }]}>{getSubLevelName(sub, uiLang)}</Text>
              <Text style={[styles.tierProgress, { color: colors.tabIconDefault }]}>{doneSub}/{subTopics.length}</Text>
            </View>

            {/* Spine + node rows */}
            <View style={styles.tierBody}>
              {/* Central vertical spine */}
              {subIdx < subLevels.length - 1 && (
                <View style={[styles.spine, { backgroundColor: colors.tabIconDefault }]} />
              )}

              {rows.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.nodeRow}>
                  {/* Branch stub from spine to row */}
                  <View style={[styles.branchStub, { borderColor: colors.tabIconDefault }]} />
                  {row.map((topic: TopicDef) => {
                    const topicWords = getWordsForTopic(level, topic.id, contentLang);
                    // A csempe számlálója a RÖGZÜLT szavakat mutatja (ez a "kész"
                    // feltétele); "folyamatban" viszont már az is, amit elkezdtél.
                    const reviewedCount = masteredCount(topicWords.map(w => w.id), stateMap);
                    const startedCount = topicWords.filter(w => (repsMap.get(w.id) ?? 0) > 0).length;
                    const isComplete = topicWords.length > 0 && reviewedCount === topicWords.length;
                    const isInProgress = !isComplete && startedCount > 0;
                    const isSelected = topic.id === selectedTopicId;
                    const isGrammar = topic.type === 'grammar';
                    const accentColor = isGrammar ? '#22C55E' : '#38BDF8';

                    let borderColor = colors.tabIconDefault;
                    let borderWidth = 1.5;
                    let opacity = 0.45;

                    if (isComplete) {
                      borderColor = '#F59E0B';
                      borderWidth = 2;
                      opacity = 1;
                    } else if (isSelected) {
                      borderColor = accentColor;
                      borderWidth = 3;
                      opacity = 1;
                    } else if (isInProgress) {
                      borderColor = '#38BDF8';
                      borderWidth = 2;
                      opacity = 1;
                    } else {
                      opacity = 0.45;
                    }

                    return (
                      <Pressable
                        key={topic.id}
                        style={[
                          styles.node,
                          {
                            backgroundColor: colors.card,
                            borderColor,
                            borderWidth,
                            opacity,
                          },
                        ]}
                        onPress={() => handleSelectTopic(topic)}
                      >
                        <Text style={styles.nodeEmoji}>{topic.icon}</Text>
                        <Text
                          style={[styles.nodeName, { color: colors.text }]}
                          numberOfLines={2}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                          maxFontSizeMultiplier={1.2}
                        >
                          {getTopicName(topic, uiLang)}
                        </Text>
                        <Text style={[styles.nodeProgress, { color: accentColor }]}>
                          {s.topic.wordProgress(reviewedCount, topicWords.length)}
                        </Text>
                        {isComplete && <Text style={styles.checkMark}>✓</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        );
      })}
      <View style={styles.feedbackWrap}>
        <FeedbackButton level={level} languagePair={direction.join('→')} currentCard="tree-tab" draggable />
      </View>
      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grammarEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  grammarEntryIcon: { fontSize: 26 },
  grammarEntryTitle: { fontSize: 16, fontWeight: '700' },
  grammarEntryBlurb: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  grammarEntryArrow: { fontSize: 20, fontWeight: '800' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  noTree: { fontSize: 16, fontWeight: '600' },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 8,
    gap: 8,
  },
  tierId: { fontSize: 13, fontWeight: '800' },
  tierName: { fontSize: 14, fontWeight: '700', flex: 1 },
  tierProgress: { fontSize: 12, fontWeight: '600' },
  tierBody: { position: 'relative', paddingBottom: 16, paddingLeft: 20 },
  spine: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    width: 2,
    borderRadius: 1,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
    position: 'relative',
  },
  branchStub: {
    width: 12,
    height: 2,
    marginTop: 36,
    borderTopWidth: 2,
  },
  node: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    minHeight: 90,
    justifyContent: 'center',
  },
  nodeEmoji: { fontSize: 28, marginBottom: 4 },
  nodeName: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  nodeProgress: { fontSize: 11, fontWeight: '700' },
  checkMark: { fontSize: 14, color: '#F59E0B', fontWeight: '800', marginTop: 2 },
  feedbackWrap: { alignItems: 'center', marginTop: 16 },
  bottomPad: { height: 32 },
});
