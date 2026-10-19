// A table-deck cell counts for the daily streak like a Learn card does (Kálmán 2026-10-19: "minden tanulás számít"):
// the first answered cell of the day moves it (the same getDb().updateStreak, once a day), opening the deck or
// checking an answer that is not recorded yet does not, a second cell the same day adds nothing.
// Mock pattern: tableDeckFocus.play.test.tsx.

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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ topic: 'ser-estar' }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { addDays } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import TableDeckScreen from '../[topic]';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const TODAY = localDateString();
const YESTERDAY = addDays(TODAY, -1);

// types a (wrong) answer, checks it, moves on
const answerCell = async () => {
  fireEvent.changeText(screen.getByTestId('tabledeck-input'), 'zzz');
  fireEvent.press(screen.getByText('✓ Check'));
  await flush();
  fireEvent.press(screen.getByText('Next →'));
  await flush();
};

describe('table-deck: the daily streak', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    await db.setGameProgress('grammar', 'ser-estar:tabledeck', 'progress', undefined as never).catch(() => {});
    (db as any).__setStreakForTest({ current_count: 4, last_date: YESTERDAY, longest_count: 4 });
  });

  it('the first answered cell counts the day (opening and checking do not); the next cells the same day add nothing', async () => {
    render(<TableDeckScreen />);
    await flush();
    expect(await getDb().getStreak()).toEqual({ current_count: 4, last_date: YESTERDAY, longest_count: 4 });

    fireEvent.changeText(screen.getByTestId('tabledeck-input'), 'zzz');
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    expect(await getDb().getStreak()).toEqual({ current_count: 4, last_date: YESTERDAY, longest_count: 4 });

    fireEvent.press(screen.getByText('Next →'));
    await flush();
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: TODAY, longest_count: 5 });

    await answerCell();
    await answerCell();
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: TODAY, longest_count: 5 });
  });
});
