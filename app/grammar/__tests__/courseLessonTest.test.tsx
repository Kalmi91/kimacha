// in the Grammar tab's list, a lesson that passed its end-of-lesson test
// gets a "Test passed" mark next to the %; a failed or not-attempted one does not.
// Mock pattern: courseBrutal.test.tsx.

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

describe.each(['brand', 'classic'] as const)('course list: "Test passed" mark (%s palette)', (palette) => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette(palette);
    await db.resetGameProgress(GRAMMAR_PROGRESS_KEY);
  });

  it('only a passed lesson gets a mark', async () => {
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

  it('the test row does not count toward the lesson %: with only a test row the lesson is not "started"', async () => {
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
