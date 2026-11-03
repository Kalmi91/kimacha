// Settings: the two tabs at the top of the screen, "General" and "Voice". The pills follow the sentence-engine
// pills of BetterVoiceRows (a border in the accent color when selected), so they read the same on both palettes.

import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';

export type SettingsTab = 'general' | 'voice';

export default function SettingsTabs({ tab, onChange }: { tab: SettingsTab; onChange: (tab: SettingsTab) => void }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t().settings;
  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: s.tabGeneral },
    { id: 'voice', label: s.tabVoice },
  ];
  return (
    <View style={styles.bar}>
      {tabs.map(({ id, label }) => {
        const selected = tab === id;
        return (
          <Pressable
            key={id}
            testID={`settings-tab-${id}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.pill, { borderColor: selected ? g.a : colors.tabIconDefault, borderWidth: selected ? 2 : 1 }]}
            onPress={() => onChange(id)}
          >
            <Text style={[styles.pillText, { color: selected ? g.ink : colors.tabIconDefault }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pill: { flex: 1, alignItems: 'center', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  pillText: { fontSize: 14, fontWeight: '700' },
});
