// FB750: reading a grammar lesson pays 0.5 XP per active minute, only on the lesson (reading) view.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/grammar',
  // like the real hook: runs again when the callback changes, and cleans up on unmount
  useFocusEffect: (cb: () => (() => void) | undefined) => {
    const { useEffect } = require('react');
    useEffect(() => {
      const cleanup = cb();
      (globalThis as { __blur?: () => void }).__blur = cleanup;
      return cleanup;
    }, [cb]);
  },
  useLocalSearchParams: () => ({ topic: 'ser-estar' }),
}));
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
jest.mock('@/lib/xpAward', () => ({
  ...jest.requireActual('@/lib/xpAward'),
  awardReadingXp: jest.fn(async () => 0.5),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { awardReadingXp } from '@/lib/xpAward';
import GrammarLessonScreen from '../[topic]';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(3);
const fireMinute = () => (require('@/lib/usageTimer') as { __fireMinute: () => void }).__fireMinute();

describe('grammar lesson screen: XP for reading (FB750)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
  });

  it('the chip is there from the start, one fired minute gives one award, two give two', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush(4);
    expect(screen.queryByTestId('lesson-reading-xp')).toBeTruthy();

    act(() => fireMinute());
    await flush(2);
    expect(awardReadingXp).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('lesson-reading-xp')).toBeTruthy();

    act(() => fireMinute());
    await flush(2);
    expect(awardReadingXp).toHaveBeenCalledTimes(2);

    view.unmount();
  });

  it('pays nothing while the drill is on screen', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush(4);

    fireEvent.press(screen.getByTestId('grammar-start-choice'));
    await flush(3);
    expect(screen.queryByTestId('grammar-start-choice')).toBeFalsy();

    act(() => fireMinute());
    await flush(2);
    expect(awardReadingXp).not.toHaveBeenCalled();

    view.unmount();
  });

  it('pays nothing after the screen loses focus (blur)', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush(4);

    act(() => (globalThis as { __blur?: () => void }).__blur?.());
    act(() => fireMinute());
    await flush(2);
    expect(awardReadingXp).not.toHaveBeenCalled();

    view.unmount();
  });

  it('pays nothing after unmount', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush(4);
    view.unmount();

    act(() => fireMinute());
    await flush(2);
    expect(awardReadingXp).not.toHaveBeenCalled();
  });
});
