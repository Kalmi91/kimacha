import { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/KText';
import { BrutalBox } from '@/components/grammar/Brutal';
import Colors from '@/constants/Colors';
import type { Level } from '@/data/words';
import { useGrammarColors } from '@/lib/grammarColors';
import { levelDone, levelPercent } from '@/lib/grammar/levelTest';
import type { TopicEvidence } from '@/lib/grammar/randomRound';
import { hasLesson, syllabusForLevel } from '@/lib/grammar/syllabus';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';

// FB571: the level test button of the Grammar tab (under a level's header): the level's test percent (the average of
// its written topics' random-round test percent), a tick once every topic is ticked off. It opens
// app/grammar/level-test.tsx. A level without any written lesson has no button.
export default function LevelTestButton({
  level,
  learnedLang,
  evidence,
}: {
  level: Level;
  learnedLang: string;
  evidence: Map<string, TopicEvidence>;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const router = useRouter();
  const ids = useMemo(
    () => syllabusForLevel(level, learnedLang).filter((tp) => hasLesson(learnedLang, tp.id)).map((tp) => tp.id),
    [level, learnedLang]
  );
  if (ids.length === 0) return null;
  const done = levelDone(ids, evidence);
  const label = `${done ? '✓ ' : ''}🎯 ${t().levelTest.button} · ${levelPercent(ids, evidence)}%`;
  const open = () => router.push(`/grammar/level-test?level=${level}` as never);
  if (g.brutal) {
    return (
      <BrutalBox testID={`grammar-level-test-${level}`} fill={done ? 'a' : 'paper'} onPress={open} boxStyle={styles.brutal}>
        <Text variant="title" style={[styles.brutalText, { color: done ? g.onFill : g.ink }]}>{label}</Text>
      </BrutalBox>
    );
  }
  return (
    <Pressable
      testID={`grammar-level-test-${level}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.classic, { backgroundColor: colors.card, borderColor: done ? colors.successFill : colors.tint }]}
      onPress={open}
    >
      <Text style={[styles.classicText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  classic: { borderRadius: 12, borderWidth: 1.5, paddingVertical: 10, paddingHorizontal: 14 },
  classicText: { fontSize: 14, fontWeight: '700' },
  brutal: { paddingVertical: 10, paddingHorizontal: 12 },
  brutalText: { fontSize: 14, fontWeight: '500', textTransform: 'uppercase' },
});
