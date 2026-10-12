import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { SkinBackdrop } from '@/components/skins/Slots';
import { t } from '@/lib/i18n';

// Empty placeholder of a beta tab that has no content yet: the title and a "Coming soon" line.
export default function ComingSoon({ title, testID }: { title: string; testID?: string }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  return (
    <View testID={testID} style={[styles.screen, { backgroundColor: colors.background }]}>
      <SkinBackdrop />
      <View style={styles.content}>
        <Text variant="title" style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle]}>{title}</Text>
        <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{t().tabs.comingSoon}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, paddingTop: 40 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
  hint: { fontSize: 16, fontWeight: '500' },
});
