import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing } from '@/constants/Theme';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { otherWrongTopics, type RoundRun } from '@/lib/grammar/randomRound';
import { Card } from '@/components/grammar/Brutal';

// FB568: the topics of a random grammar round that got a wrong answer but did not fit the capped weak list
// (MAX_WEAK_TOPICS): tappable rows that open the lesson, listed under the weak topics. They are not part of the
// practice. Renders nothing when every wrong topic is weak.
export default function RandomOtherWrong({ run, titleOf }: { run: RoundRun; titleOf: (id: string) => string }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const router = useRouter();
  const ids = otherWrongTopics(run);
  if (ids.length === 0) return null;
  return (
    <View testID="random-other-wrong-list" style={styles.list}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t().randomRound.otherWrongTitle}</Text>
      {ids.map((id) => {
        const asked = run.steps.filter((st) => st.topicId === id);
        return (
          <Pressable key={id} testID={`random-open-${id}`} accessibilityRole="button" accessibilityLabel={titleOf(id)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })} onPress={() => router.push(`/grammar/${id}` as never)}>
            <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
              <View style={styles.row}>
                <Text testID={`random-other-${id}`} style={[styles.rowTitle, { color: colors.text }]}>
                  {titleOf(id)}
                </Text>
                <Text style={[styles.rowValue, { color: colors.textMuted }]}>{`${asked.filter((st) => st.ok).length}/${asked.length}`}</Text>
                <Text style={[styles.rowValue, { color: colors.textMuted }]}>›</Text>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  brutalCard: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, flexShrink: 1 },
  rowValue: { fontSize: fontSize.md },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
});
