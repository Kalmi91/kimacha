// The German grammar course, walked the way a learner walks it (es→de, en→de and hu→de): the grammar tab lists the
// 75 topics (A1 to C1) instead of the "no course" note, a topic without a lesson file shows the "coming soon" badge and
// does not open, a lesson opens with its explanation in the learner's own language, and everything German is read with
// the German voice. Lessons are counted from the files (6 today, 75 when the course is complete).

import { readdirSync } from 'fs';
import { join } from 'path';

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

// jest.mock factories may only touch variables prefixed with "mock".
const mockPush = jest.fn();
const mockTopicId = 'praesens-regelmaessig';
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
import { setLanguage, t } from '@/lib/i18n';
import { speak, speakSequence } from '@/lib/speech';
import { syllabusForLevel } from '@/lib/grammar/syllabus';
import GrammarLessonScreen from '../[topic]';
import GrammarSyllabusScreen from '@/app/(tabs)/course';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(3);
const written = new Set(
  readdirSync(join(__dirname, '..', '..', '..', 'data', 'games', 'grammar', 'de'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5)),
);

describe.each([
  ['es', 'Sonidos y escritura'],
  ['en', 'Sounds and spelling'],
  ['hu', 'Hangok és helyesírás'],
] as const)('German grammar course for a %s native', (source, unitTitle) => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding(source, 'de');
    setLanguage(source);
    (db as any).__setLevelForTest('A1');
    mockPush.mockClear();
    (speak as jest.Mock).mockClear();
    (speakSequence as jest.Mock).mockClear();
  });
  afterEach(() => setLanguage('en'));

  it('the grammar tab lists the course, A1 with 24 topics, A2 19, B1 16, B2 10, C1 6, units titled in the learner\'s language', async () => {
    const view = render(<GrammarSyllabusScreen />);
    await flush(4);

    expect(screen.queryByTestId('grammar-no-course')).toBeNull();
    expect(screen.queryByText(unitTitle)).toBeTruthy();
    expect(screen.getAllByTestId(/^grammar-topic-/)).toHaveLength(24);
    expect(screen.getAllByTestId(/^grammar-level-[ABC][12]$/)).toHaveLength(5);
    expect(screen.queryByTestId('grammar-random-start')).toBeTruthy();

    fireEvent.press(screen.getByTestId('grammar-level-A2'));
    await flush(1);
    expect(screen.getAllByTestId(/^grammar-topic-/)).toHaveLength(19);
    expect(screen.queryByTestId('grammar-topic-dativ-artikel')).toBeTruthy();

    for (const [lvl, count, first] of [['B1', 16, 'praeteritum-schwache-starke'], ['B2', 10, 'plusquamperfekt'], ['C1', 6, 'nominalstil-verbalstil']] as const) {
      fireEvent.press(screen.getByTestId(`grammar-level-${lvl}`));
      await flush(1);
      expect(screen.getAllByTestId(/^grammar-topic-/)).toHaveLength(count);
      expect(screen.queryByTestId(`grammar-topic-${first}`)).toBeTruthy();
    }
    view.unmount();
  });

  it('a written topic opens its lesson, a topic with no lesson file yet says "coming" and stays shut', async () => {
    const view = render(<GrammarSyllabusScreen />);
    await flush(4);

    const a1 = syllabusForLevel('A1', 'de');
    const open = a1.find((tp) => written.has(tp.id))!;
    fireEvent.press(screen.getByTestId(`grammar-topic-${open.id}`));
    expect(mockPush).toHaveBeenCalledWith(`/grammar/${open.id}`);
    expect(screen.getByTestId(`grammar-percent-${open.id}`).props.children).not.toBe(t().grammar.soon);

    const shut = a1.find((tp) => !written.has(tp.id));
    if (shut) {
      mockPush.mockClear();
      fireEvent.press(screen.getByTestId(`grammar-topic-${shut.id}`));
      expect(mockPush).not.toHaveBeenCalled();
      expect(screen.getByTestId(`grammar-percent-${shut.id}`).props.children).toBe(t().grammar.soon);
    }
    view.unmount();
  });

  it('a learner at level B1 opens on that level, not on A1', async () => {
    (getDb() as any).__setLevelForTest('B1');
    const view = render(<GrammarSyllabusScreen />);
    await flush(4);
    expect(screen.getAllByTestId(/^grammar-topic-/)).toHaveLength(16);
    expect(screen.queryByTestId('grammar-topic-relativsaetze-nom-akk')).toBeTruthy();
    view.unmount();
  });

  it('a lesson opens with the explanation in the learner\'s language, and its German is read by the German voice', async () => {
    const lesson = getGrammarTopic('de', mockTopicId)!;
    const intro = lesson.body.find((b) => b.kind === 'text');
    const view = render(<GrammarLessonScreen />);
    await flush(4);

    if (intro?.kind !== 'text') throw new Error('praesens-regelmaessig starts with a text block');
    expect(screen.queryByText(intro.text[source]!)).toBeTruthy();
    // every kind of the lesson has a button, no deck button (the de table and word decks are off)
    for (const kind of ['choice', 'form', 'why']) expect(screen.queryByTestId(`grammar-start-${kind}`)).toBeTruthy();
    expect(screen.queryByTestId('grammar-start-tabledeck')).toBeNull();
    expect(screen.queryByTestId('grammar-start-worddeck')).toBeNull();

    // the read-aloud button: the «...» snippets in German, the rest in the explanation language
    fireEvent.press(screen.getByTestId('speakToggle'));
    const segments = (speakSequence as jest.Mock).mock.calls[0][0] as { text: string; locale: string }[];
    expect(segments.some((s) => s.locale === speechLang('de'))).toBe(true);
    expect(segments.some((s) => s.locale === speechLang(source))).toBe(true);
    expect(segments.every((s) => [speechLang('de'), speechLang(source)].includes(s.locale))).toBe(true);

    // an example sentence's 🔊
    fireEvent.press(screen.getAllByTestId('lessonbody-speak')[0]);
    expect((speak as jest.Mock).mock.calls[0][1]).toBe('de-DE');
    view.unmount();
  });

  it('a choice round runs: the answer is explained in the learner\'s language and the sentence is read in German', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush(4);
    fireEvent.press(screen.getByTestId('grammar-start-choice'));
    await flush(1);

    const options = screen.getAllByTestId('grammar-option');
    expect(options).toHaveLength(3);
    fireEvent.press(options[0]);
    await flush(1);
    expect(screen.queryByTestId('grammar-next')).toBeTruthy();
    expect((speak as jest.Mock).mock.calls.at(-1)[1]).toBe('de-DE');
    view.unmount();
  });
});
