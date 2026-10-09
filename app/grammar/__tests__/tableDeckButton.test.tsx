// the "Practice the table" button only where the
// lesson actually has a conjugation table (lib/grammar/tableDeck.ts already
// excludes reference GridTables and legacy schema-1 lessons).

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

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import GrammarLessonScreen from '../[topic]';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

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
  // A later change restores this for articulos-genero: the earlier deck built from all the app's
  // nouns is gone, the nouns only appear in the el / la task, and the deck is again the lesson's own words.
  it('articulos-genero (table words below the threshold) gets no word-deck entry', async () => {
    mockTopicId = 'articulos-genero';
    const view = render(<GrammarLessonScreen />);
    await flush();

    expect(screen.queryByTestId('grammar-start-worddeck')).toBeFalsy();
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
