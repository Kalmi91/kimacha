import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { themedEdgeStyle } from '@/components/grammar/Themed';
import { t } from '@/lib/i18n';
import { useGrammarColors } from '@/lib/grammarColors';
import { useTheme } from '@/lib/ThemeContext';

// The mode chips on top of the Practice tab (components/practice/modes.ts): Reading plus the games that are switched on.
export interface ModeChip {
  id: string;
  title: string;
}

export default function ModeChips({ chips, activeId, onSelect }: { chips: ModeChip[]; activeId: string; onSelect: (id: string) => void }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  return (
    <ScrollView
      testID="practice-modes"
      accessibilityLabel={t().practiceTab.modesLabel}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((chip) => {
        const selected = chip.id === activeId;
        return (
          <Pressable
            key={chip.id}
            testID={`practice-mode-${chip.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(chip.id)}
            style={[
              styles.chip,
              themedEdgeStyle(g),
              { backgroundColor: selected ? colors.tint : colors.card, borderColor: selected ? colors.tint : colors.border },
            ]}
          >
            <Text style={[styles.chipText, { color: selected ? colors.onTint : colors.text }]}>{chip.title}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexGrow: 0 },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm },
  chip: { minHeight: tapTarget, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  chipText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
