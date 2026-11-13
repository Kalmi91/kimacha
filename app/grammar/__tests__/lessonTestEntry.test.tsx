jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: 'presente-regular' }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { kindBestKey } from '@/lib/grammar/lessonScore';
import { lessonTestKey, mergeLessonTestResult } from '@/lib/grammar/lessonTest';
import { GRAMMAR_PROGRESS_KEY, lessonFor, scoredKinds } from '@/lib/grammar/syllabus';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';
import GrammarLessonScreen from '../[topic]';

const TOPIC = 'presente-regular';
const BUTTON = 'grammar-lesson-start-lessontest';
const flush = makeFlush(4);
const press = async (testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};

describe.each(['brand', 'classic'] as const)('lesson-page test entry (%s palette)', (palette) => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette(palette);
    await db.resetGameProgress(GRAMMAR_PROGRESS_KEY);
  });

  const open = async () => {
    const view = render(<ThemeProvider><GrammarLessonScreen /></ThemeProvider>);
    await flush();
    return view;
  };

  const unlock = async () => {
    for (const kind of scoredKinds(lessonFor('es', TOPIC)!)) {
      await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, kindBestKey(TOPIC, kind), 'best', { correct: 6, total: 10 });
    }
  };

  it('shows the existing label before practice and keeps the practice requirement', async () => {
    await open();
    expect(screen.getByTestId(BUTTON)).toHaveTextContent('Take the lesson test');
    expect(screen.getByTestId(BUTTON)).toBeDisabled();
    expect(screen.getByText('Finish all practice types first')).toBeTruthy();
    await press(BUTTON);
    expect(screen.queryByTestId('lesson-test-counter')).toBeNull();
  });

  it('starts the test from the lesson and offers it again after leaving and reopening', async () => {
    await unlock();
    const before = await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY);
    const view = await open();
    expect(screen.getByTestId(BUTTON)).not.toBeDisabled();
    await press(BUTTON);
    expect(screen.getByTestId('lesson-test-counter')).toHaveTextContent('Question 1 / 10');
    await press('lesson-test-close');
    await press('lesson-test-leave');
    expect(screen.getByTestId(BUTTON)).not.toBeDisabled();
    await press(BUTTON);
    expect(screen.getByTestId('lesson-test-counter')).toHaveTextContent('Question 1 / 10');
    await press('lesson-test-close');
    await press('lesson-test-leave');
    view.unmount();
    await open();
    expect(screen.getByTestId(BUTTON)).not.toBeDisabled();
    expect(await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY)).toEqual(before);
  });

  it.each([5, 9])('allows a retake after a saved %i/10 result and preserves the badge and progress', async (correct) => {
    await unlock();
    await getDb().setGameProgress(
      GRAMMAR_PROGRESS_KEY,
      lessonTestKey(TOPIC),
      correct >= 8 ? 'passed' : 'failed',
      mergeLessonTestResult(null, correct, 10, '2026-11-12', []),
    );
    const before = await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY);
    await open();
    const expectBadge = () => {
      if (correct >= 8) expect(screen.getByTestId('grammar-test-passed')).toHaveTextContent(/^✓ Test passed · best 90%$/);
      else expect(screen.queryByTestId('grammar-test-passed')).toBeNull();
    };
    expectBadge();
    expect(screen.getByTestId(BUTTON)).not.toBeDisabled();
    await press(BUTTON);
    expect(screen.getByTestId('lesson-test-counter')).toHaveTextContent('Question 1 / 10');
    await press('lesson-test-close');
    await press('lesson-test-leave');
    expectBadge();
    expect(screen.getByTestId(BUTTON)).not.toBeDisabled();
    expect(await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY)).toEqual(before);
  });
});
