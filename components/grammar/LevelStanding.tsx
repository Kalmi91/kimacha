import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import type { Level } from '@/data/words';
import { ProgressBar } from '@/components/grammar/Themed';
import { levelPercent, shownLabel } from '@/lib/grammar/levelTest';
import type { TopicEvidence } from '@/lib/grammar/randomRound';
import { hasLesson, syllabusForLevel } from '@/lib/grammar/syllabus';
import { useLevelShown } from '@/lib/grammar/useLevelShown';
import { useGrammarColors } from '@/lib/grammarColors';
import { useTheme } from '@/lib/ThemeContext';

// FB616: the level's standing under a syllabus level header: the percent and a thin bar, the same number the level test's
// bar and the test button show (lib/grammar/useLevelShown.ts), so a level test can raise it.
export default function LevelStanding({
  level,
  learnedLang,
  contentLang,
  evidence,
}: {
  level: Level;
  learnedLang: string;
  contentLang: string;
  evidence: Map<string, TopicEvidence>;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const ids = useMemo(
    () => syllabusForLevel(level, learnedLang).filter((tp) => hasLesson(learnedLang, tp.id)).map((tp) => tp.id),
    [level, learnedLang]
  );
  const pct = useLevelShown(`${contentLang}→${learnedLang}`, level, levelPercent(ids, evidence), evidence);
  if (ids.length === 0) return null;
  return (
    <View testID={`grammar-level-standing-${level}`} style={styles.row}>
      <Text testID={`grammar-level-standing-pct-${level}`} style={[styles.pct, { color: g.brutal ? g.mu : colors.tabIconDefault }]}>{`${shownLabel(pct)}%`}</Text>
      <View style={styles.bar}>
        <ProgressBar
          continuous
          pct={pct}
          brutalStyle={styles.brutal}
          trackStyle={styles.track}
          trackColor={colors.border}
          fillStyle={styles.fill}
          fillColor={colors.tint}
          fillProps={{ testID: `grammar-level-standing-fill-${level}` }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pct: { fontSize: 12, minWidth: 36 },
  bar: { flex: 1 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  brutal: { height: 8 },
});
