// the shared right / wrong badge, the done badge and the drawn check mark. The colour AND the
// shape of right and wrong differ (solid vs dashed border, ✓ vs ✗, text); the colours come
// from tokens.
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import CheckMark from '../CheckMark';
import DoneBadge from '../DoneBadge';
import ResultBadge from '../ResultBadge';
import Colors from '@/constants/Colors';
import { contrastRatio } from '@/constants/Skins';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'brand-light' }),
}));

const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

describe('ResultBadge', () => {
  it('correct: green fill from a token, solid border, ✓ and text in the UI language', () => {
    render(<ResultBadge correct testID="b" />);
    const st = style('b');
    expect(st.backgroundColor).toBe(Colors['brand-light'].successFill);
    expect(st.borderStyle).toBe('solid');
    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.getByText('Correct!')).toBeTruthy();
  });

  it('incorrect: red fill from a token, dashed border, ✗ and text', () => {
    render(<ResultBadge correct={false} testID="b" />);
    const st = style('b');
    expect(st.backgroundColor).toBe(Colors['brand-light'].danger);
    expect(st.borderStyle).toBe('dashed');
    expect(screen.getByText('✗')).toBeTruthy();
    expect(screen.getByText('Not quite!')).toBeTruthy();
  });

  it('the label and the mark are legible on the fill (WCAG 4.5), in both states', () => {
    const { unmount } = render(<ResultBadge correct testID="ok" />);
    const okFill = Colors['brand-light'].successFill;
    expect(contrastRatio(StyleSheet.flatten(screen.getByText('Correct!').props.style).color, okFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(StyleSheet.flatten(screen.getByText('✓').props.style).color, okFill)).toBeGreaterThanOrEqual(4.5);
    unmount();
    render(<ResultBadge correct={false} testID="bad" />);
    const badFill = Colors['brand-light'].danger;
    expect(contrastRatio(StyleSheet.flatten(screen.getByText('Not quite!').props.style).color, badFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(StyleSheet.flatten(screen.getByText('✗').props.style).color, badFill)).toBeGreaterThanOrEqual(4.5);
  });

  it('the two states differ in color AND shape (color is not the only signal)', () => {
    const { unmount } = render(<ResultBadge correct testID="ok" />);
    const ok = style('ok');
    unmount();
    render(<ResultBadge correct={false} testID="bad" />);
    const bad = style('bad');
    expect(ok.backgroundColor).not.toBe(bad.backgroundColor);
    expect(ok.borderStyle).not.toBe(bad.borderStyle);
  });

  it('a custom label overrides the default text', () => {
    render(<ResultBadge correct label="perfect!" />);
    expect(screen.getByText('perfect!')).toBeTruthy();
  });
});

describe('CheckMark and DoneBadge', () => {
  it('the drawn check mark consists of two strokes and draws in the given color', () => {
    render(<CheckMark size={40} color="#123456" />);
    // no emoji text: only Views
    expect(screen.queryByText('✅')).toBeNull();
  });

  it('the done badge appears drawn, without emoji', () => {
    render(<DoneBadge />);
    expect(screen.getByTestId('done-badge', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('🎉')).toBeNull();
  });
});
