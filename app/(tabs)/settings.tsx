import { StyleSheet, Text, View, Pressable } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';

export default function SettingsScreen() {
  const { theme, override, setOverride } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const options: { label: string; value: 'system' | 'light' | 'dark' }[] = [
    { label: '🔄 Auto', value: 'system' },
    { label: '☀️ Light', value: 'light' },
    { label: '🌙 Dark', value: 'dark' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{s.tabs.settings}</Text>

      <View style={styles.optionGroup}>
        {options.map(opt => (
          <Pressable
            key={opt.value}
            style={[
              styles.option,
              { backgroundColor: override === opt.value ? colors.tint : colors.card },
            ]}
            onPress={() => setOverride(opt.value)}
          >
            <Text style={[styles.optionText, { color: override === opt.value ? '#FFF' : colors.text }]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  optionGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  option: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
