import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { type Level } from '@/data/words';
import { type TopicDef, getTopicName, getSubLevelForTopic, getTopicsForSubLevel, getSubLevelName } from '@/data/topics';
import FeedbackButton from '@/components/FeedbackModal';
import { useRouter } from 'expo-router';

interface TopicProgress {
  done: number;
  total: number;
  wordsInTopic: number;
  wordsReviewed: number;
}

// UTEMEZO 5. szakasz: a Done-kepernyo negy szama, mind erre a korre.
interface DoneStats {
  reviewsAnswered: number;
  wordsStarted: number;
  wordsLearned: number;
  wrongLaps: number;
}

// UTEMEZO 5. szakasz: a kor vegi egyetlen kerdes, a helyzettol fuggoen.
export type DoneAsk = 'more-new' | 'practise' | 'none';

interface Props {
  streak: number;
  level: Level;
  masteredPct: number;
  direction: [string, string];
  onStartExam: () => void;
  examAvailable: boolean;
  currentTopic?: TopicDef | null;
  topicProgress?: TopicProgress | null;
  stats: DoneStats;
  ask: DoneAsk;
  // A szammezo alapertelmezett erteke (a napi uj szo beallitas).
  dailyDefault: number;
  onMoreNewWords?: (n: number) => void;
  // FB135/FB136: untouched words left in the ACTIVE topic. Zero means a bigger
  // daily budget would not produce a single card, so the offer has to be the
  // next topic instead of "+N new words".
  newWordsInTopic?: number;
  onNextTopicWords?: () => void;
  // FB190, Kálmán 2026-09-08: „ahh szerintem most elértem ahoz hogy nincs 15 szó
  // szóval nem tudom kiválasztani, hogy mit csináljak. old meg ilyenkor." Ha a
  // SZINTEN sincs több el nem kezdett szó, a képernyő nem hallgathat: három út
  // van, gyakorlás, vizsga, vagy tovább a következő szintre.
  levelExhausted?: boolean;
  onPractiseLevel?: (n: number) => void;
  onNextLevel?: () => void;
}

export default function DoneScreen({ streak, level, masteredPct, direction, onStartExam, examAvailable, currentTopic, topicProgress, stats, ask, dailyDefault, onMoreNewWords, newWordsInTopic, onNextTopicWords, levelExhausted = false, onPractiseLevel, onNextLevel }: Props) {
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

  // UTEMEZO 5. szakasz: a kor vegi egyetlen kerdes szammezeje, a napi
  // alapertekre eloallitva; "Nem" csak elrejti, nem hivja a hivot.
  const [askInput, setAskInput] = useState(String(dailyDefault));
  const [askDismissed, setAskDismissed] = useState(false);
  const askedN = () => {
    const n = parseInt(askInput, 10);
    return Number.isFinite(n) && n >= 1 ? n : Math.max(1, dailyDefault);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.doneEmoji}>🎉</Text>
      <Text style={[styles.title, { color: colors.text }]}>{s.done.title}</Text>
      {/* UTEMEZO 5. szakasz: a kor negy szama. */}
      <View style={styles.statsGrid}>
        <View style={styles.statsCell}>
          <Text style={[styles.statsNumber, { color: colors.text }]}>{stats.reviewsAnswered}</Text>
          <Text style={[styles.statsLabel, { color: colors.tabIconDefault }]}>{s.done.reviewLaps}</Text>
        </View>
        <View style={styles.statsCell}>
          <Text style={[styles.statsNumber, { color: colors.text }]}>{stats.wordsStarted}</Text>
          <Text style={[styles.statsLabel, { color: colors.tabIconDefault }]}>{s.done.wordsStarted}</Text>
        </View>
        <View style={styles.statsCell}>
          <Text style={[styles.statsNumber, { color: colors.text }]}>{stats.wordsLearned}</Text>
          <Text style={[styles.statsLabel, { color: colors.tabIconDefault }]}>{s.done.wordsLearned}</Text>
        </View>
        <View style={styles.statsCell}>
          <Text style={[styles.statsNumber, { color: colors.text }]}>{stats.wrongLaps}</Text>
          <Text style={[styles.statsLabel, { color: colors.tabIconDefault }]}>{s.done.wrongLaps}</Text>
        </View>
      </View>
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
      {/* UTEMEZO 5. szakasz: a kor vegi egyetlen kerdes, a helyzettol fuggoen
          (fekete=0 review is elfogyott -> tobb uj szo; fekete=0 mert a szinten
          nincs tobb uj szo -> gyakorlas a szintbol). */}
      {ask !== 'none' && !askDismissed && (
        <View style={styles.askBox}>
          <Text style={[styles.topicEmptyText, { color: colors.text }]}>
            {ask === 'more-new' ? s.done.askMoreNew : s.done.askPractise}
          </Text>
          <TextInput
            testID="askNumber"
            style={[styles.askInput, { color: colors.text, borderColor: colors.tabIconDefault }]}
            keyboardType="number-pad"
            value={askInput}
            onChangeText={setAskInput}
          />
          <Pressable
            style={({ pressed }) => [styles.filledBtn, { backgroundColor: colors.tint, marginTop: 12, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => {
              const n = askedN();
              if (ask === 'more-new') onMoreNewWords?.(n);
              else onPractiseLevel?.(n);
              setAskDismissed(true);
            }}
          >
            <Text style={styles.filledBtnText}>{ask === 'more-new' ? s.done.yesThisMany : s.done.yesPractise}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.outlineBtn, { borderColor: colors.tint, marginTop: 10, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => setAskDismissed(true)}
          >
            <Text style={[styles.outlineBtnText, { color: colors.tint }]}>{ask === 'more-new' ? s.done.noEnoughToday : s.done.no}</Text>
          </Pressable>
        </View>
      )}
      {/* FB190: nem a téma fogyott el, hanem a SZINT. A vizsga és a következő
          szint gomb a kerdes alatt marad ajanlatkent. */}
      {levelExhausted && (
        <View style={styles.levelDoneBox}>
          <Pressable
            style={({ pressed }) => [
              styles.filledBtn,
              { backgroundColor: examAvailable ? colors.accent : colors.card, opacity: pressed ? 0.8 : 1 },
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
  // UTEMEZO 5. szakasz: a kor negy szama, 2x2 racs.
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'center', marginBottom: 12, width: '80%' },
  statsCell: { width: '50%', alignItems: 'center', marginBottom: 8 },
  statsNumber: { fontSize: 22, fontWeight: '700' },
  statsLabel: { fontSize: 12, marginTop: 2, textAlign: 'center' },
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
  topicEmptyText: { fontSize: 13, textAlign: 'center', marginTop: 16, paddingHorizontal: 8 },
  // UTEMEZO 5. szakasz: a kor vegi kerdes doboza (szoveg + szammezo + ket gomb).
  askBox: { marginTop: 18, alignSelf: 'stretch', paddingHorizontal: 24 },
  askInput: {
    marginTop: 10,
    marginBottom: 4,
    alignSelf: 'center',
    width: 80,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 16,
  },
  // Kálmán 2026-09-09: a gombok eddig a saját feliratukhoz zsugorodtak
  // (`alignSelf: 'center'`), ezért az egymás alatti gombok más-más szélesek
  // lettek. Egy alak: azonos szélesség, azonos magasság (a kitöltöttön is ott a
  // 1 px átlátszó keret) és azonos betűméret.
  filledBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  // FB190: a szint-vége blokk gombjai egymás alatt, közös szélességgel.
  levelDoneBox: { marginTop: 18, alignSelf: 'stretch', paddingHorizontal: 24 },
  outlineBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  outlineBtnText: { fontSize: 15, fontWeight: '700' },
  filledBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
