import { AppState } from 'react-native';
import {
  startUsageTimer,
  stopUsageTimer,
  noteInteraction,
  onActiveMinute,
  __resetForTests,
} from '../usageTimer';

const mockAddUsageMinute = jest.fn().mockResolvedValue(undefined);
jest.mock('../database', () => ({
  getDb: () => ({ addUsageMinute: mockAddUsageMinute }),
}));

describe('usageTimer', () => {
  let changeHandler: (state: string) => void = () => {};

  beforeEach(() => {
    jest.useFakeTimers();
    mockAddUsageMinute.mockClear();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      changeHandler = handler as (state: string) => void;
      return { remove: jest.fn() } as any;
    });
    (AppState as any).currentState = 'active';
    __resetForTests();
  });

  afterEach(() => {
    stopUsageTimer();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('fires onActiveMinute + persists after 60s of continuous interaction', () => {
    const onMinute = jest.fn();
    onActiveMinute(onMinute);
    startUsageTimer();

    // Simulate continuous tapping (a ping roughly every second) so the
    // rolling 30s idle window never lapses across the full minute.
    for (let i = 0; i < 59; i++) {
      noteInteraction();
      jest.advanceTimersByTime(1_000);
    }
    expect(onMinute).not.toHaveBeenCalled();

    noteInteraction();
    jest.advanceTimersByTime(1_000);
    expect(onMinute).toHaveBeenCalledTimes(1);
    expect(mockAddUsageMinute).toHaveBeenCalledTimes(1);
  });

  it('does not accrue seconds before the first interaction', () => {
    const onMinute = jest.fn();
    onActiveMinute(onMinute);
    startUsageTimer();

    jest.advanceTimersByTime(60_000);
    expect(onMinute).not.toHaveBeenCalled();
  });

  it('pauses accrual after 30s idle but keeps the partial count instead of discarding it', () => {
    const onMinute = jest.fn();
    onActiveMinute(onMinute);
    startUsageTimer();
    noteInteraction();

    // 10 active seconds banked, all within the 30s idle window.
    jest.advanceTimersByTime(10_000);
    // Let 25 more seconds pass with no further interaction: ticks up to the
    // 30s mark since the last interaction still count (elapsed <= 30s), the
    // rest are idle-paused. So exactly 20 more seconds accrue here (total 30).
    jest.advanceTimersByTime(25_000);
    expect(onMinute).not.toHaveBeenCalled();

    // Resume interacting. If the earlier partial progress had been discarded
    // instead of kept, this would need a full 60s more; it only needs 30.
    noteInteraction();
    jest.advanceTimersByTime(29_000);
    expect(onMinute).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1_000);
    expect(onMinute).toHaveBeenCalledTimes(1);
  });

  it('does not accrue while the app is backgrounded, but resumes from the banked count', () => {
    const onMinute = jest.fn();
    onActiveMinute(onMinute);
    startUsageTimer();
    noteInteraction();

    jest.advanceTimersByTime(10_000); // 10 active seconds banked
    changeHandler('background');
    jest.advanceTimersByTime(120_000); // long time away, must not accrue
    expect(onMinute).not.toHaveBeenCalled();

    changeHandler('active');
    // Resume with continuous interaction; only 50 more seconds are needed to
    // reach the 60s mark, proving the pre-background 10s wasn't discarded.
    for (let i = 0; i < 49; i++) {
      noteInteraction();
      jest.advanceTimersByTime(1_000);
    }
    expect(onMinute).not.toHaveBeenCalled();
    noteInteraction();
    jest.advanceTimersByTime(1_000); // 10 + 49 + 1 = 60
    expect(onMinute).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops further notifications', () => {
    const onMinute = jest.fn();
    const unsubscribe = onActiveMinute(onMinute);
    startUsageTimer();
    noteInteraction();
    unsubscribe();

    jest.advanceTimersByTime(60_000);
    expect(onMinute).not.toHaveBeenCalled();
  });

  it('stopUsageTimer halts accrual entirely', () => {
    const onMinute = jest.fn();
    onActiveMinute(onMinute);
    startUsageTimer();
    noteInteraction();
    jest.advanceTimersByTime(30_000);

    stopUsageTimer();
    jest.advanceTimersByTime(60_000);
    expect(onMinute).not.toHaveBeenCalled();
  });
});
