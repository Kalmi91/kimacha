import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import { BackButton } from '@/components/grammar/Themed';
import GameFrame from '@/components/practice/GameFrame';
import SpeakButton from '@/components/SpeakButton';
import type { PcicTarget } from '@/data/pcic';
import { t } from '@/lib/i18n';
import type { Lang } from '@/lib/languagePair';
import { speechLang } from '@/lib/languages';
import { speak, stopSpeaking } from '@/lib/speech';
import { speakable, type SpeechStory, type StoryBranch } from '@/lib/speech/stories';
import { useTheme } from '@/lib/ThemeContext';

// The preparation before a story (FB586): every question the character will ask, in the order of the data, with what the learner can
// answer to it, each line with its 🔊 and its translation. Nothing is asked here. A question that only one answer leads to says
// which answer. Start is always on screen, so a repeat run is one tap. A resumed run does not come through here.

interface Props {
  story: SpeechStory;
  target: PcicTarget;
  source: Lang;
  onStart: () => void;
  onBack: () => void;
}

/** The only branch of the story that leads to this turn, or null (none or several lead to it). */
function onlyBranchTo(story: SpeechStory, id: string): StoryBranch | null {
  const into = story.turns.flatMap((turn) => turn.branches.filter((b) => b.next === id));
  return into.length === 1 ? into[0] : null;
}

/** Every way through the story, as the ids of its turns (the story check guarantees there is no cycle). */
function waysFrom(story: SpeechStory, id: string): string[][] {
  const nexts = (story.turns.find((x) => x.id === id)?.branches ?? []).flatMap((b) => (b.next ? [b.next] : []));
  return nexts.length === 0 ? [[id]] : [...new Set(nexts)].flatMap((next) => waysFrom(story, next).map((way) => [id, ...way]));
}

export default function SpeechPrep({ story, target, source, onStart, onBack }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const sx = t().speechTab;
  // leaving the preparation stops what is being read
  useEffect(() => () => stopSpeaking(), []);
  const ways = waysFrom(story, story.turns[0].id);
  const hear = (text: string) => {
    stopSpeaking();
    speak(speakable(text), speechLang(target));
  };
  // the lines under a caption: what answers the turn, or (back) what she can be asked back
  const sayRows = (turn: SpeechStory['turns'][number], i: number, back: boolean) =>
    turn.branches.flatMap((b, j) =>
      Boolean(b.back) !== back
        ? []
        : b.say.map((line, k) => (
            <View key={`${j}-${k}`} style={styles.row}>
              <SpeakButton
                testID={`speech-prep-say-listen-${i}-${j}-${k}`}
                accessibilityLabel={sx.listen}
                onPress={() => hear(line[story.target])}
                style={styles.speakBtn}
                iconStyle={styles.speakIcon}
              />
              <View style={styles.texts}>
                <Text testID={`speech-prep-say-${i}-${j}-${k}`} style={[styles.sayLine, { color: colors.text }]}>{line[story.target]}</Text>
                <Text style={[styles.translation, { color: colors.textMuted }]}>{line[source]}</Text>
              </View>
            </View>
          )),
    );
  return (
    <GameFrame
      testID="speech-screen"
      target={target}
      currentCard={`speech-prep:${story.id}`}
      hideLevelCounter
      scrollToEndOnDock={false}
      top={
        <View style={styles.top}>
          <BackButton testID="speech-back" onPress={onBack} pressStyle={styles.backPress} arrowStyle={[styles.backArrow, { color: colors.text }]} />
          <Text style={[styles.heading, { color: colors.text }]}>{sx.getReady}</Text>
        </View>
      }
      dock={{ testID: 'speech-start', label: sx.start, tone: 'next', onPress: onStart }}
    >
      <View style={styles.box}>
        {story.turns.map((turn, i) => {
          // the questions about her after the talk are a surprise: not listed
          if (turn.recall) return null;
          // only a turn that not every way goes through says which answer leads to it
          const from = ways.every((way) => way.includes(turn.id)) ? null : onlyBranchTo(story, turn.id);
          return (
            <Card key={turn.id} classicStyle={styles.card} boxStyle={styles.brutalCard}>
              <View testID={`speech-prep-turn-${i}`} style={styles.group}>
                <Text style={[styles.caption, { color: colors.textMuted }]}>{sx.prepAsks(story.speaker)}</Text>
                <View style={styles.row}>
                  <SpeakButton
                    testID={`speech-prep-listen-${i}`}
                    accessibilityLabel={sx.listen}
                    onPress={() => hear(turn[story.target])}
                    style={styles.speakBtn}
                    iconStyle={styles.speakIcon}
                  />
                  <View style={styles.texts}>
                    <Text testID={`speech-prep-line-${i}`} style={[styles.line, { color: colors.text }]}>{turn[story.target]}</Text>
                    <Text style={[styles.translation, { color: colors.textMuted }]}>{turn[source]}</Text>
                  </View>
                </View>
                {from && (
                  <Text testID={`speech-prep-from-${i}`} style={[styles.from, { color: colors.textMuted }]}>
                    {sx.leadsFrom(speakable(from.say[0][story.target]))}
                  </Text>
                )}
                <Text style={[styles.caption, { color: colors.textMuted }]}>{sx.canSay}</Text>
                {sayRows(turn, i, false)}
                {turn.branches.some((b) => b.back) && (
                  <>
                    <Text testID={`speech-prep-ask-${i}`} style={[styles.caption, { color: colors.textMuted }]}>{sx.canAsk}</Text>
                    {sayRows(turn, i, true)}
                  </>
                )}
              </View>
            </Card>
          );
        })}
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backPress: { minHeight: tapTarget, minWidth: tapTarget, justifyContent: 'center' },
  backArrow: { fontSize: fontSize.xxl },
  heading: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  box: { marginHorizontal: spacing.xl, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  brutalCard: { padding: spacing.lg, gap: spacing.sm },
  group: { gap: spacing.xs },
  caption: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  speakBtn: { minHeight: tapTarget, minWidth: tapTarget, alignItems: 'center', justifyContent: 'center' },
  speakIcon: { fontSize: fontSize.xl },
  texts: { flex: 1 },
  line: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  sayLine: { fontSize: fontSize.md },
  translation: { fontSize: fontSize.sm },
  from: { fontSize: fontSize.sm, fontStyle: 'italic' },
});
