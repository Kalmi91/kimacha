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

// FB343 (grammar:ir-a-infinitivo:lesson): a fixture szószáma állítható, hogy a
// MIN_FOCUS_WORDS (10) küszöb két oldalát is lefedje ugyanazon topicId alatt.
let mockWordCount = 10;
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
      wordIds: Array.from({ length: mockWordCount }, (_, i) => String(i + 1)),
      why: { hu: 'x', en: 'x', es: 'x', de: 'x' },
    },
  ],
});

const knownMap = (total: number, knownCount: number) =>
  new Map(Array.from({ length: total }, (_, i) => [i + 1, i < knownCount ? 1 : 0] as const));

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
    mockWordCount = 10;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockPush.mockClear();
  });

  it('shows the button with N = need - have on a locked lesson', async () => {
    jest.spyOn(getDb(), 'getWordStates').mockResolvedValue(knownMap(10, 8));

    render(<GrammarLessonScreen />);
    await flush();

    expect(within(screen.getByTestId('grammar-learn-words')).getByText(/\(2\)/)).toBeTruthy();
  });

  it('hides the button once every transform word is known', async () => {
    jest.spyOn(getDb(), 'getWordStates').mockResolvedValue(knownMap(10, 10));

    render(<GrammarLessonScreen />);
    await flush();

    expect(screen.queryByTestId('grammar-learn-words')).toBeNull();
  });

  it('tapping the button fills the focusWords singleton, queues the reload, and opens the Learn tab', async () => {
    jest.spyOn(getDb(), 'getWordStates').mockResolvedValue(knownMap(10, 0));

    render(<GrammarLessonScreen />);
    await flush();

    fireEvent.press(screen.getByTestId('grammar-learn-words'));

    expect(getFocusWords()).toEqual({
      topicId: 'fixture-topic',
      label: 'Indefinido',
      wordIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });
    expect(consumePendingAction()).toEqual({ type: 'focusWords' });
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  // FB343 (grammar:ir-a-infinitivo:lesson): "learn these words nek itt nincs
  // értelme mert csak 6 szó van", a gomb a MIN_FOCUS_WORDS (10) alatt nem jelenik meg.
  it('hides the button on a 6-word lesson even with words missing (FB343)', async () => {
    mockWordCount = 6;
    jest.spyOn(getDb(), 'getWordStates').mockResolvedValue(knownMap(6, 2));

    render(<GrammarLessonScreen />);
    await flush();

    expect(screen.queryByTestId('grammar-learn-words')).toBeNull();
  });

  it('shows the button on a 28-word lesson with words missing (FB343)', async () => {
    mockWordCount = 28;
    jest.spyOn(getDb(), 'getWordStates').mockResolvedValue(knownMap(28, 20));

    render(<GrammarLessonScreen />);
    await flush();

    expect(within(screen.getByTestId('grammar-learn-words')).getByText(/\(8\)/)).toBeTruthy();
  });
});
