// a Statisztika fül brutalista palettán (BrutalBox kártyák, szegmentált heti
// cél sáv), classic palettán a mai kinézet. Mock-minta: settingsPalette.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

import { act, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import StatsScreen from '../stats';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Statisztika fül, neo-brutalista (NY19)', () => {
  it('brand palettán a heti cél szegmentált sáv megjelenik', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(<ThemeProvider><StatsScreen /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('stats-goal-bar')).toBeTruthy();
    view.unmount();
  });

  it('classic palettán a mai kinézet: nincs szegmentált sáv', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><StatsScreen /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('stats-goal-bar')).toBeNull();
    view.unmount();
  });
});
