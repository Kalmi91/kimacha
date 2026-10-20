import { act } from '@testing-library/react-native';

// Lets pending promise callbacks run (database reads, effects that await), one microtask turn per
// round, each inside act(). `makeFlush(n)` gives a flush whose default is n rounds. This only drains
// microtasks; to wait for a state that needs more than that (a database round trip under load), use
// waitFor / findBy* and assert the end state.
export const makeFlush = (defaultTimes = 6) => async (times = defaultTimes): Promise<void> => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

export const flush = makeFlush();
