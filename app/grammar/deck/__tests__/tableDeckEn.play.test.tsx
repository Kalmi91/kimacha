// az es→en irányban a szavak-gyakorlása képernyő
// spanyol szót kérdez, az angol szót várja (és angolul olvassa fel); a spanyol irány marad.

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

let mockTopic = 'to_be';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ topic: mockTopic }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { setPcicTarget } from '@/data/pcic';
import { setLanguage } from '@/lib/i18n';
import TableDeckScreen from '../[topic]';

const speech = require('@/lib/speech') as { speak: jest.Mock };

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('szavak-gyakorlása képernyő, es→en irány', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockTopic = 'to_be';
    await getDb().setOnboarding('es', 'en');
    // tiszta pakli: a web DB memóriában él a tesztek között
    await getDb().setGameProgress('grammar-course', 'to_be:tabledeck', 'progress', undefined);
    setPcicTarget('en');
    setLanguage('es'); // es→en irányban a felület spanyol
  });

  afterEach(() => {
    setPcicTarget('es');
    setLanguage('en');
  });

  it('a kérdés a spanyol szó, a válasz az angol szó; a jó válasz után angolul szólal meg', async () => {
    render(<TableDeckScreen />);
    await flush();

    // az első kártya: yo soy -> I am
    expect(screen.getByText('yo soy')).toBeTruthy();
    expect(screen.getByText('¿Cómo se dice en inglés?')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('tabledeck-input'), 'i am');
    fireEvent.press(screen.getByText('✓ Comprobar'));
    await flush();

    expect(screen.getByText('✓ I am')).toBeTruthy();
    expect(speech.speak).toHaveBeenCalledWith('I am', 'en-US');

    fireEvent.press(screen.getByText('Siguiente →'));
    await flush();
    // a második kártya
    expect(screen.getByText('tú eres')).toBeTruthy();
  });

  it('a spanyol válasz az angol kérdésre hibás (nem fordított pakli)', async () => {
    render(<TableDeckScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('tabledeck-input'), 'yo soy');
    fireEvent.press(screen.getByText('✓ Comprobar'));
    await flush();
    // hibás: a helyes angol válasz látszik
    expect(screen.getAllByText('I am').length).toBeGreaterThan(0);
    expect(screen.queryByText('✓ I am')).toBeNull();
  });
});
