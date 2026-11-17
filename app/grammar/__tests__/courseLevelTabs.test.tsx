// The Grammar tab as sketched: Big test card, A1-C1 level buttons (one level selected, its lessons below), the overall
// "Your level" bar, one test row per level; in both skins. Mock pattern: courseBigTest.test.tsx.

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
import { StyleSheet } from 'react-native';

import { getDb } from '@/lib/database.web';
import { bigTestResultKey, bigTestRunKey } from '@/lib/grammar/bigTest';
import { grammarTabLevelKey, hasSmallTest, levelTestRoute } from '@/lib/grammar/levelTestRoute';
import { syllabusForLevel } from '@/lib/grammar/syllabus';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import GrammarSyllabusScreen from '@/app/(tabs)/course';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(8);
const PAIR = 'en→es';
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

const storedResult = (level: string) => ({
  level,
  perLevel: LEVELS.map((l) => ({ level: l, right: 0, total: 9, taken: false })),
  needsPractice: [],
  strong: [],
  at: '2026-11-16T10:00:00.000Z',
});

it('the small-test decision lives in one place: A1 has a Small test, the other levels use the level test', () => {
  expect(hasSmallTest('A1')).toBe(true);
  expect(hasSmallTest('A2')).toBe(false);
  expect(levelTestRoute('A1')).toBe('/grammar/small-test?level=a1');
  expect(levelTestRoute('B2')).toBe('/grammar/level-test?level=B2');
});

describe.each([
  ['neo-brutalist', 'brand'],
  ['classic', 'classic'],
] as const)('grammar tab level buttons (%s list)', (_name, palette) => {
  beforeEach(async () => {
    mockPush.mockClear();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette(palette);
    await saveResumeValue(db, bigTestRunKey(PAIR), null);
    await saveResumeValue(db, bigTestResultKey(PAIR), null);
    await saveResumeValue(db, grammarTabLevelKey(PAIR), null);
  });
  afterAll(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    await saveResumeValue(db, bigTestResultKey(PAIR), null);
    await saveResumeValue(db, grammarTabLevelKey(PAIR), null);
  });

  const open = async () => {
    render(
      <ThemeProvider>
        <GrammarSyllabusScreen />
      </ThemeProvider>
    );
    await flush();
  };
  const selected = (lvl: string) => screen.getByTestId(`grammar-level-${lvl}`).props.accessibilityState?.selected === true;

  it('shows the Big test card, five level buttons, the overall bar and a test row per level; nothing else is lost', async () => {
    await open();
    expect(screen.getByTestId('big-test-card')).toBeTruthy();
    for (const l of LEVELS) {
      expect(screen.getByTestId(`grammar-level-${l}`)).toBeTruthy();
      expect(screen.getByTestId(`grammar-test-row-${l}`)).toBeTruthy();
    }
    expect(screen.getByTestId('grammar-overall-bar')).toHaveTextContent(/^Your level: A1 · overall \d+%$/);
    // what the tab had before stays reachable
    expect(screen.getByTestId('grammar-random-start')).toBeTruthy();
    expect(screen.getByTestId('grammar-level-test-A1')).toBeTruthy();
    expect(screen.getByTestId('grammar-level-standing-A1')).toBeTruthy();
    expect(screen.getByTestId('grammar-exam-strip-A1')).toBeTruthy();
    expect(screen.getByTestId(`grammar-topic-${syllabusForLevel('A1', 'es')[0].id}`)).toBeTruthy();
  });

  it('one level at a time: pressing a level button shows its lessons and hides the other level\'s', async () => {
    await open();
    const a1 = syllabusForLevel('A1', 'es')[0].id;
    const a2 = syllabusForLevel('A2', 'es')[0].id;
    expect(selected('A1')).toBe(true);
    expect(selected('A2')).toBe(false);
    expect(screen.queryByTestId(`grammar-topic-${a2}`)).toBeNull();
    fireEvent.press(screen.getByTestId('grammar-level-A2'));
    await flush();
    expect(selected('A2')).toBe(true);
    expect(selected('A1')).toBe(false);
    expect(screen.getByTestId(`grammar-topic-${a2}`)).toBeTruthy();
    expect(screen.queryByTestId(`grammar-topic-${a1}`)).toBeNull();
    // pressing the selected level again keeps it selected (no empty tab)
    fireEvent.press(screen.getByTestId('grammar-level-A2'));
    await flush();
    expect(selected('A2')).toBe(true);
  });

  it('the default is the level of the last Big test; the overall bar names it', async () => {
    await saveResumeValue(getDb(), bigTestResultKey(PAIR), storedResult('B1'));
    await open();
    expect(selected('B1')).toBe(true);
    expect(screen.getByTestId('grammar-overall-bar')).toHaveTextContent(/^Your level: B1 · overall \d+%$/);
  });

  it('the choice is saved and wins over the Big test level after leaving and reopening the tab', async () => {
    await saveResumeValue(getDb(), bigTestResultKey(PAIR), storedResult('B1'));
    await open();
    fireEvent.press(screen.getByTestId('grammar-level-A2'));
    await flush();
    expect(await loadResumeValue(getDb(), grammarTabLevelKey(PAIR))).toBe('A2');
    screen.unmount();
    await open();
    expect(selected('A2')).toBe(true);
    expect(selected('B1')).toBe(false);
  });

  it('a damaged saved choice falls back to the default', async () => {
    await saveResumeValue(getDb(), grammarTabLevelKey(PAIR), 'Z9');
    await open();
    expect(selected('A1')).toBe(true);
  });

  it('the A1 test row starts the Small test, the other rows start the level test', async () => {
    await open();
    fireEvent.press(screen.getByTestId('grammar-test-row-A1'));
    expect(mockPush).toHaveBeenLastCalledWith('/grammar/small-test?level=a1');
    for (const l of ['A2', 'B1', 'B2', 'C1']) {
      fireEvent.press(screen.getByTestId(`grammar-test-row-${l}`));
      expect(mockPush).toHaveBeenLastCalledWith(`/grammar/level-test?level=${l}`);
    }
  });

  it('a test row reads "A1 level test N%" and is a named button', async () => {
    await open();
    const row = screen.getByTestId('grammar-test-row-A1');
    expect(row).toHaveTextContent(/A1 level test \d+%/);
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityLabel).toMatch(/A1 level test/);
  });

  it('level buttons and test rows are at least tap-target sized', async () => {
    await open();
    for (const id of ['grammar-level-A1', 'grammar-test-row-A1']) {
      expect(StyleSheet.flatten(screen.getByTestId(id).props.style).minHeight).toBeGreaterThanOrEqual(44);
    }
  });
});
