import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/KText';
import { BrutalBox } from '@/components/grammar/Brutal';
import { ProgressBar } from '@/components/grammar/Themed';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import type { Level } from '@/data/words';
import { levelPercent, shownLabel } from '@/lib/grammar/levelTest';
import { levelTestRoute, hasSmallTest } from '@/lib/grammar/levelTestRoute';
import { hasSavedSmallRun } from '@/lib/grammar/smallTest';
import { getDb } from '@/lib/database';
import type { TopicEvidence } from '@/lib/grammar/randomRound';
import { hasLesson, syllabusForLevel } from '@/lib/grammar/syllabus';
import { useLevelShown } from '@/lib/grammar/useLevelShown';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';

// The level part of the Grammar tab (both skins): the A1-C1 level buttons (one level selected, its lessons are listed
// below by the tab), the overall "Your level" bar and one test row per level with the level's standing.

export function LevelButtons({ levels, selected, current, onSelect }: { levels: Level[]; selected: Level; current: Level; onSelect: (l: Level) => void }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t().levelTabs;
  return (
    <View testID="grammar-level-buttons" style={styles.chipRow}>
      {levels.map((lvl) => {
        const on = lvl === selected;
        const label = s.levelButton(lvl);
        if (g.brutal) {
          return (
            <BrutalBox
              key={lvl}
              testID={`grammar-level-${lvl}`}
              fill={on ? 'a' : 'paper'}
              style={styles.chipOuter}
              boxStyle={styles.brutalChip}
              accessibilityLabel={label}
              accessibilityState={{ selected: on }}
              onPress={() => onSelect(lvl)}
            >
              <Text style={[styles.chipText, { color: on ? g.onFill : g.ink }]}>{lvl}</Text>
            </BrutalBox>
          );
        }
        return (
          <Pressable
            key={lvl}
            testID={`grammar-level-${lvl}`}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: on }}
            style={[
              styles.chipOuter,
              styles.classicChip,
              { backgroundColor: on ? colors.tint : colors.card, borderColor: on || lvl === current ? colors.tint : colors.border },
            ]}
            onPress={() => onSelect(lvl)}
          >
            <Text style={[styles.chipText, { color: on ? colors.onTint : colors.text }]}>{lvl}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// "Your level: A2 · overall 34%": the level is the last Big test's, the percent the existing overall score of the tab.
export function OverallBar({ level, pct }: { level: string; pct: number }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const text = t().levelTabs.yourOverall(level, pct);
  const bar = (
    <ProgressBar
      continuous
      pct={pct}
      brutalStyle={styles.brutalBar}
      trackStyle={styles.track}
      trackColor={colors.border}
      fillStyle={styles.fill}
      fillColor={colors.tint}
      fillProps={{ testID: 'grammar-overall-fill' }}
    />
  );
  if (g.brutal) {
    return (
      <BrutalBox testID="grammar-overall" fill="paper" boxStyle={styles.card}>
        <Text testID="grammar-overall-bar" style={[styles.cardTitle, { color: g.ink }]}>{text}</Text>
        {bar}
      </BrutalBox>
    );
  }
  return (
    <View testID="grammar-overall" style={[styles.card, styles.classicCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text testID="grammar-overall-bar" style={[styles.cardTitle, { color: colors.text }]}>{text}</Text>
      {bar}
    </View>
  );
}

function LevelTestRow({
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
  const router = useRouter();
  const s = t().levelTabs;
  const ids = useMemo(
    () => syllabusForLevel(level, learnedLang).filter((tp) => hasLesson(learnedLang, tp.id)).map((tp) => tp.id),
    [level, learnedLang]
  );
  // the same number as the level header's standing and the level test's bar (lib/grammar/useLevelShown.ts)
  const pct = useLevelShown(`${contentLang}→${learnedLang}`, level, levelPercent(ids, evidence), evidence);
  const shown = pct === null ? null : shownLabel(pct);
  const label = s.testRow(level, shown);
  const empty = ids.length === 0;
  const pair = `${contentLang}→${learnedLang}`;
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!hasSmallTest(level)) return;
    hasSavedSmallRun(getDb(), pair, level)
      .catch(() => false)
      .then((v) => {
        if (alive) setSaved(v);
      });
    return () => {
      alive = false;
    };
  }, [pair, level, evidence]);
  const open = () => router.push(levelTestRoute(level) as never);
  const bar = (
    <ProgressBar
      continuous
      pct={pct ?? 0}
      brutalStyle={styles.brutalBar}
      trackStyle={styles.track}
      trackColor={colors.border}
      fillStyle={styles.fill}
      fillColor={colors.tint}
      fillProps={{ testID: `grammar-test-row-fill-${level}` }}
    />
  );
  if (g.brutal) {
    return (
      <BrutalBox
        testID={`grammar-test-row-${level}`}
        fill="paper"
        disabled={empty}
        dashed={empty}
        accessibilityLabel={label}
        boxStyle={styles.rowBox}
        onPress={open}
      >
        <Text style={[styles.rowText, { color: empty ? g.mu : g.ink }]}>{label}</Text>
        {saved && hasSmallTest(level) ? <Text testID={`grammar-test-row-resume-${level}`} style={[styles.rowText, { color: g.mu }]}>{s.resume}</Text> : null}
        {bar}
      </BrutalBox>
    );
  }
  return (
    <Pressable
      testID={`grammar-test-row-${level}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: empty }}
      disabled={empty}
      style={[styles.rowBox, styles.classicCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: empty ? 0.45 : 1 }]}
      onPress={open}
    >
      <Text style={[styles.rowText, { color: colors.text }]}>{label}</Text>
      {saved && hasSmallTest(level) ? <Text testID={`grammar-test-row-resume-${level}`} style={[styles.rowText, { color: colors.tabIconDefault }]}>{s.resume}</Text> : null}
      {bar}
    </Pressable>
  );
}

export function LevelTestRows({
  levels,
  learnedLang,
  contentLang,
  evidence,
}: {
  levels: Level[];
  learnedLang: string;
  contentLang: string;
  evidence: Map<string, TopicEvidence>;
}) {
  return (
    <View testID="grammar-test-rows" style={styles.rows}>
      {levels.map((lvl) => (
        <LevelTestRow key={lvl} level={lvl} learnedLang={learnedLang} contentLang={contentLang} evidence={evidence} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chipOuter: { flex: 1 },
  chipText: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  // both skins: a finger target, never smaller than the tap target
  brutalChip: { minHeight: tapTarget, justifyContent: 'center', alignItems: 'center' },
  classicChip: { minHeight: tapTarget, justifyContent: 'center', alignItems: 'center', borderRadius: radius.md, borderWidth: 1.5 },
  card: { padding: spacing.md, gap: spacing.xs },
  classicCard: { borderRadius: radius.lg, borderWidth: 1 },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  rows: { gap: spacing.sm },
  rowBox: { minHeight: tapTarget, justifyContent: 'center', padding: spacing.md, gap: spacing.xs },
  rowText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  brutalBar: { height: 8 },
});
