// FB729 / FB730: a wrong answer on the typed `form` question of the Small test must always offer the "Accept as correct" button
// that counts the answer as right: after a wrong typed answer, after "I don't know", and with the keyboard open.
// The lessons are mocked (one A1 topic with 8 form items); the engine is the real one. Mock pattern: smallTest.play.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('@/lib/chime', () => ({ playChime: jest.fn((done?: () => void) => done?.()) }));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(() => {
      cb();
    }, []);
  },
  useLocalSearchParams: () => ({ level: 'a1' }),
}));
jest.mock('@/components/FeedbackModal', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: (p: { currentCard: string }) => <Text testID="fb-card">{p.currentCard}</Text> };
});

jest.mock('@/lib/grammar/syllabus', () => {
  const actual = jest.requireActual('@/lib/grammar/syllabus');
  const base = require('@/lib/__tests__/fixtures/legacy-lesson.json');
  const lesson = {
    ...base,
    topic: 'lf-0',
    level: 'A1',
    items: Array.from({ length: 8 }, (_, i) => ({
      kind: 'form',
      id: `lf-0-form-${i}`,
      verb: 'tener + sustantivo',
      person: `to be thirty years old ${i}`,
      q: { en: `How do you say "to be thirty years old ${i}" with tener?`, es: `¿Cómo se dice ${i}?` },
      answer: `tener treinta años ${i}`,
      accept: [],
      table: 'none',
      wrong: {},
    })),
  };
  const topics = [{ id: 'lf-0', level: 'A1', unit: 'u', title: { en: 'Form topic' }, blurb: { en: '' } }];
  return {
    ...actual,
    syllabusLevels: () => ['A1'],
    syllabusForLevel: (level: string) => topics.filter((tp) => tp.level === level),
    hasLesson: (_lang: string, id: string) => id === 'lf-0',
    lessonFor: (_lang: string, id: string) => (id === 'lf-0' ? lesson : undefined),
    getGrammarTier: () => 'core',
  };
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { GRAMMAR_RANDOM_KEY } from '@/lib/grammar/randomRound';
import { loadSmallState, smallKey } from '@/lib/grammar/smallTest';
import { saveResumeValue } from '@/lib/resumeStore';
import { ThemeProvider } from '@/lib/ThemeContext';
import SmallTestScreen from '../small-test';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const NOW = 1700000000000;
const flush = makeFlush(4);
let mockNow = NOW;
const press = async (testID: string) => {
  mockNow += 600;
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};
const has = (testID: string) => screen.queryByTestId(testID) !== null;

describe('grammar small test: the typed form question (FB729, FB730)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockNow = NOW;
    jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.resetGameProgress(GRAMMAR_RANDOM_KEY);
    await saveResumeValue(db, smallKey('en→es', 'A1'), null);
  });
  afterEach(() => (Date.now as jest.Mock).mockRestore());

  const startForm = async () => {
    render(
      <ThemeProvider>
        <SmallTestScreen />
      </ThemeProvider>
    );
    await flush();
    await press('small-test-start');
    expect(has('exam-input')).toBe(true); // the typed form card
  };

  it('a wrong typed answer shows the "Accept as correct" button; pressing it counts the answer as right and mistyped', async () => {
    await startForm();
    fireEvent.changeText(screen.getByTestId('exam-input'), 'zzz');
    await press('exam-check');
    expect(has('small-test-mistyped')).toBe(true);
    expect(screen.getByTestId('small-test-mistyped')).toHaveTextContent('Accept as correct');
    await press('small-test-mistyped');
    const st = await loadSmallState(getDb(), 'en→es', 'A1');
    expect(st.run!.answers[0]).toMatchObject({ ok: true, mistyped: true, type: 'form' });
  });

  it('"I don\'t know" on the typed form card also shows the "Accept as correct" button', async () => {
    await startForm();
    await press('exam-dont-know');
    expect(has('small-test-mistyped')).toBe(true);
  });

  it('a right typed answer has no "Accept as correct" button', async () => {
    await startForm();
    const prompt = screen.getByTestId('exam-prompt').props.children as string;
    const n = /(\d+)/.exec(prompt)?.[1] ?? /(\d)/.exec(String(prompt))?.[1];
    fireEvent.changeText(screen.getByTestId('exam-input'), `tener treinta años ${n}`);
    await press('exam-check');
    expect(has('small-test-mistyped')).toBe(false);
  });
});
