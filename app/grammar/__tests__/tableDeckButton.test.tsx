// PLAN-play 13. lépés (s6): the "Practice the table" button only where the
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  it('a schema-1 (legacy) lesson has no deck button', async () => {
    mockTopicId = 'posesivos';
    const view = render(<GrammarLessonScreen />);
    await flush();

    expect(screen.queryByTestId('grammar-start-tabledeck')).toBeFalsy();

    view.unmount();
  });
});
