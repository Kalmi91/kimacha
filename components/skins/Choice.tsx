import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/KText';

import { BrutalBox } from '@/components/grammar/Brutal';
import { useGrammarColors } from '@/lib/grammarColors';

// PLAN-temak 4D: egy választó-gomb / chip a Témák és a Saját mix képernyőn: brutalista témán
// BrutalBox, classic témán sima kártya. A kijelölt kitöltése `a`, szövege `onA`, előtte "✓"
// (nem csak a szín jelzi a választást).
export default function Choice({
  selected,
  onPress,
  testID,
  label,
  leading,
  style,
}: {
  selected: boolean;
  onPress: () => void;
  testID: string;
  label: string;
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const g = useGrammarColors();
  const color = selected ? g.onA : g.ink;
  const content = (
    <>
      {selected && (
        <Text testID={`${testID}-selected`} style={[styles.check, { color }]}>
          ✓
        </Text>
      )}
      {leading}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </>
  );
  if (g.brutal) {
    return (
      <BrutalBox testID={testID} fill={selected ? 'a' : 'paper'} offset={2} kind="button" onPress={onPress} style={style} boxStyle={styles.box}>
        {content}
      </BrutalBox>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.box, styles.plain, { backgroundColor: selected ? g.a : g.paper }, style]}
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
});
