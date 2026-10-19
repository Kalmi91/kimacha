// A grammar drill counts for the daily streak like a Learn card does (Kálmán 2026-10-19: "minden tanulás számít"):
// the first answered item of the day moves it (the same getDb().updateStreak, once a day), opening the lesson or
// starting the drill does not, a second round the same day adds nothing, and the round-end screen shows the new count.
// Mock pattern: roundEndBrutal.test.tsx, answering: kindPercent.play.test.tsx.

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
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: 'ser-estar' }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { addDays } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import GrammarLessonScreen from '../[topic]';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

// ser-estar's form items minus the 2 vosotros ones, in authored order (a round of 10; form items are not shuffled).
const FORM_ANSWERS = ['soy', 'estoy', 'eres', 'estás', 'es', 'está', 'somos', 'estamos', 'son', 'están'];

const answerForm = async (i: number, right = true) => {
  fireEvent.changeText(screen.getByTestId('formInput'), right ? FORM_ANSWERS[i] : 'xxx');
  fireEvent.press(screen.getByTestId('formCheck'));
  await flush(1);
  fireEvent.press(screen.getByTestId('grammar-next'));
  await flush(1);
};

const TODAY = localDateString();
const YESTERDAY = addDays(TODAY, -1);

describe('grammar drill: the daily streak', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette('brand');
    // clean slate: the web DB lives in memory between the tests
    for (const suffix of ['best', 'run', 'done']) {
      await db.setGameProgress(GRAMMAR_PROGRESS_KEY, `ser-estar:form:${suffix}`, 'cleared', null);
    }
    (db as any).__setStreakForTest({ current_count: 4, last_date: YESTERDAY, longest_count: 4 });
  });

  it('the first answered item counts the day (opening and starting do not); the round end shows it; a second round adds nothing', async () => {
    render(<ThemeProvider><GrammarLessonScreen /></ThemeProvider>);
    await flush(4);
    fireEvent.press(screen.getByTestId('grammar-start-form'));
    await flush(1);
    expect(await getDb().getStreak()).toEqual({ current_count: 4, last_date: YESTERDAY, longest_count: 4 });

    await answerForm(0);
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: TODAY, longest_count: 5 });
    for (let i = 1; i < 10; i++) await answerForm(i);
    await flush(2);
    expect(screen.getByTestId('grammar-score')).toBeTruthy();
    expect(screen.queryByText('🔥 5')).toBeTruthy();

    fireEvent.press(screen.getByTestId('grammar-practice-again'));
    await flush(1);
    await answerForm(0, false);
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: TODAY, longest_count: 5 });
  });

  it('a wrong answer is a done task too (like "Again" on a Learn card)', async () => {
    render(<ThemeProvider><GrammarLessonScreen /></ThemeProvider>);
    await flush(4);
    fireEvent.press(screen.getByTestId('grammar-start-form'));
    await flush(1);
    await answerForm(0, false);
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: TODAY, longest_count: 5 });
  });
});
