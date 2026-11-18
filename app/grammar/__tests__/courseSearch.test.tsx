// The lesson search of the Grammar tab: typing keeps only the lessons whose title matches (all levels, level shown),
// clearing brings the normal list back; in both skins. Mock pattern: courseLevelTabs.test.tsx.

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

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { bigTestResultKey, bigTestRunKey } from '@/lib/grammar/bigTest';
import { grammarTabLevelKey } from '@/lib/grammar/levelTestRoute';
import { normalizeSearch } from '@/lib/grammar/lessonSearch';
import { syllabusForLevel, syllabusLevels } from '@/lib/grammar/syllabus';
import { saveResumeValue } from '@/lib/resumeStore';
import GrammarSyllabusScreen from '@/app/(tabs)/course';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(8);
const PAIR = 'en→es';
const all = () => syllabusLevels('es').flatMap((l) => syllabusForLevel(l, 'es'));
const QUERY = 'pron';
const matches = (tp: { title: Record<string, string> }) =>
  [tp.title.en, tp.title.es].some((x) => x && normalizeSearch(x).includes(QUERY));

describe.each([
  ['neo-brutalist', 'brand'],
  ['classic', 'classic'],
] as const)('grammar tab lesson search (%s list)', (_name, palette) => {
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
  const type = async (text: string) => {
    fireEvent.changeText(screen.getByTestId('grammar-search-input'), text);
    await flush();
  };

  it('has a search field with the placeholder and no clear button while empty; the normal list is untouched', async () => {
    await open();
    expect(screen.getByTestId('grammar-search-input').props.placeholder).toBe('Search lessons');
    expect(screen.queryByTestId('grammar-search-clear')).toBeNull();
    expect(screen.getByTestId('big-test-card')).toBeTruthy();
    expect(screen.getByTestId('grammar-level-A2')).toBeTruthy();
    expect(screen.getByTestId(`grammar-topic-${syllabusForLevel('A1', 'es')[0].id}`)).toBeTruthy();
  });

  it('typing keeps only the matching lessons of every level, with their level; clearing brings the list back', async () => {
    const hit = all().filter(matches);
    const miss = all().filter((tp) => !matches(tp));
    expect(hit.length).toBeGreaterThan(0);
    expect(miss.length).toBeGreaterThan(0);
    await open();
    await type('PRON');
    for (const tp of hit) {
      expect(screen.getByTestId(`grammar-topic-${tp.id}`)).toBeTruthy();
    }
    for (const tp of miss) {
      expect(screen.queryByTestId(`grammar-topic-${tp.id}`)).toBeNull();
    }
    // the level of a hit is shown next to its title
    const first = hit[0];
    expect(screen.getAllByText(new RegExp(` · ${first.level}$`)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('grammar-search-none')).toBeNull();

    fireEvent.press(screen.getByTestId('grammar-search-clear'));
    await flush();
    expect((screen.getByTestId('grammar-search-input').props.value as string)).toBe('');
    expect(screen.getByTestId('big-test-card')).toBeTruthy();
    expect(screen.getByTestId(`grammar-topic-${syllabusForLevel('A1', 'es')[0].id}`)).toBeTruthy();
    for (const tp of miss.filter((x) => x.level !== 'A1')) {
      expect(screen.queryByTestId(`grammar-topic-${tp.id}`)).toBeNull();
    }
  });

  it('the match ignores accents (the Spanish title is searched too)', async () => {
    const withAccent = all().find((tp) => tp.title.es && normalizeSearch(tp.title.es) !== tp.title.es.toLowerCase());
    expect(withAccent).toBeTruthy();
    await open();
    await type(normalizeSearch(withAccent!.title.es));
    expect(screen.getByTestId(`grammar-topic-${withAccent!.id}`)).toBeTruthy();
  });

  it('no match shows one "No lesson found" line and no lessons', async () => {
    await open();
    await type('zzzqqq');
    expect(screen.getByTestId('grammar-search-none')).toHaveTextContent('No lesson found');
    expect(screen.queryByTestId(`grammar-topic-${syllabusForLevel('A1', 'es')[0].id}`)).toBeNull();
  });
});
