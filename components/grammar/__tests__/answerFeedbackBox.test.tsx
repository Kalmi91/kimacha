// FB754 / FB755 / FB763: one after-answer box for every grammar exercise: the badge INSIDE it, a neutral
// surface, a coloured border (success solid / danger dashed), never a filled green or danger box.

import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import AnswerFeedbackBox from '@/components/grammar/AnswerFeedbackBox';
import { styles } from '@/components/grammar/GrammarDrill.styles';
import Colors from '@/constants/Colors';
import { grammarColorsFor } from '@/lib/grammarColors';
import type { ThemeKey } from '@/lib/ThemeContext';

let mockTheme = 'light';
jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme }),
}));

describe('the Transform result box', () => {
  it('keeps the shared 2 px border in the classic skin', () => {
    mockTheme = 'light';
    render(<AnswerFeedbackBox correct testID="box" style={styles.transformResultBox} />);
    expect(StyleSheet.flatten(screen.getByTestId('box').props.style).borderWidth).toBe(2);
  });
});

describe.each([
  ['classic', 'light'],
  ['classic dark', 'dark'],
  ['brutal', 'brand-light'],
  ['night', 'night-dark'],
] as const)('AnswerFeedbackBox, %s skin', (_skin, theme) => {
  beforeEach(() => {
    mockTheme = theme;
  });

  it.each([true, false])('correct=%s: the badge is inside the box, the border carries the result, the surface stays neutral', (correct) => {
    render(
      <AnswerFeedbackBox correct={correct} testID="box" badgeTestID="badge">
        <Text>why</Text>
      </AnswerFeedbackBox>
    );
    const colors = Colors[theme as keyof typeof Colors];
    const g = grammarColorsFor(theme as ThemeKey);
    const box = screen.getByTestId('box');
    expect(within(box).getByTestId('badge')).toBeTruthy();
    expect(within(box).getByText('why')).toBeTruthy();
    const style = StyleSheet.flatten(box.props.style);
    expect(style.borderColor).toBe(correct ? (g.extra?.success ?? colors.success) : (g.extra?.danger ?? colors.danger));
    expect(style.borderStyle).toBe(correct ? 'solid' : 'dashed');
    expect(style.backgroundColor).not.toBe(colors.successFill);
    expect(style.backgroundColor).not.toBe(colors.danger);
    expect(style.backgroundColor).toBe(g.paper);
    // the badge is the first row of the box
    const first = box.children[0];
    expect(typeof first).not.toBe('string');
    expect((first as { props: { testID?: string } }).props.testID === 'badge' || within(first as never).queryByTestId('badge') !== null).toBe(true);
  });
});

describe('AnswerFeedbackBox, caller style and padding', () => {
  const callerStyle = { marginTop: 16, padding: 20, alignItems: 'center' } as const;

  it('brutal, no style: the front box has the default padding 16', () => {
    mockTheme = 'brand-light';
    render(<AnswerFeedbackBox correct testID="box" />);
    expect(StyleSheet.flatten(screen.getByTestId('box').props.style).padding).toBe(16);
  });

  it('brutal: the caller margin goes to the outer wrapper, the rest stays on the front box', () => {
    mockTheme = 'brand-light';
    render(<AnswerFeedbackBox correct testID="box" style={callerStyle} />);
    const box = screen.getByTestId('box');
    const inner = StyleSheet.flatten(box.props.style);
    expect(inner.padding).toBe(20);
    expect(inner.alignItems).toBe('center');
    expect(inner.marginTop).toBeUndefined();
    // the outer wrapper is the next host view above the front box
    let outer = box.parent;
    while (outer && typeof outer.type !== 'string') outer = outer.parent;
    expect(StyleSheet.flatten(outer?.props.style).marginTop).toBe(16);
  });

  it('classic: the caller style stays on the one box', () => {
    mockTheme = 'light';
    render(<AnswerFeedbackBox correct testID="box" style={callerStyle} />);
    const style = StyleSheet.flatten(screen.getByTestId('box').props.style);
    expect(style.marginTop).toBe(16);
    expect(style.padding).toBe(20);
  });
});

describe('AnswerFeedbackBox, retro95 light skin', () => {
  beforeEach(() => {
    mockTheme = 'retro95-light';
  });

  it.each([true, false])('correct=%s: all four border sides carry the tone', (correct) => {
    render(<AnswerFeedbackBox correct={correct} testID="box" />);
    const g = grammarColorsFor('retro95-light' as ThemeKey);
    const colors = Colors.light;
    const tone = correct ? (g.extra?.success ?? colors.success) : (g.extra?.danger ?? colors.danger);
    const style = StyleSheet.flatten(screen.getByTestId('box').props.style);
    expect(style.borderTopColor).toBe(tone);
    expect(style.borderRightColor).toBe(tone);
    expect(style.borderBottomColor).toBe(tone);
    expect(style.borderLeftColor).toBe(tone);
  });
});
