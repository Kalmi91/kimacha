// The color picker; after choosing, the value of the theme context changes, and the choice goes
// into the db. The palette chips are on the Themes screen instead of Settings
// (app/themes.tsx), the assertions are the same. Mock pattern: pcicLevelPicker.test.tsx.

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));

import { useEffect } from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import ThemesScreen from '../../themes';
import { makeFlush } from '@/test-utils/flush';

let ctx: ReturnType<typeof useTheme>;
function Probe() {
  const value = useTheme();
  useEffect(() => {
    ctx = value;
  });
  return null;
}

const flush = makeFlush(4);

describe('Themes screen: color picker', () => {
  it('6 options, the choice switches the context and persists', async () => {
    const { getByTestId, getByText } = render(
      <ThemeProvider>
        <Probe />
        <ThemesScreen />
      </ThemeProvider>
    );
    await flush();

    for (const id of ['electric', 'lime', 'brand', 'cyan', 'orange', 'classic']) {
      expect(getByTestId(`palette-${id}`)).toBeTruthy();
    }
    expect(getByText('Lime + pink')).toBeTruthy();
    expect(ctx.grammarPalette).toBe('brand');

    fireEvent.press(getByTestId('palette-cyan'));
    await flush();
    expect(ctx.grammarPalette).toBe('cyan');
    expect(ctx.theme).toMatch(/^cyan-(light|dark)$/);
    expect(await getDb().getGrammarPalette()).toBe('cyan');

    fireEvent.press(getByTestId('palette-classic'));
    await flush();
    expect(ctx.grammarPalette).toBe('classic');
    expect(['light', 'dark']).toContain(ctx.theme);
  });
});
