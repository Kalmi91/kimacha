// The level card on the Stats tab (components/stats/LevelCard.tsx) is behind the `showLevels`
// switch (// beta: levels), which is off for now: the tab shows no level card and reads no level data.
// Mock pattern: statsMockExam.test.tsx.

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

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Stats tab: level card switch', () => {
  it('with the switch off (default) there is no level card, the rest of the tab is there', async () => {
    await getDb().setOnboarding('en', 'es');
    const view = render(
      <ThemeProvider>
        <StatsScreen />
      </ThemeProvider>,
    );
    await flush();
    expect(view.queryByText('Your level')).toBeNull();
    expect(view.queryByTestId('level-card-headline')).toBeNull();
    expect(view.getByText('Words known')).toBeTruthy();
    expect(view.getByText('Practice exam')).toBeTruthy();
    view.unmount();
  });
});
