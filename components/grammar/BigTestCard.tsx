import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/KText';
import { BrutalBox } from '@/components/grammar/Brutal';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { hasBigTest } from '@/lib/grammar/bigTest';

// The Big test card at the top of the Grammar tab (both skins): the start / continue / start again button and, once a
// result is stored, the "Last result" line that opens it. Nothing for a language without test data.
export default function BigTestCard({ learnedLang, running, level, ready }: { learnedLang: string; running: boolean; level: string | null; ready: boolean }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const router = useRouter();
  const s = t().bigTest;
  if (!hasBigTest(learnedLang)) return null;
  const label = running ? s.continue : level ? s.startAgain : s.start;
  const inner = (
    <>
      <Text style={[styles.title, { color: colors.text }]}>{s.cardTitle}</Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>{s.cardSubtitle}</Text>
      {level ? (
        <Pressable
          testID="big-test-last-result"
          accessibilityRole="button"
          accessibilityLabel={s.lastResult(level)}
          style={styles.lastResult}
          onPress={() => router.push('/grammar/big-test' as never)}
        >
          <Text style={[styles.meta, { color: colors.text }]}>{s.lastResult(level)}</Text>
        </Pressable>
      ) : null}
      <Pressable
        testID="big-test-start"
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.button, g.brutal && styles.brutalButton, { backgroundColor: colors.tint }]}
        // until the saved state is loaded the tap must not drop a run in progress: without ?new=1 the screen resumes the run,
        // shows the stored result or starts a new run by itself
        onPress={() => router.push((running || !ready ? '/grammar/big-test' : '/grammar/big-test?new=1') as never)}
      >
        <Text style={[styles.title, { color: colors.onTint }]}>{label}</Text>
      </Pressable>
    </>
  );
  if (g.brutal) {
    return (
      <BrutalBox testID="big-test-card" fill="paper" boxStyle={styles.card}>
        {inner}
      </BrutalBox>
    );
  }
  return (
    <View testID="big-test-card" style={[styles.card, styles.classic, { backgroundColor: colors.card, borderColor: colors.tint }]}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.xs },
  classic: { borderRadius: radius.lg, borderWidth: 1.5 },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  meta: { fontSize: fontSize.sm },
  // both are finger targets on a phone, so neither may be smaller than the tap target
  lastResult: { minHeight: tapTarget, justifyContent: 'center' },
  // the brutal skin has square buttons everywhere else on the tab
  brutalButton: { borderRadius: 0 },
  button: { minHeight: tapTarget, justifyContent: 'center', borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
});
