import { getWordsForTopic, type Level } from '@/data/words';
import type { TopicDef } from '@/data/topics';
import { isTopicMastered } from '@/lib/topicMastery';

// FB135/FB136 (moved from app/(tabs)/index.tsx, structural extraction only):
// `stateMap` = szavankénti "ismert" jelző (UTEMEZO 12/4: lap >= 3 VAGY
// eltemetve, ugyanaz a definíció, mint a Stats-kártyáé). A topic-készültség
// EBBŐL dől el (lib/topicMastery.ts), nem a repsMap-ből: egyszer látni egy
// szót nem tudás, és az új topic csak akkor indulhat, ha a régi szavai
// valóban megtanultak. A repsMap marad az "elkezdett-e egyáltalán" jelzésre.
export function computeUnlockedTopics(
  topics: TopicDef[],
  repsMap: Map<number, number>,
  stateMap: Map<number, number>,
  currentLevel: Level,
  selectedTopicId?: string | null,
  lang: string = 'es',
  randomPick: boolean = false,
): { unlocked: TopicDef[]; activeTopic: TopicDef | null; completedCount: number } {
  // Any level with a topic taxonomy (A0/A1/A2): all topics freely selectable,
  // no sequential lock. Levels without topics keep the sequential unlock logic.
  let unlocked: TopicDef[];
  if (topics.length > 0) {
    unlocked = [...topics];
  } else {
    unlocked = [];
    for (const topic of topics) {
      if (unlocked.length === 0) {
        unlocked.push(topic);
      } else {
        const prevTopic = topics[topics.indexOf(topic) - 1];
        const prevWords = getWordsForTopic(currentLevel, prevTopic.id, lang);
        const allReviewed = prevWords.length > 0 && prevWords.every(w => (repsMap.get(w.id) ?? 0) > 0);
        if (allReviewed) {
          unlocked.push(topic);
        } else {
          break;
        }
      }
    }
  }

  const topicComplete = (topic: TopicDef) =>
    isTopicMastered(getWordsForTopic(currentLevel, topic.id, lang).map(w => w.id), stateMap);

  let completedCount = 0;
  for (const topic of unlocked) {
    if (topicComplete(topic)) completedCount++;
  }

  // Active topic: use persisted selectedTopic if set and not fully complete,
  // otherwise fall back to first incomplete topic by order.
  let activeTopic: TopicDef | null = null;
  if (selectedTopicId) {
    const sel = unlocked.find(t => t.id === selectedTopicId);
    if (sel && !topicComplete(sel)) activeTopic = sel;
  }
  if (!activeTopic) {
    const isIncomplete = (topic: TopicDef) => !topicComplete(topic);
    if (randomPick) {
      // FB37: instead of always the first incomplete topic by order, draw
      // uniformly among ALL incomplete topics so learning doesn't always
      // fall back to the same "start of the queue" topic.
      const incomplete = unlocked.filter(isIncomplete);
      activeTopic = incomplete.length > 0
        ? incomplete[Math.floor(Math.random() * incomplete.length)]
        : unlocked[unlocked.length - 1] ?? null;
    } else {
      activeTopic = unlocked.find(isIncomplete) ?? unlocked[unlocked.length - 1] ?? null;
    }
  }

  return { unlocked, activeTopic, completedCount };
}
