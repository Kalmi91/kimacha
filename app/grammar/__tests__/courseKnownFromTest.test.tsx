// E129: a topic that was Strong in the last Big test gets a small "Known from the test" mark in the Grammar tab's
// lesson list, in both skins; the mark writes no evidence and moves no percent. Mock pattern: courseLevelTabs.test.tsx.

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

import { render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { bigTestResultKey, bigTestRunKey, loadBigTestKnownTopics } from '@/lib/grammar/bigTest';
import { grammarTabLevelKey } from '@/lib/grammar/levelTestRoute';
import { syllabusForLevel } from '@/lib/grammar/syllabus';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import GrammarSyllabusScreen from '@/app/(tabs)/course';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(8);
const PAIR = 'en→es';
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const [T1, T2] = syllabusForLevel('A1', 'es').map((tp) => tp.id);

const stored = (strong: string[] | undefined, needsPractice: string[] = []) => ({
  level: 'A1',
  perLevel: LEVELS.map((l) => ({ level: l, right: 0, total: 9, taken: false })),
  needsPractice,
  ...(strong ? { strong } : {}),
  at: '2026-11-16T10:00:00.000Z',
});

describe.each([
  ['neo-brutalist', 'brand'],
  ['classic', 'classic'],
] as const)('Known from the test mark (%s list)', (_name, palette) => {
  beforeEach(async () => {
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
  const pct = (id: string) => screen.getByTestId(`grammar-percent-${id}`).props.children;
  const overall = () => screen.getByTestId('grammar-overall-bar').props.children;

  it('no result: no mark', async () => {
    await open();
    expect(screen.queryByTestId(`grammar-known-${T1}`)).toBeNull();
  });

  it('a Strong topic gets the mark, the others do not; percents stay the same and no evidence is written', async () => {
    await open();
    const before = { p1: pct(T1), p2: pct(T2), all: overall() };
    screen.unmount();
    const rowsBefore = JSON.stringify(await getDb().getGameProgress('grammar-random'));
    await saveResumeValue(getDb(), bigTestResultKey(PAIR), stored([T1]));
    await open();
    expect(screen.getByTestId(`grammar-known-${T1}`)).toHaveTextContent('Known from the test');
    expect(screen.queryByTestId(`grammar-known-${T2}`)).toBeNull();
    expect({ p1: pct(T1), p2: pct(T2), all: overall() }).toEqual(before);
    expect(JSON.stringify(await getDb().getGameProgress('grammar-random'))).toBe(rowsBefore);
  });

  it('only the latest result counts: a later result without the topic drops the mark', async () => {
    await saveResumeValue(getDb(), bigTestResultKey(PAIR), stored([T1]));
    await saveResumeValue(getDb(), bigTestResultKey(PAIR), stored([T2], [T1]));
    await open();
    expect(screen.queryByTestId(`grammar-known-${T1}`)).toBeNull();
    expect(screen.getByTestId(`grammar-known-${T2}`)).toBeTruthy();
  });

  it('an old result without a strong list: no mark, no error', async () => {
    await saveResumeValue(getDb(), bigTestResultKey(PAIR), { ...stored(undefined), strong: undefined });
    await open();
    expect(screen.queryByTestId(`grammar-known-${T1}`)).toBeNull();
    expect(await loadBigTestKnownTopics(getDb(), PAIR)).toEqual(new Set());
    expect(await loadResumeValue(getDb(), bigTestResultKey(PAIR))).toBeTruthy();
  });
});
