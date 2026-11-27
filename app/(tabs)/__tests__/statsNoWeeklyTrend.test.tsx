// Stats: the weekly-trend card is gone (FB758); the goal card stays.

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

import { render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import StatsScreen from '../stats';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(8);

describe('Stats tab: no weekly trend card', () => {
  it('renders without the trend delta and keeps the goal bar', async () => {
    await getDb().setOnboarding('en', 'es');
    const view = render(
      <ThemeProvider>
        <StatsScreen />
      </ThemeProvider>,
    );
    await flush();
    expect(view.queryByTestId('stats-trend-delta')).toBeNull();
    expect(view.queryByText('Weekly trend')).toBeNull();
    expect(view.getByTestId('stats-goal-bar')).toBeTruthy();
    view.unmount();
  });
});
