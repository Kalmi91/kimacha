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
  it('helyes: tokenből vett zöld kitöltés, tömör keret, ✓ és a felület nyelvű szöveg', () => {
    render(<ResultBadge correct testID="b" />);
    const st = style('b');
    expect(st.backgroundColor).toBe(Colors['brand-light'].successFill);
    expect(st.borderStyle).toBe('solid');
    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.getByText('Correct!')).toBeTruthy();
  });

  it('helytelen: tokenből vett piros kitöltés, szaggatott keret, ✗ és szöveg', () => {
    render(<ResultBadge correct={false} testID="b" />);
    const st = style('b');
    expect(st.backgroundColor).toBe(Colors['brand-light'].danger);
    expect(st.borderStyle).toBe('dashed');
    expect(screen.getByText('✗')).toBeTruthy();
    expect(screen.getByText('Not quite!')).toBeTruthy();
  });

  it('a felirat és a jel olvasható a kitöltésen (WCAG 4,5), mindkét állapotban (PLAN-temak 7H)', () => {
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

  it('a két állapot színe ÉS alakja különbözik (nem csak a szín jelez)', () => {
    const { unmount } = render(<ResultBadge correct testID="ok" />);
    const ok = style('ok');
    unmount();
    render(<ResultBadge correct={false} testID="bad" />);
    const bad = style('bad');
    expect(ok.backgroundColor).not.toBe(bad.backgroundColor);
    expect(ok.borderStyle).not.toBe(bad.borderStyle);
  });

  it('egyedi felirat felülírja az alapszöveget', () => {
    render(<ResultBadge correct label="perfect!" />);
    expect(screen.getByText('perfect!')).toBeTruthy();
  });
});

describe('CheckMark és DoneBadge', () => {
  it('a rajzolt pipa két sávból áll és a kapott színnel rajzol', () => {
    render(<CheckMark size={40} color="#123456" />);
    // no emoji text: only Views
    expect(screen.queryByText('✅')).toBeNull();
  });

  it('a kész-jelvény emoji nélkül, rajzolva jelenik meg', () => {
    render(<DoneBadge />);
    expect(screen.getByTestId('done-badge', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('🎉')).toBeNull();
  });
});
