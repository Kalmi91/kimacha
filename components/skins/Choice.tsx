import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/KText';

import { BrutalBox } from '@/components/grammar/Brutal';
import { useGrammarColors } from '@/lib/grammarColors';

// a picker button / chip on the Themes and My mix screens: a BrutalBox on the
// brutalist theme, a plain card on the classic theme. The selected one is filled with `a`, its text is `onA`, preceded by "✓"
// (colour alone does not signal the selection). `stacked` = the ✓ + prefix (icon) on a
// separate row ABOVE the label, with a smaller one-line label, so it does not overflow even in 3 columns.
export default function Choice({
  selected,
  onPress,
  testID,
  label,
  leading,
  stacked = false,
  style,
}: {
  selected: boolean;
  onPress: () => void;
  testID: string;
  label: string;
  leading?: ReactNode;
  stacked?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const g = useGrammarColors();
  const color = selected ? g.onA : g.ink;
  const check = selected && (
    <Text testID={`${testID}-selected`} style={[styles.check, { color }]}>
      ✓
    </Text>
  );
  const content = stacked ? (
    <>
      <View style={styles.stackTop}>
        {check}
        {leading}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.text, styles.stackText, { color }]}>
        {label}
      </Text>
    </>
  ) : (
    <>
      {check}
      {leading}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </>
  );
  const boxStyle = stacked ? [styles.box, styles.stackBox] : styles.box;
  if (g.brutal) {
    return (
      <BrutalBox testID={testID} fill={selected ? 'a' : 'paper'} offset={2} kind="button" onPress={onPress} style={style} boxStyle={boxStyle}>
        {content}
      </BrutalBox>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={[boxStyle, styles.plain, { backgroundColor: selected ? g.a : g.paper }, style]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 12 },
  plain: { borderRadius: 14 },
  text: { fontSize: 14, fontWeight: '600' },
  check: { fontSize: 14, fontWeight: '700' },
  // flex: 1 + centred: the front face fills the outer box stretched by the taller sibling
  // (otherwise the shadow would hang below the box).
  stackBox: { flexDirection: 'column', gap: 2, flex: 1 },
  stackTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  stackText: { fontSize: 11, textAlign: 'center' },
});
