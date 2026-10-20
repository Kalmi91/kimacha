// UsageToast: a new toast that arrives while the previous one is fading out must stay on screen. The old
// fade-out's end callback used to hide the toast that had just replaced it.

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/lib/usageTimer', () => {
  const listeners: (() => void)[] = [];
  return {
    onActiveMinute: (cb: () => void) => {
      listeners.push(cb);
      return () => {
        listeners.splice(listeners.indexOf(cb), 1);
      };
    },
    onUsageMilestone: () => () => {},
    onDayRollover: () => () => {},
    __fireMinute: () => listeners.forEach((cb) => cb()),
  };
});

import { act, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import UsageToast from '../UsageToast';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(6);

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

// A frozen clock: no timer or animation frame runs until the test advances it.
const freezeClock = () => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
afterEach(() => {
  jest.useRealTimers();
});

describe('UsageToast: a new toast during the previous fade-out', () => {
  it('stays on screen after the old fade-out ends, then leaves on its own schedule', async () => {
    freezeClock();
    const { __fireMinute } = jest.requireMock('@/lib/usageTimer');
    // claim today's greeting first, so the mount does not show a greeting toast of its own mid-test
    await getDb().claimDailyGreeting();
    await getDb().setGrammarPalette('brand');
    const screen = render(wrap(<UsageToast />));
    await flush();

    act(() => __fireMinute());
    expect(screen.queryByTestId('usage-toast')).toBeTruthy();

    // first toast sits for 2 s, then fades out: stop just inside the fade (under the test renderer it ends
    // about one frame, 16 ms, after it starts)
    act(() => {
      jest.advanceTimersByTime(2005);
    });
    expect(screen.queryByTestId('usage-toast')).toBeTruthy();

    // a new toast is asked for during the fade-out
    act(() => __fireMinute());
    expect(screen.queryByTestId('usage-toast')).toBeTruthy();

    // the old animation's end must not hide it
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(screen.queryByTestId('usage-toast')).toBeTruthy();

    // the new toast keeps its normal 2 s and then fades out and goes (the 400 ms above counted)
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.queryByTestId('usage-toast')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(screen.queryByTestId('usage-toast')).toBeNull();
    screen.unmount();
  });
});
