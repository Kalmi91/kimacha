// a brutalista kurzus-lista: fejléc streak-matricával, szint-dobozok
// (aktív = a), kész = DONE matrica, folyamatban = b kitöltés + szegmentált
// sáv, zárt = szaggatott doboz. A classic paletta a mai kinézet.
// Mock-minta: course.play.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PALETTE_FILLS } from '@/constants/GrammarPalettes';
import { getDb } from '@/lib/database.web';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import GrammarSyllabusScreen from '@/app/(tabs)/course';
import { ThemeProvider } from '@/lib/ThemeContext';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

describe('course list, neo-brutalist', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette('brand');
  });

  it('streak sticker, active level box with a, core sticker, weekly goal box', async () => {
    await getDb().updateStreak();
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush();
    expect(screen.queryByText('🔥 1')).toBeTruthy();
    expect(style('grammar-level-A1').backgroundColor).toBe(PALETTE_FILLS.brand.a);
    expect(style('grammar-level-A2').backgroundColor).toBe('#FFFFFF');
    expect(screen.queryAllByTestId(/^grammar-core(-plus)?-/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Weekly goal')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-level-A2'));
    await flush(1);
    expect(screen.queryByTestId('grammar-topic-futuro-simple')).toBeTruthy();
    expect(screen.queryByTestId('grammar-topic-presente-regular')).toBeNull();
    view.unmount();
  });

  it('a finished topic gets a DONE sticker, one in progress gets a b fill and a segmented bar', async () => {
    const db = getDb();
    await db.setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-regular', 'done', { correct: 10, total: 12 });
    await db.setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-irregular:choice', 'started', { correct: 6, total: 10 });
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush();
    expect(screen.queryByText('✓ 83%')).toBeTruthy();
    expect(screen.queryAllByText('done').length).toBeGreaterThan(0);
    view.unmount();
  });

  it('with the classic palette the current (non-brutalist) list shows: no sticker rotation', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush(6);
    expect(screen.queryByTestId('grammar-streak')).toBeNull();
    expect(screen.queryByTestId('grammar-topic-presente-regular')).toBeTruthy();
    view.unmount();
  });
});
