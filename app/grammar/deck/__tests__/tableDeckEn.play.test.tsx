// in the es→en direction the word-practice screen
// asks a Spanish word, expects the English word (and reads it aloud in English); the Spanish direction stays.

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

describe('word practice screen, es→en direction', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockTopic = 'to_be';
    await getDb().setOnboarding('es', 'en');
    // clean deck: the web DB lives in memory between the tests
    await getDb().setGameProgress('grammar-course', 'to_be:tabledeck', 'progress', undefined);
    setPcicTarget('en');
    setLanguage('es'); // in es→en the UI is Spanish
  });

  afterEach(() => {
    setPcicTarget('es');
    setLanguage('en');
  });

  it('the question is the Spanish word, the answer is the English word; after a correct answer it is spoken in English', async () => {
    render(<TableDeckScreen />);
    await flush();

    // the first card: yo soy -> I am
    expect(screen.getByText('yo soy')).toBeTruthy();
    expect(screen.getByText('¿Cómo se dice en inglés?')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('tabledeck-input'), 'i am');
    fireEvent.press(screen.getByText('✓ Comprobar'));
    await flush();

    expect(screen.getByText('✓ I am')).toBeTruthy();
    expect(speech.speak).toHaveBeenCalledWith('I am', 'en-US');

    fireEvent.press(screen.getByText('Siguiente →'));
    await flush();
    // the second card
    expect(screen.getByText('tú eres')).toBeTruthy();
  });

  it('a Spanish answer to the English question is wrong (not a reversed deck)', async () => {
    render(<TableDeckScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('tabledeck-input'), 'yo soy');
    fireEvent.press(screen.getByText('✓ Comprobar'));
    await flush();
    // wrong: the correct English answer is shown
    expect(screen.getAllByText('I am').length).toBeGreaterThan(0);
    expect(screen.queryByText('✓ I am')).toBeNull();
  });
});
