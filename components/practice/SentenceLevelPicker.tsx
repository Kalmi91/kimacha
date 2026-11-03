import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { themedEdgeStyle } from '@/components/grammar/Themed';
import { t } from '@/lib/i18n';
import { useGrammarColors } from '@/lib/grammarColors';
import { ALL_LEVELS, type SentenceLevel } from '@/lib/sentenceLevel';
import { useTheme } from '@/lib/ThemeContext';

// The level chips on top of the Sentences tab (lib/sentenceLevel.ts): "All" plus the levels that have sentences for the pair.
// Same chip look as the Practice tab's mode chips (components/practice/ModeChips.tsx).
export default function SentenceLevelPicker({ levels, active, onSelect }: { levels: readonly string[]; active: SentenceLevel; onSelect: (level: SentenceLevel) => void }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t().sentenceTab;
  const options: { id: SentenceLevel; title: string; label: string }[] = [
    { id: ALL_LEVELS, title: s.levelAll, label: s.levelAllA11y },
    ...levels.map((level) => ({ id: level as SentenceLevel, title: level, label: s.levelOptionA11y(level) })),
  ];
  return (
    <ScrollView
      testID="sentences-levels"
      accessibilityLabel={s.levelPickerLabel}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((option) => {
        const selected = option.id === active;
        return (
          <Pressable
            key={option.id}
            testID={`sentences-level-${option.id}`}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onSelect(option.id)}
            style={[
              styles.chip,
              themedEdgeStyle(g),
              { backgroundColor: selected ? colors.tint : colors.card, borderColor: selected ? colors.tint : colors.border },
            ]}
          >
            <Text style={[styles.chipText, { color: selected ? colors.onTint : colors.text }]}>{option.title}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexGrow: 0, marginBottom: spacing.md },
  content: { gap: spacing.sm },
  chip: { minHeight: tapTarget, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  chipText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
