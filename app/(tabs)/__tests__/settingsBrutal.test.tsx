// NY19: a Beállítások fül brutalista palettán (BrutalBox sorok), classic palettán a
// mai kártya-sorok. Mock-minta: settingsPalette.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

describe('Beállítások fül, neo-brutalista (NY19)', () => {
  it('brand palettán a sorok BrutalBox dobozok', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();
    expect(view.queryAllByTestId('settings-row').length).toBeGreaterThan(0);
    view.unmount();
  });

  it('classic palettán a mai kinézet: nincs BrutalBox sor, a beállítások megvannak', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
    await flush();
    expect(view.queryAllByTestId('settings-row').length).toBe(0);
    // PLAN-temak 4D: a paletta-chipek a Témák képernyőre költöztek; a Beállításokban a Témák-sor van.
    expect(view.queryByTestId('settings-theme-row')).toBeTruthy();
    view.unmount();
  });
});
