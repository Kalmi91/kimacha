import { StyleSheet, View } from 'react-native';

import { getTopicName, type TopicDef } from '@/data/topics';
import { type Level } from '@/data/words';
import { languages } from '@/lib/languages';
import type { stringsFor } from '@/lib/i18n';
import LearnChrome from '@/components/LearnChrome';
import AskMoreCard from '@/components/AskMoreCard';

type Strings = ReturnType<typeof stringsFor>;

// Moved from app/(tabs)/index.tsx (structural extraction only): UTEMEZO 5.
// szakasz (FB296/297/298, Kálmán döntése 2026-09-17): a kérdés-lap a kártya
// helyén jön, a fejléc (fekete/kék/rózsaszín + "kérdés" címke) ekkor is
// látszik, ezért a LearnChrome-ot itt is meghívjuk.
type Props = {
  level: Level;
  direction: [string, string];
  colors: { background: string };
  currentTopic: TopicDef | null;
  topicProgress: { done: number; total: number; wordsInTopic: number; wordsReviewed: number } | null;
  knownWords: number;
  levelTotal: number;
  black: number;
  blue: number;
  pink: number;
  masteredPct: number;
  s: Strings;
  lapLabel: string | null;
  onExamPress: () => void;
  onTopicPress: () => void;
  dailyDefault: number;
  reviewsLeft: number;
  onMore: (n: number) => void;
  onReviewOnly: () => void;
  onDone: () => void;
};

export default function AskMoreScreen({
  level,
  direction,
  colors,
  currentTopic,
  topicProgress,
  knownWords,
  levelTotal,
  black,
  blue,
  pink,
  masteredPct,
  s,
  lapLabel,
  onExamPress,
  onTopicPress,
  dailyDefault,
  reviewsLeft,
  onMore,
  onReviewOnly,
  onDone,
}: Props) {
  const topicLang = direction[0] === 'hu' ? 'hu' : direction[0] === 'es' ? 'es' : direction[0] === 'de' ? 'de' : 'en';
  const targetLang = languages.find(l => l.code === direction[1]);
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LearnChrome
        level={level}
        topicIcon={currentTopic ? (currentTopic.icon ?? (currentTopic.type === 'grammar' ? '📗' : '📘')) : null}
        topicName={currentTopic && topicProgress ? getTopicName(currentTopic, topicLang) : null}
        onTopicPress={onTopicPress}
        known={knownWords}
        total={levelTotal}
        langFlag={targetLang?.flag ?? ''}
        langName={targetLang?.name ?? ''}
        black={black}
        blue={blue}
        pink={pink}
        reviewLeft={pink}
        examUnlocked={masteredPct >= 80}
        onExamPress={onExamPress}
        examLabel={s.exam.unlocked}
        toast={null}
        lapLabel={lapLabel}
      />
      <AskMoreCard
        dailyDefault={dailyDefault}
        reviewsLeft={reviewsLeft}
        onMore={onMore}
        onReviewOnly={onReviewOnly}
        onDone={onDone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
});
