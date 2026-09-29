// NY19: a Helyesírás és a Credits képernyő brutalista palettán (BrutalBox / BrutalButton),
// classic palettán a mai kinézet. Mock-minta: credits.test.tsx, onboarding.test.tsx.

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, []);
  },
}));

import { act, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import CreditsScreen from '../credits';
import SpellingScreen from '../spelling';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Credits és Helyesírás, neo-brutalista (NY19)', () => {
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

  it('Helyesírás (üres lista): brand palettán BrutalButton, classic palettán a mai gomb', async () => {
    await getDb().setGrammarPalette('brand');
    const brand = render(<ThemeProvider><SpellingScreen /></ThemeProvider>);
    await flush();
    expect(brand.queryByTestId('spelling-back')).toBeTruthy();
    brand.unmount();

    await getDb().setGrammarPalette('classic');
    const classic = render(<ThemeProvider><SpellingScreen /></ThemeProvider>);
    await flush();
    expect(classic.queryByTestId('spelling-back')).toBeNull();
    classic.unmount();
  });
});
