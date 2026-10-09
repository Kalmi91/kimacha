// the lesson page with neo-brutalist shapes: header (back box, title,
// level sticker), cards in a BrutalBox, table grid with an ink border, filled
// start buttons. The classic palette is today's look. Mock pattern: lessonV2.play.test.tsx.

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

describe('lesson page, neo-brutalist', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette('brand');
  });

  it('the back box, the filled start button and the table are present, the button uses the a color', async () => {
    const view = render(<ThemeProvider><GrammarLessonScreen /></ThemeProvider>);
    await flush();
    expect(screen.queryByTestId('grammar-back')).toBeTruthy();
    expect(screen.queryByTestId('table-ser-presente')).toBeTruthy();
    const start = screen.getByTestId('grammar-start-choice');
    expect(StyleSheet.flatten(start.props.style).backgroundColor).toBe(PALETTE_FILLS.brand.a);
    view.unmount();
  });

  it('with the classic palette the current page shows (no back box)', async () => {
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
