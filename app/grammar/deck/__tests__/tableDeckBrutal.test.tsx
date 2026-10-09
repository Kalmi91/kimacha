// the table-practice screen on the brutalist palette (back box, SegmentBar), on the classic
// palette today's header and bar. Mock pattern: tableDeck.play.test.tsx.

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

import { act, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import TableDeckScreen from '../[topic]';

jest.setTimeout(30000);

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Table drill, neo-brutalist', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
  });

  it('with the brand palette back box + SegmentBar', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(<ThemeProvider><TableDeckScreen /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('tabledeck-back')).toBeTruthy();
    expect(view.queryByTestId('tabledeck-segments')).toBeTruthy();
    view.unmount();
  });

  it('with the classic palette the current header: no box, no SegmentBar', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><TableDeckScreen /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('tabledeck-back')).toBeNull();
    expect(view.queryByTestId('tabledeck-segments')).toBeNull();
    view.unmount();
  });
});
