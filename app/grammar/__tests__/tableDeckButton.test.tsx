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

  // a személy-tábla (minden sor személy-névmás, a fejléc nem
  // csupa infinitivus) kérdezhető, ezért gombot kap; a régi "posesivos = schema-1, nincs gomb"
  // teszt a posesivos schema-2-re költözésekor elavult volt.
  it('a person table (pronombres-oi) gets the deck button, 5 cells (vosotros dropped)', async () => {
    mockTopicId = 'pronombres-oi';
    const view = render(<GrammarLessonScreen />);
    await flush();

    expect(screen.getByTestId('grammar-start-tabledeck')).toBeTruthy();
    expect(screen.getByText('Practice the table · 5 cells')).toBeTruthy();

    view.unmount();
  });
  // a szó-pakli csak a tábla szavaiból
  // épül; ahol így küszöb alatt marad, nincs pakli-belépő (és nincs crash).
  // visszaállítja ezt az articulos-genero-ra: a korábbi, az app összes főnevéből
  // épített pakli megszűnt, a főnevek csak az el / la feladatban vannak, a pakli ismét a lecke saját szavai.
  it('articulos-genero (a tábla szavai a küszöb alatt) nem kap szó-pakli belépőt', async () => {
    mockTopicId = 'articulos-genero';
    const view = render(<GrammarLessonScreen />);
    await flush();

    expect(screen.queryByTestId('grammar-start-worddeck')).toBeFalsy();
    expect(screen.queryByTestId('grammar-start-tabledeck')).toBeFalsy();

    view.unmount();
  });

  it('marcadores-temporales (elég tábla-szó) megtartja a szó-pakli belépőt', async () => {
    mockTopicId = 'marcadores-temporales';
    const view = render(<GrammarLessonScreen />);
    await flush();

    expect(screen.getByTestId('grammar-start-worddeck')).toBeTruthy();

    view.unmount();
  });
});
