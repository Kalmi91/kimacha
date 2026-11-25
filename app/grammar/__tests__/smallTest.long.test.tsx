jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn(), getAvailableVoicesAsync: jest.fn(async () => []) }));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('@/lib/chime', () => ({ playChime: jest.fn((done?: () => void) => done?.()) }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/grammar',
  useLocalSearchParams: () => ({ level: 'a1' }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));
jest.mock('@/components/FeedbackModal', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: (p: { currentCard: string }) => <Text testID="fb-card">{p.currentCard}</Text> };
});
jest.mock('@/lib/grammar/syllabus', () => {
  const actual = jest.requireActual('@/lib/grammar/syllabus');
  const base = require('@/lib/__tests__/fixtures/legacy-lesson.json');
  const topics = Array.from({ length: 6 }, (_, i) => ({ id: `long-${i}`, level: 'A1', unit: 'u', title: { en: `Topic ${i}` }, blurb: { en: '' } }));
  const lessons = Object.fromEntries(topics.map((tp) => [tp.id, {
    ...base,
    topic: tp.id,
    items: base.items.map((it: { id: string; sentence: string }) => ({ ...it, id: `${tp.id}-${it.id}`, sentence: `${tp.id}: ${it.sentence}` })),
  }]));
  return {
    ...actual,
    syllabusLevels: () => ['A1'],
    syllabusForLevel: () => topics,
    hasLesson: (_lang: string, id: string) => id in lessons,
    lessonFor: (_lang: string, id: string) => lessons[id],
  };
});

import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { getDb } from '@/lib/database.web';
import { lessonFor } from '@/lib/grammar/syllabus';
import { buildLessonTest } from '@/lib/grammar/lessonTest';
import { GRAMMAR_RANDOM_KEY } from '@/lib/grammar/randomRound';
import { loadSmallState, smallKey } from '@/lib/grammar/smallTest';
import { saveResumeValue } from '@/lib/resumeStore';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';
import SmallTestScreen from '../small-test';

const NOW = 1700000000000;
const SEED = NOW % 2147483647;
const flush = makeFlush(4);
let now = NOW;
const press = async (id: string) => {
  now += 600;
  fireEvent.press(screen.getByTestId(id));
  await flush();
};
const open = async () => {
  const view = render(<ThemeProvider><SmallTestScreen /></ThemeProvider>);
  await flush();
  return view;
};
const stateNow = () => loadSmallState(getDb(), 'en→es', 'A1');
const answer = async () => {
  const cur = (await stateNow()).run!.current!;
  const q = buildLessonTest(lessonFor('es', cur.topic)!, { seed: SEED, learnedLang: 'es', contentLang: 'en', size: 9999 }).find((q) => q.id === cur.qid)!;
  if (q.view.card !== 'choice') throw new Error('Expected a choice question');
  await press(`exam-option-${q.view.correctIndex}`);
};

describe.each(['brand', 'classic'] as const)('long small test (%s palette)', (palette) => {
  beforeEach(async () => {
    jest.clearAllMocks();
    now = NOW;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette(palette);
    await db.resetGameProgress(GRAMMAR_RANDOM_KEY);
    await saveResumeValue(db, smallKey('en→es', 'A1'), null);
  });
  afterEach(() => jest.restoreAllMocks());

  it('offers both lengths, keeps feedback on both screens and resumes at 3/20 after two answers', async () => {
    const first = await open();
    expect(screen.getByTestId('small-test-intro-title')).toHaveTextContent("This round's topics");
    expect(screen.getByTestId('small-test-start')).toHaveTextContent('Short test (10)');
    expect(screen.getByTestId('small-test-start-long')).toHaveTextContent('Long test (20)');
    expect(screen.getByTestId('fb-card')).toHaveTextContent('grammar-small-test:A1:intro');
    const topics = (await stateNow()).run!.topics;
    await press('small-test-start-long');
    expect(screen.getByTestId('small-test-header')).toHaveTextContent('A1 topic test · 1/20');
    expect(screen.getByTestId('small-test-question').props.accessibilityLabel).toBe('Question 1 of 20');
    expect(screen.getByTestId('fb-card')).toHaveTextContent(`grammar-small-test:A1:${(await stateNow()).run!.current!.qid}`);
    await answer();
    await press('level-test-next');
    await answer();
    await press('level-test-next');
    const saved = await stateNow();
    expect(saved.run!.size).toBe(20);
    expect(saved.run!.topics).toEqual(topics);
    first.unmount();
    await open();
    expect(screen.getByTestId('small-test-header')).toHaveTextContent('A1 topic test · 3/20');
    expect(screen.getByTestId('small-test-question').props.accessibilityLabel).toBe('Question 3 of 20');
    expect(StyleSheet.flatten(screen.getByTestId('small-test-progress-fill').props.style).width).toBe('10%');
    expect((await stateNow()).run!.current).toEqual(saved.run!.current);
    expect(screen.getByTestId('fb-card')).toHaveTextContent(`grammar-small-test:A1:${saved.run!.current!.qid}`);
  });

  it('also keeps the long length when leaving on an answer card before Next', async () => {
    const first = await open();
    await press('small-test-start-long');
    await answer();
    await press('level-test-next');
    await answer();
    first.unmount();
    await open();
    expect(screen.getByTestId('small-test-header')).toHaveTextContent('A1 topic test · 3/20');
    expect((await stateNow()).run!.answers).toHaveLength(2);
  });
});
