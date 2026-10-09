// The Settings tab on the brutalist palette (BrutalBox rows), today's
// card rows on the classic palette. Mock pattern: settingsPalette.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
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

import { act, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import SettingsScreen from '../settings';

jest.setTimeout(30000);

const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Settings tab, neo-brutalist', () => {
  it('with the brand palette the rows are BrutalBox boxes', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();
    expect(view.queryAllByTestId('settings-row').length).toBeGreaterThan(0);
    view.unmount();
  });

  it('with the classic palette the current look stays: no BrutalBox row, the settings are present', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();
    expect(view.queryAllByTestId('settings-row').length).toBe(0);
    // the palette chips moved to the Themes screen; Settings has the Themes row.
    expect(view.queryByTestId('settings-theme-row')).toBeTruthy();
    view.unmount();
  });
});
