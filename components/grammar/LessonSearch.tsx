import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';

// The search field of the Grammar tab. It sits above the scrolling list (not inside it), so it stays
// visible while the keyboard is open.
export default function LessonSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t();
  const ink = g.brutal ? g.ink : colors.text;
  const muted = g.brutal ? g.mu : colors.tabIconDefault;
  return (
    <View
      style={[
        styles.row,
        g.brutal
          ? { backgroundColor: g.bg, borderColor: g.ink, borderWidth: 2 }
          : { backgroundColor: colors.card, borderColor: colors.tabIconDefault, borderWidth: 1 },
      ]}
    >
      <TextInput
        testID="grammar-search-input"
        value={value}
        onChangeText={onChange}
        placeholder={s.grammar.searchPlaceholder}
        placeholderTextColor={muted}
        accessibilityLabel={s.grammar.searchPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={[styles.input, { color: ink }]}
      />
      {value.length > 0 ? (
        <Pressable
          testID="grammar-search-clear"
          accessibilityRole="button"
          accessibilityLabel={s.grammar.searchClear}
          hitSlop={8}
          onPress={() => onChange('')}
        >
          <Text style={[styles.clear, { color: ink }]}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginBottom: 8, paddingHorizontal: 12, borderRadius: 12 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  clear: { fontSize: 16, fontWeight: '700', paddingHorizontal: 4 },
});
