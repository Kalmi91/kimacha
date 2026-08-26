import { renderHook, act } from '@testing-library/react-native';
import { useGameSession } from '../games/session';

// GAMES.md 3. (F0): the shared score/lives/combo/clock/pause state every game
// screen builds on. K2 DÖNTÉS: pause()/resume() are the pair the gloss bubble
// calls, so their correctness matters beyond just the UI overlay.

describe('useGameSession', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts at score 0, the given lives, and ticks elapsedMs while running', () => {
    const { result } = renderHook(() => useGameSession({ startLives: 3, tickMs: 100 }));
    expect(result.current.score).toBe(0);
    expect(result.current.lives).toBe(3);
    expect(result.current.elapsedMs).toBe(0);

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current.elapsedMs).toBe(300);
  });

  it('pause() stops the clock, resume() continues it', () => {
    const { result } = renderHook(() => useGameSession({ tickMs: 100 }));
    act(() => jest.advanceTimersByTime(200));
    expect(result.current.elapsedMs).toBe(200);

    act(() => result.current.pause());
    expect(result.current.paused).toBe(true);
    act(() => jest.advanceTimersByTime(500));
    expect(result.current.elapsedMs).toBe(200); // frozen while paused

    act(() => result.current.resume());
    act(() => jest.advanceTimersByTime(100));
    expect(result.current.elapsedMs).toBe(300);
  });

  it('addScore accumulates, loseLife decrements and ends the round at 0 (when lives are tracked)', () => {
    const onLivesDepleted = jest.fn();
    const { result } = renderHook(() => useGameSession({ startLives: 2, onLivesDepleted }));

    act(() => result.current.addScore(100));
    act(() => result.current.addScore(50));
    expect(result.current.score).toBe(150);

    act(() => result.current.loseLife());
    expect(result.current.lives).toBe(1);
    expect(result.current.over).toBe(false);

    act(() => result.current.loseLife());
    expect(result.current.lives).toBe(0);
    expect(result.current.over).toBe(true);
    expect(onLivesDepleted).toHaveBeenCalledTimes(1);
  });

  it('startLives: 0 (untimed/no-fail games) never ends from loseLife', () => {
    const { result } = renderHook(() => useGameSession({ startLives: 0 }));
    act(() => result.current.loseLife());
    expect(result.current.lives).toBe(0);
    expect(result.current.over).toBe(false);
  });

  it('tracks combo and attempt log', () => {
    const { result } = renderHook(() => useGameSession());
    act(() => {
      result.current.bumpCombo();
      result.current.bumpCombo();
    });
    expect(result.current.combo).toBe(2);
    act(() => result.current.resetCombo());
    expect(result.current.combo).toBe(0);

    act(() => result.current.recordAttempt(101, true));
    act(() => result.current.recordAttempt(102, false));
    expect(result.current.attempts).toHaveLength(2);
    expect(result.current.attempts[0]).toMatchObject({ wordId: 101, correct: true });
    expect(result.current.attempts[1]).toMatchObject({ wordId: 102, correct: false });
  });

  it('reset() returns to the initial state', () => {
    const { result } = renderHook(() => useGameSession({ startLives: 3 }));
    act(() => {
      result.current.addScore(999);
      result.current.loseLife();
      result.current.bumpCombo();
    });
    act(() => result.current.reset());
    expect(result.current.score).toBe(0);
    expect(result.current.lives).toBe(3);
    expect(result.current.combo).toBe(0);
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.over).toBe(false);
    expect(result.current.attempts).toHaveLength(0);
  });
});
