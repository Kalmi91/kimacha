import { View } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { TENSE_NAMES, type TenseId } from '@/lib/grammar/lessonTypes';
import { BrutalBox, Sticker, inkButtonText } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import { useGrammarColors, type GrammarColors } from '@/lib/grammarColors';
import { styles } from '@/components/grammar/GrammarDrill.styles';

// shared brutalist elements of the non-choice kinds: the b-filled feedback
// box (uppercase title + one sentence) and the ink-filled button.
// The right / wrong signal is the shared ResultBadge (colour + shape + ✓/✗ + text)
// above the box; the b-filled box only carries the explanation (if there is one).
export function BrutalFeedback({ title, correct, children }: { title: string; correct: boolean; children?: React.ReactNode }) {
  return (
    <>
      <ResultBadge correct={correct} label={title} />
      {children ? (
        <BrutalBox fill="b" boxStyle={styles.brutalFeedback}>
          {children}
        </BrutalBox>
      ) : null}
    </>
  );
}

export function BrutalInkButton({ g, testID, label, onPress }: { g: GrammarColors; testID: string; label: string; onPress: () => void }) {
  return (
    <BrutalBox testID={testID} fill="ink" boxStyle={styles.brutalNext} onPress={onPress}>
      <Text style={[styles.brutalNextText, { color: inkButtonText(g) }]}>{label}</Text>
    </BrutalBox>
  );
}

// tense badge, shown on every kind
// where the item has a `tense` field (choice/form/why/transform).
export function TenseBadge({ tense, colors }: { tense: { from: TenseId; to: TenseId }; colors: (typeof Colors)['light'] }) {
  const g = useGrammarColors();
  if (g.brutal) {
    return <Sticker label={`${TENSE_NAMES[tense.from].es} → ${TENSE_NAMES[tense.to].es}`} fill="b" rotate={-3} />;
  }
  return (
    <View style={[styles.tenseBadge, { backgroundColor: colors.tint + '22' }]}>
      <Text style={[styles.tenseBadgeText, { color: colors.tint }]}>
        {TENSE_NAMES[tense.from].es} → {TENSE_NAMES[tense.to].es}
      </Text>
    </View>
  );
}
