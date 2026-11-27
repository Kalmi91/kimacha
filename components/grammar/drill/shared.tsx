import { View } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { TENSE_NAMES, type ContentLang, type TenseId } from '@/lib/grammar/lessonTypes';
import { BrutalBox, Sticker, inkButtonText, softTitleStyle } from '@/components/grammar/Brutal';
import { useGrammarColors, type GrammarColors } from '@/lib/grammarColors';
import { styles } from '@/components/grammar/GrammarDrill.styles';

// shared brutalist elements of the non-choice kinds: the ink-filled button.
// (The after-answer box is components/grammar/AnswerFeedbackBox.)
export function BrutalInkButton({ g, testID, label, onPress }: { g: GrammarColors; testID: string; label: string; onPress: () => void }) {
  return (
    <BrutalBox testID={testID} fill="ink" boxStyle={styles.brutalNext} onPress={onPress}>
      <Text style={[styles.brutalNextText, { color: inkButtonText(g) }, softTitleStyle(g)]}>{label}</Text>
    </BrutalBox>
  );
}

// tense badge, shown on every kind
// where the item has a `tense` field (choice/form/why/transform).
export function TenseBadge({
  tense,
  colors,
  lang = 'es',
}: {
  tense: { from: TenseId; to: TenseId };
  colors: (typeof Colors)['light'];
  // the language of the badge text: the Spanish term for a Spanish lesson (default), the learner's own for an English one
  lang?: ContentLang;
}) {
  const g = useGrammarColors();
  const fromName = TENSE_NAMES[tense.from][lang] ?? TENSE_NAMES[tense.from].en;
  const toName = TENSE_NAMES[tense.to][lang] ?? TENSE_NAMES[tense.to].en;
  if (g.brutal) {
    return <Sticker label={`${fromName} → ${toName}`} fill="b" rotate={-3} />;
  }
  return (
    <View style={[styles.tenseBadge, { backgroundColor: colors.tint + '22' }]}>
      <Text style={[styles.tenseBadgeText, { color: colors.tint }]}>
        {fromName} → <Text style={styles.tenseBadgeTarget}>{toName}</Text>
      </Text>
    </View>
  );
}
