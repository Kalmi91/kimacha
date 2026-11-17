// Stats: the "weekly goal reached" title takes the theme's readable success colour (a fixed bright green
// was hard to read on the light card).

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import StatsScreen from '../stats';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(8);

describe('Stats tab: weekly goal reached', () => {
  it('colours the title with the theme success colour, not a fixed green', async () => {
    await getDb().setOnboarding('en', 'es');
    await getDb().setWeeklyGoalMinutes(1);
    await getDb().addUsageMinute();
    await getDb().addUsageMinute();
    const view = render(
      <ThemeProvider>
        <StatsScreen />
      </ThemeProvider>,
    );
    await flush();
    const title = view.getByText('🏆 Weekly goal reached!');
    const color = StyleSheet.flatten(title.props.style).color;
    expect(color).toBe(Colors.light.success);
    view.unmount();
  });
});
