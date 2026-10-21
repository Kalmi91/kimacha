// the "Practice the table" button only where the
// lesson actually has a conjugation table (lib/grammar/tableDeck.ts already
// excludes reference GridTables and legacy schema-1 lessons).

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

let mockTopicId = 'ser-estar';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush, replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: mockTopicId }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import GrammarLessonScreen from '../[topic]';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(4);

describe('grammar lesson screen: table-deck button', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
  });

  it('ser-estar (2 conjugation tables) shows the deck button with the cell count', async () => {
    mockTopicId = 'ser-estar';
    const view = render(<GrammarLessonScreen />);
    await flush();

    expect(screen.getByTestId('grammar-start-tabledeck')).toBeTruthy();
    expect(screen.getByText('Practice the table · 10 cells')).toBeTruthy();

    fireEvent.press(screen.getByTestId('grammar-start-tabledeck'));
    expect(mockPush).toHaveBeenCalledWith('/grammar/deck/ser-estar');

    view.unmount();
  });

  it('hay-estar (reference tables only, no conjugation table) has no deck button', async () => {
    mockTopicId = 'hay-estar';
    const view = render(<GrammarLessonScreen />);
    await flush();

    expect(screen.queryByTestId('grammar-start-tabledeck')).toBeFalsy();

    view.unmount();
  });

  // the person table (every row is a personal pronoun, the header is not
  // all infinitives) can be quizzed, so it gets a button; the old "posesivos = schema-1, no button"
  // test became outdated when posesivos moved to schema-2.
  it('a person table (pronombres-oi) gets the deck button, 5 cells (vosotros dropped)', async () => {
    mockTopicId = 'pronombres-oi';
    const view = render(<GrammarLessonScreen />);
    await flush();

    expect(screen.getByTestId('grammar-start-tabledeck')).toBeTruthy();
    expect(screen.getByText('Practice the table · 5 cells')).toBeTruthy();

    view.unmount();
  });
  // the word deck is built only from the table's words;
  // where that stays below the threshold, there is no deck entry (and no crash).
  it('hay-estar (table words below the threshold) gets no word-deck entry', async () => {
    mockTopicId = 'hay-estar';
    const view = render(<GrammarLessonScreen />);
    await flush();

    expect(screen.queryByTestId('grammar-start-worddeck')).toBeFalsy();

    view.unmount();
  });

  // The deck of articulos-genero is the lesson's own table nouns (with their article, "la casa"),
  // not the earlier deck built from all the app's nouns; it has no conjugation table deck.
  it('articulos-genero (its article nouns reach the threshold) gets a word-deck entry, no table deck', async () => {
    mockTopicId = 'articulos-genero';
    const view = render(<GrammarLessonScreen />);
    await flush();

    expect(screen.getByTestId('grammar-start-worddeck')).toBeTruthy();
    expect(screen.queryByTestId('grammar-start-tabledeck')).toBeFalsy();

    view.unmount();
  });

  it('marcadores-temporales (enough table words) keeps the word-deck entry', async () => {
    mockTopicId = 'marcadores-temporales';
    const view = render(<GrammarLessonScreen />);
    await flush();

    expect(screen.getByTestId('grammar-start-worddeck')).toBeTruthy();

    view.unmount();
  });
});
