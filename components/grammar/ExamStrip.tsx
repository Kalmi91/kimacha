import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/KText';
import { BrutalBox } from '@/components/grammar/Brutal';
import Colors from '@/constants/Colors';
import type { Level } from '@/data/words';
import type { PcicTarget } from '@/data/pcic';
import { EXAM_LEVELS } from '@/lib/exam/types';
import { mockAvailable } from '@/lib/exam/mock/blueprint';
import { levelHasLesson, type ExamLevelStatus } from '@/lib/exam/unlock';
import { useGrammarColors } from '@/lib/grammarColors';
import { hasTopicPercent, levelDone, levelPercent, shownLabel, weakestTopics } from '@/lib/grammar/levelTest';
import type { TopicEvidence } from '@/lib/grammar/randomRound';
import { topicKindCount } from '@/lib/grammar/randomRoundView';
import { hasLesson, syllabusForLevel, syllabusTopic } from '@/lib/grammar/syllabus';
import { useLevelShown } from '@/lib/grammar/useLevelShown';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';

type ExamLevel = (typeof EXAM_LEVELS)[number];

function StripButton({
  testID,
  label,
  onPress,
  disabled,
  highlight,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  if (g.brutal) {
    return (
      <View style={disabled ? styles.dim : undefined}>
        <BrutalBox
          testID={testID}
          kind="button"
          fill={highlight ? 'a' : 'paper'}
          onPress={onPress}
          disabled={disabled}
          boxStyle={styles.brutalButton}
        >
          <Text variant="title" style={[styles.brutalButtonText, { color: highlight ? g.onFill : g.ink }]}>{label}</Text>
        </BrutalBox>
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      style={[styles.classicButton, { backgroundColor: colors.card, borderColor: highlight ? colors.successFill : colors.tint }, disabled && styles.dim]}
      onPress={onPress}
    >
      <Text style={[styles.classicButtonText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

// The exam strip of the Grammar tab (under a level's header, in place of the old lone level test button): the level's
// grammar readiness, its weakest topics, and the entries to the level test, the level exam and the mock exam.
// A level without any written lesson has no strip. `examStatus` undefined = not loaded yet (the exam button is disabled).
export default function ExamStrip({
  level,
  learnedLang,
  contentLang,
  evidence,
  examStatus,
}: {
  level: Level;
  learnedLang: string;
  contentLang: string;
  evidence: Map<string, TopicEvidence>;
  examStatus?: ExamLevelStatus;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const router = useRouter();
  const s = t();
  const ids = useMemo(
    () => syllabusForLevel(level, learnedLang).filter((tp) => hasLesson(learnedLang, tp.id)).map((tp) => tp.id),
    [level, learnedLang]
  );
  // the standing (never sinks, grows with right answers), the same number as the test's bar and the syllabus header
  const pct = useLevelShown(`${contentLang}→${learnedLang}`, level, levelPercent(ids, evidence), evidence);
  if (ids.length === 0) return null;

  const x = s.examStrip;
  const done = levelDone(ids, evidence, (id) => topicKindCount(learnedLang, contentLang, id));
  const weak = weakestTopics(ids, evidence);
  const examLevel = (EXAM_LEVELS as readonly string[]).includes(level) && levelHasLesson(level as ExamLevel, learnedLang);
  const mockOpen = mockAvailable(learnedLang as PcicTarget, level);
  const ink = g.brutal ? g.ink : colors.text;
  const muted = g.brutal ? g.mu : colors.tabIconDefault;

  const lockNotes: string[] = [];
  if (examStatus && !examStatus.unlocked) {
    if (examStatus.missing > 0) lockNotes.push(s.exam.rowLocked(examStatus.learned, examStatus.needed, examStatus.missing));
    if (!examStatus.lessonDone) lockNotes.push(x.needLesson);
  }

  const body: ReactNode = (
    <>
      <View style={styles.titleRow}>
        <Text testID={`grammar-exam-strip-title-${level}`} style={[styles.title, { color: ink }]}>{`${done ? '✓ ' : ''}${x.title(level)}`}</Text>
        {pct === null ? null : (
          <Text testID={`grammar-exam-strip-pct-${level}`} style={[styles.ready, { color: muted }]}>{x.ready(shownLabel(pct))}</Text>
        )}
      </View>
      {hasTopicPercent(ids, evidence) ? (
        weak.length > 0 ? (
          <View style={styles.weakBlock}>
            <Text style={[styles.weakLabel, { color: muted }]}>{x.weakest}</Text>
            {weak.map((w) => {
              const topic = syllabusTopic(w.id, learnedLang);
              return (
                <Pressable
                  key={w.id}
                  testID={`grammar-exam-weak-${level}-${w.id}`}
                  accessibilityRole="button"
                  style={styles.weakRow}
                  onPress={() => router.push(`/grammar/${w.id}` as never)}
                >
                  <Text style={[styles.weakTitle, { color: ink }]} numberOfLines={1}>{topic ? (topic.title[contentLang] ?? topic.title.en) : w.id}</Text>
                  <Text style={[styles.weakPct, { color: muted }]}>{`${w.pct}%`}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text testID={`grammar-exam-noweak-${level}`} style={[styles.note, { color: muted }]}>{x.noWeak}</Text>
        )
      ) : (
        <Text testID={`grammar-exam-nodata-${level}`} style={[styles.note, { color: muted }]}>{x.noData}</Text>
      )}
      <View style={styles.buttons}>
        <StripButton
          testID={`grammar-level-test-${level}`}
          label={`🎯 ${s.levelTest.button}`}
          highlight={done}
          onPress={() => router.push(`/grammar/level-test?level=${level}` as never)}
        />
        {examLevel && examStatus?.total !== 0 ? (
          <StripButton
            testID={`grammar-exam-open-${level}`}
            label={x.levelExam}
            disabled={!examStatus || !examStatus.unlocked}
            onPress={() => router.push({ pathname: '/exam', params: { level } } as never)}
          />
        ) : null}
        {mockOpen ? (
          <StripButton
            testID={`grammar-mock-open-${level}`}
            label={x.mockExam}
            onPress={() => router.push({ pathname: '/mock-exam', params: { level } } as never)}
          />
        ) : null}
      </View>
      {lockNotes.length > 0 ? (
        <View testID={`grammar-exam-lock-${level}`}>
          {lockNotes.map((note) => (
            <Text key={note} style={[styles.note, { color: muted }]}>{note}</Text>
          ))}
        </View>
      ) : null}
    </>
  );

  if (g.brutal) {
    return (
      <View testID={`grammar-exam-strip-${level}`}>
        <BrutalBox fill="paper" boxStyle={styles.brutalBox}>{body}</BrutalBox>
      </View>
    );
  }
  return (
    <View testID={`grammar-exam-strip-${level}`} style={[styles.classic, { backgroundColor: colors.card, borderColor: done ? colors.successFill : colors.border }]}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  classic: { borderRadius: 12, borderWidth: 1.5, paddingVertical: 10, paddingHorizontal: 14, gap: 6 },
  brutalBox: { paddingVertical: 10, paddingHorizontal: 12, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 8 },
  title: { fontSize: 15, fontWeight: '700' },
  ready: { fontSize: 12 },
  weakBlock: { gap: 2 },
  weakLabel: { fontSize: 12, fontWeight: '600' },
  weakRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 4 },
  weakTitle: { fontSize: 14, flexShrink: 1 },
  weakPct: { fontSize: 13 },
  note: { fontSize: 12 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  dim: { opacity: 0.45 },
  classicButton: { borderRadius: 12, borderWidth: 1.5, paddingVertical: 8, paddingHorizontal: 12 },
  classicButtonText: { fontSize: 14, fontWeight: '700' },
  brutalButton: { paddingVertical: 8, paddingHorizontal: 10 },
  brutalButtonText: { fontSize: 13, fontWeight: '500', textTransform: 'uppercase' },
});
