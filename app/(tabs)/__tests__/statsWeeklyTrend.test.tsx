// Stats: the weekly-trend card shows 6 weeks of new words and minutes, and still shows zeros with no data.

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

describe('Stats tab: weekly trend card', () => {
  it('renders 6 weeks per row with zeros when there is no data, and a delta line', async () => {
    await getDb().setOnboarding('en', 'es');
    const view = render(
      <ThemeProvider>
        <StatsScreen />
      </ThemeProvider>,
    );
    await flush();
    expect(view.getByText('Weekly trend')).toBeTruthy();
    expect(view.getByText('New words')).toBeTruthy();
    expect(view.getByTestId('stats-trend-words')).toBeTruthy();
    expect(view.getByTestId('stats-trend-minutes')).toBeTruthy();
    expect(view.getByTestId('stats-trend-delta').props.children).toBe('vs previous week: 0 words, 0 min');
    view.unmount();
  });
});
