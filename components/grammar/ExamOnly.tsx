import { Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { legibleOn } from '@/constants/Skins';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import type { Level } from '@/data/words';
import { examTopicsOnly, syllabusForLevel } from '@/lib/grammar/syllabus';

// The "exam topics only" parts of the Grammar tab (app/(tabs)/course.tsx). The switch is VIEW ONLY: the level percent, the
// level test, the exam round and the exam strip keep counting every topic.

/** The chip: one per screen, a switch with a clearly marked on state. */
export function ExamOnlyChip({ on, onPress }: { on: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const textColor = g.brutal ? (on ? g.onFill : g.ink) : on ? colors.onTint : colors.text;
  return (
    <Pressable
      testID="grammar-exam-only"
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={[
        styles.chip,
        g.brutal
          ? { borderColor: g.ink, backgroundColor: on ? g.a : g.paper }
          : { borderColor: on ? colors.tint : colors.tabIconDefault, backgroundColor: on ? colors.tint : colors.card },
      ]}
    >
      <Text style={[styles.chipText, { color: textColor }]}>{`${on ? '✓ ' : ''}${t().grammar.examOnly}`}</Text>
    </Pressable>
  );
}

/** The muted note above the first unit of a level while the filter is on: the hidden count, or "every topic". */
export function ExamOnlyNote({ level, learnedLang, color }: { level: Level; learnedLang: string; color: string }) {
  const s = t().grammar;
  const all = syllabusForLevel(level, learnedLang);
  const hidden = all.length - examTopicsOnly(all).length;
  return (
    <Text testID={`grammar-exam-only-note-${level}`} style={[styles.note, { color }]}>
      {hidden > 0 ? s.examOnlyHidden(hidden) : s.examOnlyAll}
    </Text>
  );
}

/** The classic look's exam tag (the brutal look uses a Sticker); same pattern as the core tag, in the theme tint. */
export function ExamTagClassic({ topicId }: { topicId: string }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  return (
    <Text testID={`grammar-exam-tag-${topicId}`} style={[styles.tag, { color: legibleOn(colors.tint, colors.card), borderColor: colors.tint }]}>
      {t().grammar.examTag}
    </Text>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  chipText: { fontSize: 13, fontWeight: '700' },
  note: { fontSize: 11 },
  tag: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
});
