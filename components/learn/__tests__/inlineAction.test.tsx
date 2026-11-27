import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import DockedAction, { defaultActionLabel } from '@/components/learn/DockedAction';
import InlineAction from '@/components/learn/InlineAction';
import { t } from '@/lib/i18n';

// The theme key picks the skin branch of the shared button: classic, brutal and soft (Night).
let mockTheme = 'light';
jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme, skinMix: null }),
}));

const SKINS: [string, string][] = [
  ['classic', 'light'],
  ['brutal', 'brand-light'],
  ['soft (night)', 'night-dark'],
];
const flat = (s: unknown): Record<string, unknown> => (StyleSheet.flatten(s as never) ?? {}) as Record<string, unknown>;
const ID = 'act';

describe.each(SKINS)('InlineAction vs DockedAction, skin %s', (_name, theme) => {
  beforeEach(() => {
    mockTheme = theme;
  });

  it.each(['check', 'next'] as const)('tone %s: same button, same label, inline root is not absolute', (tone) => {
    const onPress = jest.fn();
    const docked = render(<DockedAction testID={ID} tone={tone} onPress={onPress} bottom={0} colors={Colors.light} />);
    const dockedBtn = screen.getByTestId(ID);
    const dockedStyle = flat(dockedBtn.props.style);
    const dockedLabel = docked.toJSON();
    docked.unmount();

    const inline = render(<InlineAction testID={ID} tone={tone} onPress={onPress} />);
    const inlineBtn = screen.getByTestId(ID);
    expect(flat(inlineBtn.props.style)).toEqual(dockedStyle);
    expect(inline.toJSON()).not.toBeNull();
    expect(dockedLabel).not.toBeNull();

    const label = defaultActionLabel(tone);
    expect(label).toBe(tone === 'next' ? `${t().card.next} →` : `✓ ${t().card.check}`);
    expect(screen.getAllByText(label, { exact: false }).length).toBeGreaterThan(0);

    const root = inline.toJSON() as { props: { style?: unknown } };
    expect(flat(root.props.style).position).not.toBe('absolute');
  });

  it.each(['check', 'next'] as const)('tone %s: the label text styles are equal', (tone) => {
    const docked = render(<DockedAction tone={tone} onPress={jest.fn()} bottom={0} colors={Colors.light} />);
    const dockedText = screen.getByText(defaultActionLabel(tone), { exact: false });
    const dockedStyle = flat(dockedText.props.style);
    docked.unmount();
    render(<InlineAction tone={tone} onPress={jest.fn()} />);
    const inlineText = screen.getByText(defaultActionLabel(tone), { exact: false });
    expect(flat(inlineText.props.style)).toEqual(dockedStyle);
  });
});
