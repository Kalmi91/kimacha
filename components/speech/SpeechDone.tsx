import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, spacing, tapTarget } from '@/constants/Theme';
import { accentColor } from '@/components/grammar/Themed';
import GameFrame from '@/components/practice/GameFrame';
import type { PcicTarget } from '@/data/pcic';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import type { Lang } from '@/lib/languagePair';
import type { SpeechStory, StoryRun } from '@/lib/speech/stories';
import { useTheme } from '@/lib/ThemeContext';

// The end of a story: the closing words, how many answers were right the first time, and what next (the same story again, or
// the list). Reaching it dropped the saved run and wrote the progress row (components/speech/SpeechTab.tsx).

interface Props {
  story: SpeechStory;
  run: StoryRun;
  target: PcicTarget;
  source: Lang;
  onAgain: () => void;
  onList: () => void;
}

export default function SpeechDone({ story, run, target, source, onAgain, onList }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const sx = t().speechTab;
  return (
    <GameFrame
      testID="speech-screen"
      target={target}
      currentCard={`speech-done:${story.id}`}
      hideLevelCounter
      centered
      dock={{ testID: 'speech-again', label: sx.again, tone: 'next', onPress: onAgain }}
    >
      <Text testID="speech-done" variant="title" style={[styles.title, { color: colors.text }]}>{sx.done}</Text>
      <Text style={[styles.outro, { color: colors.textMuted }]}>{story.outro[source]}</Text>
      <View style={styles.scoreBox}>
        <Text testID="speech-score" style={[styles.score, { color: colors.text }]}>{`${run.firstTry}/${story.turns.length}`}</Text>
        <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>{sx.rightFirstTime}</Text>
      </View>
      <Pressable testID="speech-to-list" accessibilityRole="button" onPress={onList} style={styles.link}>
        <Text style={[styles.linkText, { color: accentColor(g, colors.tint) }]}>{sx.backToStories}</Text>
      </Pressable>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, textAlign: 'center' },
  outro: { fontSize: fontSize.md, textAlign: 'center' },
  scoreBox: { alignItems: 'center', gap: spacing.xs },
  score: { fontSize: 48, fontWeight: fontWeight.bold },
  scoreLabel: { fontSize: fontSize.md, textAlign: 'center' },
  link: { minHeight: tapTarget, justifyContent: 'center', alignItems: 'center' },
  linkText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textDecorationLine: 'underline' },
});
