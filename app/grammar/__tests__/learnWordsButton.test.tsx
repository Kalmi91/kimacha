// FB315 (NY9): a lecke-képernyő "Ezen szavak tanulása" gombja, a
// lessonListUnlock.test.tsx (fixture-lecke + db.getWordStates mock) és a
// drillButtons.test.tsx (useLocalSearchParams mock) mintájára.

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

// jest.mock factories may only touch variables prefixed with "mock".
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush, replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: 'fixture-topic' }),
}));

const mockFixtureLesson = () => ({
  schema: 2 as const,
  topic: 'fixture-topic',
  level: 'A2' as const,
  title: { hu: 'Indefinido', en: 'Indefinido', es: 'Indefinido', de: 'Indefinido' },
  body: [],
  speak: { hu: 'x', en: 'x', es: 'x', de: 'x' },
  items: [
    {
      kind: 'transform' as const,
      id: 't1',
      tense: { from: 'presente' as const, to: 'indefinido' as const },
      prompt: { hu: 'Como pan.', en: 'Como pan.', es: 'Como pan.', de: 'Como pan.' },
      answer: 'Comí pan.',
      wordIds: ['1', '2', '3'],
      why: { hu: 'x', en: 'x', es: 'x', de: 'x' },
    },
  ],
});

jest.mock('@/lib/grammar/syllabus', () => ({
  ...jest.requireActual('@/lib/grammar/syllabus'),
  lessonFor: (lang: string, topicId: string) =>
    topicId === 'fixture-topic'
      ? mockFixtureLesson()
      : jest.requireActual('@/lib/grammar/syllabus').lessonFor(lang, topicId),
}));

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { clearFocusWords, getFocusWords } from '@/lib/focusWords';
import { consumePendingAction } from '@/lib/pendingAction';
import GrammarLessonScreen from '../[topic]';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('grammar lesson screen: learn-these-words button (FB315, NY9)', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');
    await db.updateLevel('A1', 0, 0, 0);
    clearFocusWords();
    consumePendingAction();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockPush.mockClear();
  });

  it('shows the button with N = need - have on a locked lesson', async () => {
    jest.spyOn(getDb(), 'getWordStates').mockResolvedValue(
      new Map([
        [1, 1],
        [2, 0],
        [3, 0],
      ])
    );

    render(<GrammarLessonScreen />);
    await flush();

    expect(within(screen.getByTestId('grammar-learn-words')).getByText(/\(2\)/)).toBeTruthy();
  });

  it('hides the button once every transform word is known', async () => {
    jest.spyOn(getDb(), 'getWordStates').mockResolvedValue(
      new Map([
        [1, 1],
        [2, 1],
        [3, 1],
      ])
    );

    render(<GrammarLessonScreen />);
    await flush();

    expect(screen.queryByTestId('grammar-learn-words')).toBeNull();
  });

  it('tapping the button fills the focusWords singleton, queues the reload, and opens the Learn tab', async () => {
    jest.spyOn(getDb(), 'getWordStates').mockResolvedValue(
      new Map([
        [1, 0],
        [2, 0],
        [3, 0],
      ])
    );

    render(<GrammarLessonScreen />);
    await flush();

    fireEvent.press(screen.getByTestId('grammar-learn-words'));

    expect(getFocusWords()).toEqual({ topicId: 'fixture-topic', label: 'Indefinido', wordIds: [1, 2, 3] });
    expect(consumePendingAction()).toEqual({ type: 'focusWords' });
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
