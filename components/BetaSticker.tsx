import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/KText';
import { Sticker } from '@/components/grammar/Brutal';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';

export function BetaSticker({ testID }: { testID?: string }) {
  const g = useGrammarColors();
  const s = t();
  return (
    <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={s.a11y.beta} style={styles.container}>
      {g.brutal ? (
        <Sticker label={s.common.beta} />
      ) : (
        <Text numberOfLines={1} style={[styles.label, { backgroundColor: g.a, color: g.onA }]}>
          {s.common.beta}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexShrink: 0, justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
});
