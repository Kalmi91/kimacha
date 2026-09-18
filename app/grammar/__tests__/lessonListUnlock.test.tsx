// NY2 (NYELVTAN.md "Unlock-modell"): a leckelistán a szó-függő zár jelvénye
// és az egyszeri "új rész feloldva" sáv, a doneScreenLevel.test.tsx mintájára
// (app-képernyőt renderel, mockolt lecke-adattal és db.getWordStates-szel).

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

// jest.mock factories may only touch variables prefixed with "mock".
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

const mockFixtureLesson = () => ({
  schema: 2 as const,
  topic: 'presente-regular',
  level: 'A1' as const,
  title: { hu: 'Jelen idő', en: 'Present', es: 'Presente', de: 'Präsens' },
  body: [],
  speak: { hu: 'x', en: 'x', es: 'x', de: 'x' },
  items: [
    {
      kind: 'transform' as const,
      id: 't1',
      tense: { from: 'presente' as const, to: 'indefinido' as const },
      prompt: { hu: 'Como pan.', en: 'Como pan.', es: 'Como pan.', de: 'Como pan.' },
      answer: 'Comí pan.',
      wordIds: ['1', '2'],
      why: { hu: 'x', en: 'x', es: 'x', de: 'x' },
    },
    {
      kind: 'transform' as const,
      id: 't2',
      tense: { from: 'presente' as const, to: 'indefinido' as const },
      prompt: { hu: 'Bebo agua.', en: 'Bebo agua.', es: 'Bebo agua.', de: 'Bebo agua.' },
      answer: 'Bebí agua.',
      wordIds: ['2', '3'],
      why: { hu: 'x', en: 'x', es: 'x', de: 'x' },
    },
  ],
});

const mockLessonFor = jest.fn((lang: string, topicId: string) => {
  if (topicId === 'presente-regular') return mockFixtureLesson();
  return jest.requireActual('@/lib/grammar/syllabus').lessonFor(lang, topicId);
});

jest.mock('@/lib/grammar/syllabus', () => ({
  ...jest.requireActual('@/lib/grammar/syllabus'),
  lessonFor: (lang: string, topicId: string) => mockLessonFor(lang, topicId),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { GRAMMAR_UNLOCK_SEEN_KEY } from '@/lib/grammar/lockState';
import GrammarSyllabusScreen from '../index';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('grammar lesson list, word-gated unlock (NY2)', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');
    await db.updateLevel('A1', 0, 0, 0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockPush.mockClear();
  });

  it('shows the locked chip when only some of the needed words are known, tap still opens the lesson', async () => {
    jest.spyOn(getDb(), 'getWordStates').mockResolvedValue(
      new Map([
        [1, 1],
        [2, 1],
        [3, 0],
      ])
    );

    render(<GrammarSyllabusScreen />);
    await flush();

    expect(screen.getByTestId('grammar-lock-chip-presente-regular')).toBeTruthy();

    fireEvent.press(screen.getByTestId('grammar-topic-presente-regular'));
    expect(mockPush).toHaveBeenCalledWith('/grammar/presente-regular');
  });

  it('shows the unlock banner once all needed words are known, marks it seen, X hides it', async () => {
    jest.spyOn(getDb(), 'getWordStates').mockResolvedValue(
      new Map([
        [1, 1],
        [2, 1],
        [3, 1],
      ])
    );
    const setSpy = jest.spyOn(getDb(), 'setGameProgress');

    render(<GrammarSyllabusScreen />);
    await flush();

    expect(screen.getByTestId('grammar-unlock-banner-close')).toBeTruthy();
    const seenCalls = setSpy.mock.calls.filter(
      ([gameId, itemId]) => gameId === GRAMMAR_UNLOCK_SEEN_KEY && itemId === 'presente-regular'
    );
    expect(seenCalls.length).toBe(1);

    fireEvent.press(screen.getByTestId('grammar-unlock-banner-close'));
    await flush(1);
    expect(screen.queryByTestId('grammar-unlock-banner-close')).toBeNull();
  });

  it('stays quiet if the unlock was already seen', async () => {
    jest.spyOn(getDb(), 'getWordStates').mockResolvedValue(
      new Map([
        [1, 1],
        [2, 1],
        [3, 1],
      ])
    );
    await getDb().setGameProgress(GRAMMAR_UNLOCK_SEEN_KEY, 'presente-regular', 'seen');

    render(<GrammarSyllabusScreen />);
    await flush();

    expect(screen.queryByTestId('grammar-unlock-banner-close')).toBeNull();
  });
});
