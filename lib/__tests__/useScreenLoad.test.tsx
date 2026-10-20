// useSingleFlight: a run while another one with the same key is in flight does nothing. useScreenLoad: the
// focus load runs once at a time and only raises the loading state while the screen has no data yet.

let mockFocus: (() => void | (() => void)) | null = null;
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    mockFocus = cb;
    useEffect(cb, []);
  },
}));

import { act, renderHook } from '@testing-library/react-native';

import { useScreenLoad } from '../useScreenLoad';
import { useSingleFlight } from '../useSingleFlight';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

// A loader that stays in flight until the test lets it finish.
const gate = () => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
};

describe('useSingleFlight', () => {
  it('skips a run while one is in flight, and runs again after it settled', async () => {
    const { result } = renderHook(() => useSingleFlight());
    const first = gate();
    const task = jest.fn(() => first.wait.then(() => 'first'));
    const second = jest.fn(async () => 'second');

    let firstResult: Promise<string | undefined>;
    act(() => {
      firstResult = result.current(task);
    });
    let skipped: string | undefined = 'untouched';
    await act(async () => {
      skipped = await result.current(second);
    });
    expect(skipped).toBeUndefined();
    expect(second).not.toHaveBeenCalled();

    first.release();
    await act(async () => {
      expect(await firstResult).toBe('first');
    });
    await act(async () => {
      expect(await result.current(second)).toBe('second');
    });
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('releases the slot when the task throws, and lets the error through', async () => {
    const { result } = renderHook(() => useSingleFlight());
    await act(async () => {
      await expect(result.current(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    });
    await act(async () => {
      expect(await result.current(async () => 'again')).toBe('again');
    });
  });

  it('a run with another key is not swallowed by the one in flight', async () => {
    const { result } = renderHook(() => useSingleFlight());
    const first = gate();
    const other = jest.fn(async () => 'other');
    act(() => {
      void result.current(() => first.wait, 'a');
    });
    await act(async () => {
      expect(await result.current(other, 'b')).toBe('other');
    });
    first.release();
    await flush();
  });
});

describe('useScreenLoad', () => {
  beforeEach(() => {
    mockFocus = null;
  });

  it('raises the loading state on the first focus, when there is no data yet', async () => {
    const setLoading = jest.fn();
    const load = jest.fn(async () => {});
    renderHook(() => useScreenLoad(load, { hasData: false, setLoading }));
    await flush();
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('refreshes quietly (no loading state) when the screen already has data', async () => {
    const setLoading = jest.fn();
    const load = jest.fn(async () => {});
    renderHook(() => useScreenLoad(load, { hasData: true, setLoading }));
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(setLoading).not.toHaveBeenCalled();
    act(() => {
      mockFocus!();
    });
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(setLoading).not.toHaveBeenCalled();
  });

  it('does not start a second load while one is in flight', async () => {
    const running = gate();
    const load = jest.fn(() => running.wait);
    renderHook(() => useScreenLoad(load));
    await flush();
    act(() => {
      mockFocus!();
    });
    expect(load).toHaveBeenCalledTimes(1);

    running.release();
    await flush();
    act(() => {
      mockFocus!();
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('runs onBlur when the screen loses focus', async () => {
    const onBlur = jest.fn();
    const { unmount } = renderHook(() => useScreenLoad(async () => {}, { onBlur }));
    await flush();
    expect(onBlur).not.toHaveBeenCalled();
    unmount();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
