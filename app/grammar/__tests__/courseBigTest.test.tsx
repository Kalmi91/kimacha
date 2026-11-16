// The Grammar tab's Big test card: at the top, only for a course with test data, with the Start / Continue / Start again
// button, the last-result line, in both the neo-brutalist and the classic list.
// Mock pattern: courseRandom.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { bigTestItems, bigTestResultKey, bigTestRunKey, answerBigTest, newBigTestRun } from '@/lib/grammar/bigTest';
import { saveResumeValue } from '@/lib/resumeStore';
import GrammarSyllabusScreen from '@/app/(tabs)/course';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(6);
const PAIR = 'en→es';

const storedResult = (level: string) => ({
  level,
  perLevel: ['A1', 'A2', 'B1', 'B2', 'C1'].map((l) => ({ level: l, right: 0, total: 9, taken: false })),
  needsPractice: [],
  strong: [],
  at: '2026-11-16T10:00:00.000Z',
});

describe.each([
  ['neo-brutalist', 'brand'],
  ['classic', 'classic'],
] as const)('grammar tab, Big test card (%s list)', (_name, palette) => {
  beforeEach(async () => {
    mockPush.mockClear();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette(palette);
    await saveResumeValue(db, bigTestRunKey(PAIR), null);
    await saveResumeValue(db, bigTestResultKey(PAIR), null);
  });
  afterAll(async () => {
    await getDb().setOnboarding('en', 'es');
    await saveResumeValue(getDb(), bigTestRunKey(PAIR), null);
    await saveResumeValue(getDb(), bigTestResultKey(PAIR), null);
  });

  const open = async () => {
    render(
      <ThemeProvider>
        <GrammarSyllabusScreen />
      </ThemeProvider>
    );
    await flush();
  };

  it('shows the card for a Spanish course: title, subtitle, "Start" to a new run, no last-result line', async () => {
    await open();
    expect(screen.getByTestId('big-test-card')).toBeTruthy();
    expect(screen.getByText('Big test')).toBeTruthy();
    expect(screen.getByText('A1–C1 · 45 questions')).toBeTruthy();
    expect(screen.getByTestId('big-test-start')).toHaveTextContent('Start');
    expect(screen.queryByTestId('big-test-last-result')).toBeNull();
    fireEvent.press(screen.getByTestId('big-test-start'));
    expect(mockPush).toHaveBeenCalledWith('/grammar/big-test?new=1');
  });

  it('does not show the card for a course without test data', async () => {
    await getDb().setOnboarding('en', 'de');
    await open();
    expect(screen.queryByTestId('big-test-card')).toBeNull();
    expect(screen.queryByTestId('big-test-start')).toBeNull();
  });

  it('a course that has lessons but no Big test data (Spanish speaker learning English): the normal list, no card', async () => {
    await getDb().setOnboarding('es', 'en');
    await open();
    expect(screen.getByTestId('grammar-random-start')).toBeTruthy();
    expect(screen.queryByTestId('grammar-no-course')).toBeNull();
    expect(screen.queryByTestId('big-test-card')).toBeNull();
    expect(screen.queryByTestId('big-test-start')).toBeNull();
  });

  it('a stored result: "Start again" to a new run and the tappable last-result line to the stored result', async () => {
    await saveResumeValue(getDb(), bigTestResultKey(PAIR), storedResult('B1'));
    await open();
    expect(screen.getByTestId('big-test-start')).toHaveTextContent('Start again');
    expect(screen.getByTestId('big-test-last-result')).toHaveTextContent('Last result: B1');
    fireEvent.press(screen.getByTestId('big-test-last-result'));
    expect(mockPush).toHaveBeenLastCalledWith('/grammar/big-test');
    fireEvent.press(screen.getByTestId('big-test-start'));
    expect(mockPush).toHaveBeenLastCalledWith('/grammar/big-test?new=1');
  });

  it('a run in progress: "Continue" opens the screen without ?new=1, even with a stored result', async () => {
    const run = answerBigTest(newBigTestRun(), bigTestItems('es', 'A1')[0], 0);
    await saveResumeValue(getDb(), bigTestRunKey(PAIR), run);
    await saveResumeValue(getDb(), bigTestResultKey(PAIR), storedResult('A2'));
    await open();
    expect(screen.getByTestId('big-test-start')).toHaveTextContent('Continue');
    fireEvent.press(screen.getByTestId('big-test-start'));
    expect(mockPush).toHaveBeenLastCalledWith('/grammar/big-test');
  });

  it('the buttons are named buttons', async () => {
    await saveResumeValue(getDb(), bigTestResultKey(PAIR), storedResult('A1'));
    await open();
    for (const id of ['big-test-start', 'big-test-last-result']) {
      expect(screen.getByTestId(id).props.accessibilityRole).toBe('button');
      expect(screen.getByTestId(id).props.accessibilityLabel).toBeTruthy();
    }
  });
});
