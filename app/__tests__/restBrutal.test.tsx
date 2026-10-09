// The Credits screen on the brutalist palette (BrutalBox / BrutalButton),
// today's look on the classic palette. Mock pattern: credits.test.tsx, onboarding.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

import { act, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import CreditsScreen from '../credits';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Credits, neo-brutalista (NY19)', () => {
  it('Credits: brand palettán BrutalBox kártya, classic palettán nincs', async () => {
    await getDb().setGrammarPalette('brand');
    const brand = render(<ThemeProvider><CreditsScreen /></ThemeProvider>);
    await flush();
    expect(brand.queryByTestId('credits-card')).toBeTruthy();
    brand.unmount();

    await getDb().setGrammarPalette('classic');
    const classic = render(<ThemeProvider><CreditsScreen /></ThemeProvider>);
    await flush();
    expect(classic.queryByTestId('credits-card')).toBeNull();
    classic.unmount();
  });
});
