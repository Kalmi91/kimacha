import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { fontSize, fontWeight, radius, spacing, tapTarget } from '@/constants/Theme';
import { Card } from '@/components/grammar/Brutal';
import { BackButton, themedEdgeStyle } from '@/components/grammar/Themed';
import GameFrame from '@/components/practice/GameFrame';
import SpeakButton from '@/components/SpeakButton';
import type { PcicTarget } from '@/data/pcic';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import type { Lang } from '@/lib/languagePair';
import { speechLang } from '@/lib/languages';
import { speak, stopSpeaking } from '@/lib/speech';
import type { AnswerMode, SpeechStory, StoryWord } from '@/lib/speech/stories';
import { useTheme } from '@/lib/ThemeContext';

// The screen before a story: what it is about, the words in it the learner does not know yet (🔊 + meaning), and how the learner
// answers (by voice or typed). Without a speech recognizer on the device the voice segment is off and typing is the way.

interface Props {
  story: SpeechStory;
  target: PcicTarget;
  source: Lang;
  /** The words of the story the learner does not know yet. */
  words: readonly StoryWord[];
  mode: AnswerMode;
  /** The device has a speech recognizer. */
  micOk: boolean;
  onMode: (mode: AnswerMode) => void;
  onStart: () => void;
  onBack: () => void;
}

export default function SpeechIntro({ story, target, source, words, mode, micOk, onMode, onStart, onBack }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const sx = t().speechTab;
  // no recognizer = typing, whatever was chosen before
  const chosen: AnswerMode = micOk ? mode : 'type';
  const hear = (text: string) => {
    stopSpeaking();
    speak(text, speechLang(target));
  };
  const segments: { id: AnswerMode; label: string; off: boolean }[] = [
    { id: 'voice', label: sx.byVoice, off: !micOk },
    { id: 'type', label: sx.byTyping, off: false },
  ];
  return (
    <GameFrame
      testID="speech-screen"
      target={target}
      currentCard={`speech-intro:${story.id}`}
      hideLevelCounter
      top={
        <View style={styles.top}>
          <BackButton testID="speech-back" onPress={onBack} pressStyle={styles.backPress} arrowStyle={[styles.backArrow, { color: colors.text }]} />
          <Text style={[styles.heading, { color: colors.text }]}>{story.title[source]}</Text>
        </View>
      }
      dock={{ testID: 'speech-start', label: sx.start, tone: 'next', onPress: onStart }}
    >
      <View style={styles.box}>
        <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
          <Text style={[styles.teaser, { color: colors.text }]}>{story.teaser[source]}</Text>
          <Text testID="speech-intro-text" style={[styles.intro, { color: colors.textMuted }]}>{story.intro[source]}</Text>
        </Card>

        {words.length > 0 && (
          <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
            <Text testID="speech-words" style={[styles.caption, { color: colors.textMuted }]}>{sx.newWords}</Text>
            {words.map((w, i) => (
              <View key={w[story.target]} testID={`speech-word-${i}`} style={styles.word}>
                <SpeakButton
                  testID={`speech-word-speak-${i}`}
                  accessibilityLabel={sx.listen}
                  onPress={() => hear(w[story.target])}
                  style={styles.speakBtn}
                  iconStyle={styles.speakIcon}
                />
                <Text style={[styles.wordText, { color: colors.text }]}>{w[story.target]}</Text>
                <Text style={[styles.meaning, { color: colors.textMuted }]}>{w[source]}</Text>
              </View>
            ))}
          </Card>
        )}

        <Text style={[styles.caption, { color: colors.textMuted }]}>{sx.howAnswer}</Text>
        <View style={styles.segments}>
          {segments.map((seg) => {
            const selected = seg.id === chosen;
            return (
              <Pressable
                key={seg.id}
                testID={`speech-mode-${seg.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: seg.off }}
                disabled={seg.off}
                onPress={() => onMode(seg.id)}
                style={[
                  styles.segment,
                  themedEdgeStyle(g),
                  { backgroundColor: selected ? colors.tint : colors.card, borderColor: selected ? colors.tint : colors.border, opacity: seg.off ? 0.4 : 1 },
                ]}
              >
                <Text style={[styles.segmentText, { color: selected ? colors.onTint : colors.text }]}>{seg.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {!micOk && <Text testID="speech-no-mic" style={[styles.hint, { color: colors.textMuted }]}>{sx.noMic}</Text>}
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  backPress: { minHeight: tapTarget, minWidth: tapTarget, justifyContent: 'center' },
  backArrow: { fontSize: fontSize.xxl },
  heading: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  box: { marginHorizontal: spacing.xl, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  brutalCard: { padding: spacing.lg, gap: spacing.sm },
  teaser: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  intro: { fontSize: fontSize.md },
  caption: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  word: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  speakBtn: { minHeight: tapTarget, minWidth: tapTarget, alignItems: 'center', justifyContent: 'center' },
  speakIcon: { fontSize: fontSize.xl },
  wordText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  meaning: { flex: 1, fontSize: fontSize.md, textAlign: 'right' },
  segments: { flexDirection: 'row', gap: spacing.sm },
  segment: { flex: 1, minHeight: tapTarget, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  hint: { fontSize: fontSize.sm },
});
