// Shared factories for the jest.mock calls that many tests repeat. Call them inside the factory, which
// jest hoists above the imports:
//   jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

export const speechMock = () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
});

// expo-router with only useFocusEffect, which runs its callback once on mount (no navigation container).
export const focusEffectRouterMock = () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
});
