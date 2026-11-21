import { render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';

import GradientFill, { mixHex } from '../GradientFill';

describe('GradientFill', () => {
  it('mixHex: ends and middle', () => {
    expect(mixHex('#EC4899', '#22D3EE', 0)).toBe('#EC4899');
    expect(mixHex('#EC4899', '#22D3EE', 1)).toBe('#22D3EE');
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });

  it('native: 40 slices, first = from, last = to', () => {
    render(<GradientFill from="#EC4899" to="#22D3EE" testID="gf" />);
    const root = screen.getByTestId('gf');
    const slices = root.children as unknown as { props: { style: import("react-native").ViewStyle } }[];
    expect(slices).toHaveLength(40);
    expect(StyleSheet.flatten(slices[0].props.style).backgroundColor).toBe('#EC4899');
    expect(StyleSheet.flatten(slices[39].props.style).backgroundColor).toBe('#22D3EE');
    expect(JSON.stringify(StyleSheet.flatten(root.props.style))).not.toContain('experimental_');
  });

  it('web: one CSS gradient view', () => {
    const spy = jest.replaceProperty(Platform, 'OS', 'web');
    render(<GradientFill from="#EC4899" to="#22D3EE" testID="gf" />);
    const root = screen.getByTestId('gf');
    expect(StyleSheet.flatten(root.props.style).backgroundImage).toContain('linear-gradient');
    expect(root.children).toHaveLength(0);
    spy.restore();
  });
});
