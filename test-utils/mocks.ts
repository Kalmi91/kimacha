// Shared factories for the jest.mock calls that many tests repeat. Call them inside the factory, which
// jest hoists above the imports:
//   jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

// speakAuto (a new card's own read-aloud) lands on `speak`, as after the learner's first touch; the silent
// start itself is tested in lib/__tests__/speechQuietStart.test.ts.
export const speechMock = () => {
  const speak = jest.fn();
  return {
    speak,
    speakAuto: jest.fn((...args: unknown[]) => speak(...args)),
    speakSequence: jest.fn(),
    stopSpeaking: jest.fn(),
  };
};

// expo-router with only useFocusEffect, which runs its callback once on mount (no navigation container).
export const focusEffectRouterMock = () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
});
