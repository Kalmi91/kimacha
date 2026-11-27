import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { BrutalBox } from '@/components/grammar/Brutal';
import ResultBadge from '@/components/ResultBadge';
import Colors from '@/constants/Colors';
import { useGrammarColors } from '@/lib/grammarColors';
import { useTheme } from '@/lib/ThemeContext';

// The one box every grammar exercise shows its result in (FB754, FB755, FB763): the neutral surface of the skin,
// a coloured BORDER (success solid after a right answer, danger dashed after a wrong one), the Correct / Wrong
// badge as its first row, the explanation below it. Never a filled green (or accent) box.
export default function AnswerFeedbackBox({
  correct,
  children,
  testID,
  badgeLabel,
  badgeTestID,
  style,
}: {
  correct: boolean;
  children?: ReactNode;
  testID?: string;
  badgeLabel?: string;
  badgeTestID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const g = useGrammarColors();
  const { theme } = useTheme();
  const colors = Colors[theme];
  // Same source as the Night result rows (TypedKinds): the skin's own success / danger, else the theme's.
  const tone = correct ? (g.extra?.success ?? colors.success) : (g.extra?.danger ?? colors.danger);
  const border: ViewStyle = {
    borderColor: tone,
    borderTopColor: tone,
    borderRightColor: tone,
    borderBottomColor: tone,
    borderLeftColor: tone,
    borderStyle: correct ? 'solid' : 'dashed',
  };
  const badge = <ResultBadge correct={correct} label={badgeLabel} testID={badgeTestID} />;
  if (g.brutal) {
    return (
      <BrutalBox testID={testID} fill="paper" dashed={!correct} boxStyle={[{ gap: 8 }, style, border]}>
        {badge}
        {children}
      </BrutalBox>
    );
  }
  return (
    <View testID={testID} style={[{ backgroundColor: g.paper, borderWidth: 2, borderRadius: 16, padding: 16, gap: 8 }, style, border]}>
      {badge}
      {children}
    </View>
  );
}
