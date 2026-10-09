// PLAN-vizsga B. szakasz (B3 a): a Nyelvtan fül listájában a lecke végi teszten átment
// lecke "Test passed" jelet kap a %-jel mellett; a bukott vagy meg nem próbált nem.
// Mock-minta: courseBrutal.test.tsx.

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

import { act, render, screen } from '@testing-library/react-native';

import GrammarSyllabusScreen from '@/app/(tabs)/course';
import { getDb } from '@/lib/database.web';
import { t } from '@/lib/i18n';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { lessonTestKey, mergeLessonTestResult } from '@/lib/grammar/lessonTest';
import { ThemeProvider } from '@/lib/ThemeContext';

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe.each(['brand', 'classic'] as const)('kurzus-lista: "Test passed" jel (%s paletta)', (palette) => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette(palette);
    await db.resetGameProgress(GRAMMAR_PROGRESS_KEY);
  });

  it('csak az átment lecke kap jelet', async () => {
    const db = getDb();
    await db.setGameProgress(GRAMMAR_PROGRESS_KEY, lessonTestKey('presente-regular'), 'passed', mergeLessonTestResult(null, 9, 10, '2026-10-01', []));
    await db.setGameProgress(GRAMMAR_PROGRESS_KEY, lessonTestKey('ser-estar'), 'failed', mergeLessonTestResult(null, 5, 10, '2026-10-01', ['x']));
    const view = render(
      <ThemeProvider>
        <GrammarSyllabusScreen />
      </ThemeProvider>
    );
    await flush();
    expect(screen.getByTestId('grammar-test-passed-presente-regular')).toBeTruthy();
    expect(screen.queryByTestId('grammar-test-passed-ser-estar')).toBeNull();
    expect(screen.queryByTestId('grammar-test-passed-posesivos')).toBeNull();
    view.unmount();
  });

  it('a teszt-sor nem számít a lecke %-ába: csak teszt-sorral a lecke nem "elkezdett"', async () => {
    await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, lessonTestKey('presente-regular'), 'passed', mergeLessonTestResult(null, 10, 10, '2026-10-01', []));
    const view = render(
      <ThemeProvider>
        <GrammarSyllabusScreen />
      </ThemeProvider>
    );
    await flush();
    expect(screen.getByTestId('grammar-percent-presente-regular')).toHaveTextContent(t().grammar.notStarted);
    view.unmount();
  });
});
