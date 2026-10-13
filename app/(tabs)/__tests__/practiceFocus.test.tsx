// Leaving the Practice tab and coming back (blur, then focus) keeps the round: the same question, the answer
// already given, and a finished round stays on its "Questions done" screen.
// Mock pattern: practice.test.tsx, with a useFocusEffect that can be fired again.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));
let mockFocus: (() => void) | null = null;
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    mockFocus = cb;
    useEffect(cb, []);
  },
  router: { push: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));

import { act, fireEvent, render } from '@testing-library/react-native';

import { findPcicItem, pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { __resetBetaForTest } from '@/lib/beta';
import { __resetForTests as resetDailyXp } from '@/lib/dailyXp';
import { getDb } from '@/lib/database';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { setLanguage } from '@/lib/i18n';
import { parsePracticeRound } from '@/lib/practice/practiceRound';
import { readingWordFor, resolveSet, type ResolvedQuestion } from '@/lib/practice/reading';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import PracticeScreen from '../practice';

jest.setTimeout(60000);

const TODAY = localDateString();
const DUE = ['o19', 'o37', 'o20', 'o38', 'o3'];

const learned = (itemId: string, due: string): Sm2Card => ({
  ...sm2NewCard(itemId),
  state: 'review',
  interval: 4,
  reps: 2,
  due,
  lastReview: '2000-01-01',
  introducedAt: '2000-01-01',
});

// The first 100 words of A1 are learned (not due), five of them are due.
const learnWords = async () => {
  setPcicTarget('es');
  for (const it of pcicItemsForLevel('A1').slice(0, 100)) {
    const at = DUE.indexOf(it.id);
    await getDb().upsertPcicCard(learned(it.id, at === -1 ? '2099-01-01' : `2000-01-0${at + 1}`));
  }
};

// a small deterministic [0, 1) source: the questions are drawn with Math.random
const seeded = (seed: number) => {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
};

const flush = async () => {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const mount = async () => {
  const view = render(<ThemeProvider><PracticeScreen /></ThemeProvider>);
  await flush();
  return view;
};
type View = Awaited<ReturnType<typeof mount>>;

const press = async (view: View, testID: string) => {
  fireEvent.press(view.getByTestId(testID));
  await flush();
};
const next = async (view: View) => press(view, 'practice-action');

// the questions of the saved round, as the screen shows them
const questions = async (): Promise<ResolvedQuestion[]> => {
  const round = parsePracticeRound(await getDb().getPracticeRound())!;
  const words = round.ids.map((id) => readingWordFor(findPcicItem(id)!, 'es')!);
  return resolveSet(words, round.qs, findPcicItem, 'es')!.resolved;
};
const optionCount = (q: ResolvedQuestion) => (q.kind === 'meaning' ? q.options.length : 2);
// Answers question n (1-based) right or wrong.
const answer = async (view: View, n: number, right = true) => {
  const q = (await questions())[n - 1];
  await press(view, `practice-option-${right ? q.correct : (q.correct + 1) % optionCount(q)}`);
};
// The question on screen: its text (the meaning question or the true/false statement).
const questionText = (view: View) => {
  const statement = view.queryByTestId('practice-statement');
  return String((statement ?? view.getAllByTestId('practice-question')[0]).props.children);
};
// The tab loses focus and gets it back: the focus effect runs again.
const refocus = async () => {
  await act(async () => {
    mockFocus?.();
  });
  await flush();
};

beforeEach(async () => {
  jest.spyOn(Math, 'random').mockImplementation(seeded(11));
  await getDb().resetPcicCards();
  await getDb().setPracticeRound(null);
  await getDb().setStrictAccents(false);
  await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-regular', 'done', { correct: 1, total: 1 });
  __resetBetaForTest();
  await getDb().setBetaFlag('xpV2', false);
  resetDailyXp();
  await getDb().addDailyXpTenths(TODAY, -100000);
});
afterEach(() => {
  jest.restoreAllMocks();
  setLanguage('en');
});

describe('Practice tab keeps its round across blur and focus', () => {
  it('question 2 open: after blur and focus the same question and the same counter, the rest comes in order', async () => {
    await learnWords();
    const view = await mount();
    await next(view);
    await answer(view, 1);
    await next(view);
    expect(view.getByText('2/5')).toBeTruthy();
    const before = questionText(view);

    await refocus();

    expect(view.getByText('2/5')).toBeTruthy();
    expect(questionText(view)).toBe(before);
    await answer(view, 2);
    await next(view);
    expect(view.getByText('3/5')).toBeTruthy();
    view.unmount();
  });

  it('an answered question stays answered after blur and focus', async () => {
    await learnWords();
    const view = await mount();
    await next(view);
    await answer(view, 1);
    expect(view.getByText('Correct!')).toBeTruthy();

    await refocus();

    expect(view.getByText('1/5')).toBeTruthy();
    expect(view.getByText('Correct!')).toBeTruthy();
    await next(view);
    expect(view.getByText('2/5')).toBeTruthy();
    view.unmount();
  });

  it('a finished round stays on its "Questions done" screen after blur and focus', async () => {
    await learnWords();
    const view = await mount();
    await next(view);
    for (let n = 1; n <= 5; n++) {
      await answer(view, n);
      await next(view);
    }
    expect(view.getByText('Questions done')).toBeTruthy();

    await refocus();

    expect(view.getByText('Questions done')).toBeTruthy();
    expect(view.getByTestId('practice-sentences')).toBeTruthy();
    view.unmount();
  });
});
