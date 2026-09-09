import { StyleSheet, Text, View, Pressable } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { type Level } from '@/data/words';
import { type TopicDef, getTopicName, getSubLevelForTopic, getTopicsForSubLevel, getSubLevelName } from '@/data/topics';
import FeedbackButton from '@/components/FeedbackModal';
import { DAILY_NEW_BONUS_STEPS } from '@/lib/usageStats';
import { type NewWordPause } from '@/lib/newWordBudget';
import { useRouter } from 'expo-router';

interface TopicProgress {
  done: number;
  total: number;
  wordsInTopic: number;
  wordsReviewed: number;
}

interface Props {
  reviewed: number;
  streak: number;
  level: Level;
  masteredPct: number;
  direction: [string, string];
  onStartExam: () => void;
  examAvailable: boolean;
  currentTopic?: TopicDef | null;
  topicProgress?: TopicProgress | null;
  newWordsLeft?: number;
  // FB114: the daily budget still has room, but the half-learned pile hit the WIP
  // ceiling, so no new word can join. The "+5 new words" tap raises both, hence
  // the button is offered here too, not only at a spent budget.
  newWordsPaused?: boolean;
  // FB133: the learner picks how many more, not just five.
  onMoreNewWords?: (extra: number) => void;
  // FB135/FB136: untouched words left in the ACTIVE topic. Zero means a bigger
  // daily budget would not produce a single card, so the offer has to be the
  // next topic instead of "+N new words".
  newWordsInTopic?: number;
  onNextTopicWords?: () => void;
  // FB142: what the finished queue was made of, how many half-learned words are
  // waiting behind a pause, and why the pause is on. Without this the learner
  // only saw repeats and read it as a broken level ("az a0 szint bugos", FB141).
  sessionMix?: { newWords: number; reviews: number };
  unlearnedCount?: number;
  pauseReason?: NewWordPause;
  // FB190, Kálmán 2026-09-08: „ahh szerintem most elértem ahoz hogy nincs 15 szó
  // szóval nem tudom kiválasztani, hogy mit csináljak. old meg ilyenkor." Ha a
  // SZINTEN sincs több el nem kezdett szó, a képernyő nem hallgathat: három út
  // van, gyakorlás, vizsga, vagy tovább a következő szintre.
  levelExhausted?: boolean;
  onPractiseLevel?: () => void;
  onNextLevel?: () => void;
}

export default function DoneScreen({ reviewed, streak, level, masteredPct, direction, onStartExam, examAvailable, currentTopic, topicProgress, newWordsLeft, newWordsPaused, onMoreNewWords, newWordsInTopic, onNextTopicWords, sessionMix, unlearnedCount = 0, pauseReason = 'none', levelExhausted = false, onPractiseLevel, onNextLevel }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  // Topic/sub-level names are interface text: the learner's own language, not
  // the one being learned (same rule as the Learn header and the topic tree).
  const topicLang = direction[0] === 'hu' ? 'hu' : direction[0] === 'es' ? 'es' : direction[0] === 'de' ? 'de' : 'en';

  // Sub-level progress: topics are unlocked sequentially by order, so the
  // done-count inside the sub-level is the global done-count minus the
  // topics that precede this sub-level.
  const subLevel = currentTopic ? getSubLevelForTopic(level, currentTopic.id, direction[1]) : null;
  const subTopics = subLevel ? getTopicsForSubLevel(level, subLevel.id, direction[1]) : [];
  const subDone = subLevel && topicProgress
    ? Math.min(Math.max(topicProgress.done - ((subTopics[0]?.order ?? 1) - 1), 0), subTopics.length)
    : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.doneEmoji}>🎉</Text>
      <Text style={[styles.title, { color: colors.text }]}>{s.done.title}</Text>
      <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>
        {s.done.reviewed(reviewed)}
      </Text>
      {/* FB142: name the split instead of leaving "why was this all repeats?"
          to guesswork, and say what holds the new words back. */}
      {sessionMix && (
        <Text style={[styles.mixText, { color: colors.tabIconDefault }]}>
          {s.done.sessionMix(sessionMix.newWords, sessionMix.reviews)}
        </Text>
      )}
      {pauseReason === 'congested' && (
        <Text style={[styles.mixText, { color: colors.accent }]}>
          {s.done.newWordsCongested(unlearnedCount)}
        </Text>
      )}
      {pauseReason === 'daily-limit' && (
        <Text style={[styles.mixText, { color: colors.tabIconDefault }]}>
          {s.done.newWordsSpent}
        </Text>
      )}
      <View style={[styles.levelBadge, { backgroundColor: '#38BDF8' }]}>
        <Text style={styles.levelText}>{level}</Text>
      </View>
      {subLevel && (
        <View style={styles.subLevelRow}>
          <Text style={[styles.subLevelName, { color: colors.text }]}>
            {subLevel.id} · {getSubLevelName(subLevel, topicLang)}
          </Text>
          <Text style={[styles.subLevelCounter, { color: colors.tabIconDefault }]}>
            {s.subLevel.doneProgress(subDone, subTopics.length)}
          </Text>
        </View>
      )}
      {topicProgress && currentTopic && (
        <View style={styles.topicRow}>
          <Text style={[styles.topicIcon]}>
            {currentTopic.icon ?? (currentTopic.type === 'grammar' ? '📗' : '📘')}
          </Text>
          <Text style={[styles.topicText, { color: colors.text }]}>
            {getTopicName(currentTopic, topicLang)}
          </Text>
          <Text style={[styles.topicCounter, { color: colors.tabIconDefault }]}>
            {s.topic.progress(topicProgress.done, topicProgress.total)}
          </Text>
        </View>
      )}
      {topicProgress && level === 'A1' && (
        <Pressable
          style={({ pressed }) => [
            styles.filledBtn,
            { backgroundColor: colors.tint, marginTop: 16, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => router.push('/(tabs)/tree')}
        >
          <Text style={styles.filledBtnText}>{s.topic.chooseTopic}</Text>
        </Pressable>
      )}
      {/* FB77: today's new-word budget ran out, offer more instead of ending the
          session; the standing limit itself lives in Settings. FB133: three
          sizes (+5/+10/+15), and filled buttons, because the outlined ones did
          not read as tappable ("legyenek teli gombok"). */}
      {/* FB190: nem a téma fogyott el, hanem a SZINT. Ilyenkor a „következő téma"
          és a „+N új szó" is üres ígéret lenne, ezért itt a három valódi út áll:
          gyakorlás a szint szavaiból, vizsga, vagy a következő szint. */}
      {levelExhausted && (
        <View style={styles.levelDoneBox}>
          <Text style={[styles.topicEmptyText, { color: colors.text }]}>{s.done.levelWordsDone}</Text>
          {onPractiseLevel && (
            <Pressable
              style={({ pressed }) => [styles.filledBtn, { backgroundColor: colors.tint, marginTop: 12, opacity: pressed ? 0.8 : 1 }]}
              onPress={onPractiseLevel}
            >
              <Text style={styles.filledBtnText}>{s.done.practiseLevel}</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.filledBtn,
              { backgroundColor: examAvailable ? colors.accent : colors.card, marginTop: 10, opacity: pressed ? 0.8 : 1 },
            ]}
            disabled={!examAvailable}
            onPress={onStartExam}
          >
            <Text style={[styles.filledBtnText, !examAvailable && { color: colors.tabIconDefault }]}>
              {examAvailable ? s.done.takeExam : s.done.examLocked(80)}
            </Text>
          </Pressable>
          {onNextLevel && (
            <Pressable
              style={({ pressed }) => [styles.outlineBtn, { borderColor: colors.tint, marginTop: 10, opacity: pressed ? 0.8 : 1 }]}
              onPress={onNextLevel}
            >
              <Text style={[styles.outlineBtnText, { color: colors.tint }]}>{s.done.nextLevel}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* FB135/FB136: the topic ran dry (its remaining words are scheduled for a
          later day), so say that instead of leaving an empty screen, and offer
          the next topic that still has untouched words. */}
      {(newWordsInTopic ?? 0) === 0 && onNextTopicWords && (
        <>
          <Text style={[styles.topicEmptyText, { color: colors.tabIconDefault }]}>{s.done.topicEmpty}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.filledBtn,
              { backgroundColor: colors.accent, marginTop: 12, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={onNextTopicWords}
          >
            <Text style={styles.filledBtnText}>{s.done.nextTopicWords}</Text>
          </Pressable>
        </>
      )}
      {(newWordsLeft === 0 || newWordsPaused) && (newWordsInTopic ?? 0) > 0 && onMoreNewWords && (
        <View style={styles.moreWordsRow}>
          {DAILY_NEW_BONUS_STEPS.map(extra => (
            <Pressable
              key={extra}
              style={({ pressed }) => [
                styles.filledBtn,
                { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => onMoreNewWords(extra)}
            >
              <Text style={styles.filledBtnText}>{s.done.moreNewWords(extra)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={[styles.streakBadge, { backgroundColor: colors.card, marginTop: 12 }]}>
        <Text style={[styles.streakNumber, { color: colors.accent }]}>{streak}</Text>
        <Text style={[styles.streakLabel, { color: colors.tabIconDefault }]}>{s.done.streak}</Text>
      </View>
      {/* FB148: these two were hardcoded Hungarian, so an English or Spanish
          interface still said "vizsga". */}
      <Text style={[styles.masteredText, { color: masteredPct >= 80 ? '#22C55E' : colors.tabIconDefault }]}>
        {level}: {masteredPct}% {masteredPct < 80 ? s.exam.threshold(80) : '✓'}
      </Text>
      {examAvailable && (
        <Pressable style={[styles.examBtn, { backgroundColor: colors.accent, marginTop: 20 }]} onPress={onStartExam}>
          <Text style={styles.examBtnText}>🎓 {s.exam.tag}</Text>
        </Pressable>
      )}
      <FeedbackButton level={level} languagePair={direction.join('→')} currentCard="done" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  doneEmoji: { fontSize: 64, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 8 },
  mixText: { fontSize: 13, textAlign: 'center', marginBottom: 8, paddingHorizontal: 8 },
  levelBadge: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, alignSelf: 'center' },
  levelText: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 4, alignSelf: 'center' },
  streakNumber: { fontSize: 18, fontWeight: '700' },
  streakLabel: { fontSize: 14 },
  masteredText: { fontSize: 14, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  subLevelRow: { alignItems: 'center', alignSelf: 'center', marginTop: 12 },
  subLevelName: { fontSize: 15, fontWeight: '700' },
  subLevelCounter: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  topicRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, marginTop: 10 },
  topicIcon: { fontSize: 14 },
  topicText: { fontSize: 14, fontWeight: '600' },
  topicCounter: { fontSize: 12, fontWeight: '500' },
  examBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, minWidth: 160, alignItems: 'center', alignSelf: 'center' },
  examBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  // FB133: filled buttons, the outlined ones did not read as tappable.
  moreWordsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 },
  topicEmptyText: { fontSize: 13, textAlign: 'center', marginTop: 16, paddingHorizontal: 8 },
  filledBtn: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, alignSelf: 'center' },
  // FB190: a szint-vége blokk gombjai egymás alatt, közös szélességgel.
  levelDoneBox: { marginTop: 18, alignSelf: 'stretch', paddingHorizontal: 24 },
  outlineBtn: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, borderWidth: 1, alignSelf: 'center' },
  outlineBtnText: { fontSize: 15, fontWeight: '600' },
  filledBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
