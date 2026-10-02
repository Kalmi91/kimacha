import { Pressable, StyleSheet, Text } from 'react-native';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, spacing, tapTarget } from '@/constants/Theme';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';

// PLAN-vizsga C. szakasz (C1 a): a halk belépő a szint-sorok alatt, az onboarding szint-lépésén
// és a szintválasztó lapon is; a szint-sorok közvetlenül választhatók maradnak.
export default function PlacementEntry({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  return (
    <Pressable testID="placement-entry" accessibilityRole="button" onPress={onPress} style={styles.entry}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{t().placement.entry}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  entry: { minHeight: tapTarget, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'center', textDecorationLine: 'underline' },
});
