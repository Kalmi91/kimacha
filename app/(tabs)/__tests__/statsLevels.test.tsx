// The Stats level card is always available on the Spanish course.

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

describe('Stats tab: level card', () => {

  it('the Spanish course always shows the level card', async () => {
    await getDb().setOnboarding('en', 'es');
    const backup = JSON.parse(JSON.stringify(await getDb().exportAll()));
    backup.tables.user_meta[0].beta_flags = JSON.stringify({ levels: false });
    await getDb().importAll(backup);
    const view = render(
      <ThemeProvider>
        <StatsScreen />
      </ThemeProvider>,
    );
    await flush();
    expect(view.getByText('Your level')).toBeTruthy();
    expect(view.getByTestId('level-card-headline')).toBeTruthy();
    expect(view.getByText('Words known')).toBeTruthy();
    view.unmount();
  });
});
