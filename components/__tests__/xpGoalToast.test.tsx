// The daily XP goal pill (lib/dailyXp.ts -> UsageToast): "Daily goal reached! 50 XP" in the UI
// language when the day's XP first reaches the goal, nothing before it. Mock pattern: chromeBrutal.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/usageTimer', () => ({
  onActiveMinute: () => () => {},
  onUsageMilestone: () => () => {},
  onDayRollover: () => () => {},
}));

import { act, render } from '@testing-library/react-native';

import { DAILY_XP_GOAL, __resetForTests, addXp } from '@/lib/dailyXp';
import { setLanguage } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/ThemeContext';
import UsageToast from '../UsageToast';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe('UsageToast: daily XP goal pill', () => {
  beforeEach(() => __resetForTests());
  afterEach(() => setLanguage('en'));

  it('shows nothing below the goal, then "Daily goal reached! 50 XP" when it is reached', async () => {
    setLanguage('en');
    const screen = render(wrap(<UsageToast />));
    await flush();
    await act(async () => {
      await addXp(DAILY_XP_GOAL - 3, '2027-01-10');
    });
    expect(screen.queryByTestId('usage-toast-pill')).toBeNull();
    await act(async () => {
      await addXp(3, '2027-01-10');
    });
    expect(screen.getByText('Daily goal reached! 50 XP')).toBeTruthy();
    screen.unmount();
  });

  it('says it in Spanish with the Spanish UI', async () => {
    setLanguage('es');
    const screen = render(wrap(<UsageToast />));
    await flush();
    await act(async () => {
      await addXp(DAILY_XP_GOAL, '2027-01-11');
    });
    expect(screen.getByText('¡Objetivo diario cumplido! 50 XP')).toBeTruthy();
    screen.unmount();
  });
});
