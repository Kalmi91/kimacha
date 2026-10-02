import { Pressable, StyleSheet, Text } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { BrutalButton } from '@/components/grammar/Brutal';
import { useGrammarColors } from '@/lib/grammarColors';
import { useTheme } from '@/lib/ThemeContext';

// PLAN-vizsga A. szakasz 2. lépés: a vizsga-képernyők gombja. Classic palettán a
// DESIGN.md 5. pontja szerinti elsődleges (tint + onTint) vagy másodlagos (card +
// border + text) gomb, brutalista palettán a meglévő BrutalButton.
type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  testID?: string;
};

export default function ExamButton({ label, onPress, disabled, secondary, testID }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  if (g.brutal) {
    return <BrutalButton testID={testID} label={label} onPress={onPress} disabled={disabled} fill={secondary ? 'paper' : 'ink'} style={styles.stretch} />;
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary ? { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 } : { backgroundColor: colors.tint },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, { color: secondary ? colors.text : colors.onTint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stretch: { alignSelf: 'stretch' },
  button: {
    minHeight: tapTarget,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  disabled: { opacity: 0.4 },
});
