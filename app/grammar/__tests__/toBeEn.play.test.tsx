// a `to_be` lecke es→en irányban. A tanult nyelv az
// angol (a mondatok angolul állnak és angolul olvasódnak fel), a magyarázat és
// a fordítás a spanyol anyanyelvű tanulónak spanyolul jelenik meg.

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
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: 'to_be' }),
}));

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { speakSequence } from '@/lib/speech';
import { hasLesson, lessonFor } from '@/lib/grammar/syllabus';
import GrammarLessonScreen from '../[topic]';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('to_be lesson, es→en direction', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const db = getDb();
    await db.setOnboarding('es', 'en');
    (db as any).__setLevelForTest('A1');
  });

  it('is registered as an English V2 lesson with 30 items', () => {
    expect(hasLesson('en', 'to_be')).toBe(true);
    expect(hasLesson('es', 'to_be')).toBe(false);
    const lesson = lessonFor('en', 'to_be');
    expect(lesson?.items).toHaveLength(30);
  });

  it('shows the English example sentence with its Spanish translation', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush(4);
    expect(screen.queryByTestId('table-be-present')).toBeTruthy();
    expect(screen.queryByText('Are you tired?')).toBeTruthy();
    expect(screen.queryByText('¿Estás cansado?')).toBeTruthy();
    view.unmount();
  });

  it('reads the marked parts aloud in English and the explanation in Spanish', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush(4);
    fireEvent.press(screen.getByTestId('speakToggle'));
    await flush(1);
    const segments = (speakSequence as jest.Mock).mock.calls[0][0] as { text: string; locale: string }[];
    expect(segments.find((s) => s.text === 'I am')?.locale).toBe('en-US');
    expect(segments[0]).toEqual({ text: 'El', locale: 'es-MX' });
    expect(segments.find((s) => s.text === 'to be')?.locale).toBe('en-US');
    view.unmount();
  });

  it('match drill: Spanish on the left, the learned English on the right', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush(4);
    fireEvent.press(screen.getByTestId('grammar-start-match'));
    await flush(3);
    expect(within(screen.getByTestId('match-left-0')).queryByText('Soy estudiante.')).toBeTruthy();
    expect(screen.queryByText('I am a student.')).toBeTruthy();
    expect(screen.queryByText('Soy estudiante.')).toBeTruthy();
    view.unmount();
  });

  it('why drill: the English sentence, its Spanish translation on demand', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush(4);
    fireEvent.press(screen.getByTestId('grammar-start-why'));
    await flush(3);
    expect(screen.queryByText(/She is a doctor\.|I am tired\./)).toBeTruthy();
    fireEvent.press(screen.getByTestId('why-show-translation'));
    await flush(1);
    expect(screen.queryByText(/Ella es doctora\.|Estoy cansado\./)).toBeTruthy();
    view.unmount();
  });
});
