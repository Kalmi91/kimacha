// a lecke-oldal neo-brutalista formákkal: fejléc (vissza-doboz, cím,
// szint-matrica), kártyák BrutalBox-ban, tábla-rács ink kerettel, kitöltésű
// indító-gombok. A classic paletta a mai kinézet. Mock-minta: lessonV2.play.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: 'ser-estar' }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PALETTE_FILLS } from '@/constants/GrammarPalettes';
import { getDb } from '@/lib/database.web';
import { ThemeProvider } from '@/lib/ThemeContext';
import GrammarLessonScreen from '../[topic]';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('lecke-oldal, neo-brutalista (NY23)', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette('brand');
  });

  it('a vissza-doboz, a kitöltésű indító-gomb és a tábla megvan, a gomb az a-színnel', async () => {
    const view = render(<ThemeProvider><GrammarLessonScreen /></ThemeProvider>);
    await flush();
    expect(screen.queryByTestId('grammar-back')).toBeTruthy();
    expect(screen.queryByTestId('table-ser-presente')).toBeTruthy();
    const start = screen.getByTestId('grammar-start-choice');
    expect(StyleSheet.flatten(start.props.style).backgroundColor).toBe(PALETTE_FILLS.brand.a);
    view.unmount();
  });

  it('classic palettával a mai oldal jelenik meg (nincs vissza-doboz)', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><GrammarLessonScreen /></ThemeProvider>);
    await flush(6);
    expect(screen.queryByTestId('grammar-back')).toBeNull();
    const start = screen.getByTestId('grammar-start-choice');
    expect(StyleSheet.flatten(start.props.style)).toMatchObject({ borderRadius: 26 });
    fireEvent.press(start);
    view.unmount();
  });
});
