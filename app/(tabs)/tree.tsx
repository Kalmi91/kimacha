import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
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

  const lang = direction[1] === 'hu' ? 'hu' : direction[1] === 'es' ? 'es' : direction[1] === 'de' ? 'de' : 'en';

  // Render the tree for any level that has a topic taxonomy (A0, A1); other
  // levels show a placeholder until their topics are authored.
  const topics = getTopicsForLevel(level, lang);
  const subLevels = getSubLevelsForLevel(level, lang);

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
      {subLevels.map((sub: SubLevelDef, subIdx: number) => {
        const subTopics = getTopicsForSubLevel(level, sub.id, lang);
        const doneSub = subTopics.filter(t => {
          const tw = getWordsForTopic(level, t.id, lang);
          return tw.length > 0 && tw.every(w => (repsMap.get(w.id) ?? 0) > 0);
        }).length;

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
              <Text style={[styles.tierName, { color: colors.text }]}>{getSubLevelName(sub, lang)}</Text>
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
                    const topicWords = getWordsForTopic(level, topic.id, lang);
                    const reviewedCount = topicWords.filter(w => (repsMap.get(w.id) ?? 0) > 0).length;
                    const isComplete = topicWords.length > 0 && reviewedCount === topicWords.length;
                    const isInProgress = !isComplete && reviewedCount > 0;
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
                        <Text style={[styles.nodeName, { color: colors.text }]} numberOfLines={2}>
                          {getTopicName(topic, lang)}
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
