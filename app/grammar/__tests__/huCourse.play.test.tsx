// The Hungarian grammar course, walked the way a learner walks it (es→hu and en→hu): the grammar tab
// lists the 40 topics instead of a coming-soon note, a lesson opens with its explanation in the
// learner's own language, and everything Hungarian is read with the Hungarian voice.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

// jest.mock factories may only touch variables prefixed with "mock".
const mockPush = jest.fn();
const mockTopicId = 'lenni-van';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: mockTopicId }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { getGrammarTopic } from '@/lib/games/content';
import { speechLang } from '@/lib/languages';
import { speak, speakSequence } from '@/lib/speech';
import GrammarLessonScreen from '../[topic]';
import GrammarSyllabusScreen from '@/app/(tabs)/course';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(3);

describe.each([
  ['es', 'El presente'],
  ['en', 'The present tense'],
] as const)('Hungarian grammar course for a %s native', (source, unitTitle) => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding(source, 'hu');
    (db as any).__setLevelForTest('A1');
    mockPush.mockClear();
    (speak as jest.Mock).mockClear();
    (speakSequence as jest.Mock).mockClear();
  });

  it('the grammar tab lists the course, A1 with 24 topics and A2 with 16, units titled in the learner\'s language', async () => {
    const view = render(<GrammarSyllabusScreen />);
    await flush(4);

    expect(screen.queryByTestId('grammar-coming-soon')).toBeNull();
    expect(screen.queryByText(unitTitle)).toBeTruthy();
    expect(screen.getAllByTestId(/^grammar-topic-/)).toHaveLength(24);
    expect(screen.getAllByTestId(/^grammar-level-/)).toHaveLength(2);

    fireEvent.press(screen.getByTestId('grammar-level-A2'));
    await flush(1);
    expect(screen.getAllByTestId(/^grammar-topic-/)).toHaveLength(16);
    expect(screen.queryByTestId('grammar-topic-mult-ido')).toBeTruthy();

    fireEvent.press(screen.getByTestId('grammar-topic-mult-ido'));
    expect(mockPush).toHaveBeenCalledWith('/grammar/mult-ido');
    view.unmount();
  });

  it('a lesson opens with the explanation in the learner\'s language, and its Hungarian is read by the Hungarian voice', async () => {
    const lesson = getGrammarTopic('hu', mockTopicId)!;
    const intro = lesson.body.find((b) => b.kind === 'text');
    const view = render(<GrammarLessonScreen />);
    await flush(4);

    if (intro?.kind !== 'text') throw new Error('lenni-van starts with a text block');
    expect(screen.queryByText(intro.text[source])).toBeTruthy();
    // every kind of the lesson has a button, no deck button (the hu table and word decks are off)
    for (const kind of ['choice', 'form', 'why']) expect(screen.queryByTestId(`grammar-start-${kind}`)).toBeTruthy();
    expect(screen.queryByTestId('grammar-start-tabledeck')).toBeNull();
    expect(screen.queryByTestId('grammar-start-worddeck')).toBeNull();

    // the read-aloud button: the «...» snippets in Hungarian, the rest in the explanation language
    fireEvent.press(screen.getByTestId('speakToggle'));
    const segments = (speakSequence as jest.Mock).mock.calls[0][0] as { text: string; locale: string }[];
    expect(segments.some((s) => s.locale === speechLang('hu'))).toBe(true);
    expect(segments.some((s) => s.locale === speechLang(source))).toBe(true);
    expect(segments.every((s) => [speechLang('hu'), speechLang(source)].includes(s.locale))).toBe(true);

    // an example sentence's 🔊
    fireEvent.press(screen.getAllByTestId('lessonbody-speak')[0]);
    expect((speak as jest.Mock).mock.calls[0][1]).toBe('hu-HU');
    view.unmount();
  });

  it('a choice round runs: the answer is explained in the learner\'s language and the sentence is read in Hungarian', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush(4);
    fireEvent.press(screen.getByTestId('grammar-start-choice'));
    await flush(1);

    const options = screen.getAllByTestId('grammar-option');
    expect(options).toHaveLength(3);
    fireEvent.press(options[0]);
    await flush(1);
    expect(screen.queryByTestId('grammar-next')).toBeTruthy();
    expect((speak as jest.Mock).mock.calls.at(-1)[1]).toBe('hu-HU');
    view.unmount();
  });
});
