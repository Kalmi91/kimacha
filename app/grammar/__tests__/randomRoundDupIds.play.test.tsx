// The random grammar round with two tiny lessons whose item ids are the SAME (lesson item ids are not guaranteed to be
// unique across lessons): the second topic's question is still asked, it is a fresh card (not the first one's revealed
// state), and a practice that has nothing left to ask ends on the end screen of a finished round.
// Mock pattern: randomRound.play.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({}),
}));

// Two A1 topics with ONE choice item each, both with the id "d-1"; only the sentence tells them apart.
jest.mock('@/lib/grammar/syllabus', () => {
  const actual = jest.requireActual('@/lib/grammar/syllabus');
  const base = require('@/lib/__tests__/fixtures/legacy-lesson.json');
  const defs = [
    { id: 'dup-a', title: 'Alpha topic' },
    { id: 'dup-b', title: 'Beta topic' },
  ];
  const lessons: Record<string, unknown> = {};
  for (const d of defs) {
    lessons[d.id] = {
      ...base,
      topic: d.id,
      level: 'A1',
      items: base.items.slice(0, 1).map((it: { sentence: string }) => ({ ...it, id: 'd-1', sentence: `${d.id}: ${it.sentence}` })),
    };
  }
  const topics = defs.map((d) => ({ id: d.id, level: 'A1', unit: 'u', title: { en: d.title }, blurb: { en: '' } }));
  return {
    ...actual,
    syllabusLevels: () => ['A1'],
    syllabusForLevel: () => topics,
    hasLesson: (_lang: string, id: string) => id in lessons,
    lessonFor: (_lang: string, id: string) => lessons[id],
    getGrammarTier: () => 'core',
  };
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { lessonFor } from '@/lib/grammar/syllabus';
import { buildLessonTest, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { GRAMMAR_RANDOM_KEY, META_ITEM_ID, RUN_ITEM_ID } from '@/lib/grammar/randomRound';
import { ThemeProvider } from '@/lib/ThemeContext';
import RandomRoundScreen from '../random';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const NOW = 1700000000000;
const SEED = NOW % 2147483647;

const flush = makeFlush(4);
const press = async (testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};
const text = (testID: string) => {
  const c = screen.getByTestId(testID).props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};
const rows = () => getDb().getGameProgress(GRAMMAR_RANDOM_KEY);

const questions: LessonTestQuestion[] = ['dup-a', 'dup-b'].flatMap((topic) =>
  buildLessonTest(lessonFor('es', topic)!, { seed: SEED, learnedLang: 'es', contentLang: 'en', size: 9999 })
);

// Taps the right or a wrong option of the question on screen; a wrong one needs its "Next".
const answer = async (ok: boolean) => {
  const sentence = text('exam-text');
  const q = questions.find((x) => x.view.card === 'choice' && x.view.text === sentence)!;
  const v = q.view;
  if (v.card !== 'choice') throw new Error('choice only');
  await press(`exam-option-${ok ? v.correctIndex : (v.correctIndex + 1) % v.options.length}`);
  if (!ok) await press('exam-next');
};

describe('random round, lessons with the same item ids', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.resetGameProgress(GRAMMAR_RANDOM_KEY);
    await db.setGameProgress(GRAMMAR_RANDOM_KEY, META_ITEM_ID, 'meta', { rounds: 1 }); // a mixed round
  });
  afterEach(() => (Date.now as jest.Mock).mockRestore());

  const open = async () => {
    render(
      <ThemeProvider>
        <RandomRoundScreen />
      </ThemeProvider>
    );
    await flush();
  };

  it('asks the second topic\'s "d-1" on a fresh card, and a practice with nothing left ends the round on the end screen', async () => {
    await open();
    expect(text('random-counter')).toBe('Check 1/10');
    const first = text('exam-text');
    await answer(false); // wrong: the first card revealed the right option, "Next" went on
    // the same phase and the same item id, but the other topic: a new card, nothing revealed, the options are live
    expect(text('random-counter')).toBe('Check 2/10');
    expect(text('exam-text')).not.toBe(first);
    expect(screen.queryByTestId('exam-next')).toBeNull();
    await answer(true);

    // both questions are used and the check is over early: the check result with the one weak topic
    expect(text('random-result-score')).toBe('1/2');
    expect(screen.getByTestId('random-practice-these')).toBeTruthy();
    expect((await rows()).find((r) => r.itemId === META_ITEM_ID)?.data).toEqual({ rounds: 1 });

    // nothing is left to practice or re-check: the round is finished, so the end screen comes, not a dead result page
    await press('random-practice-these');
    expect(screen.queryByTestId('random-practice-these')).toBeNull();
    expect(screen.queryByTestId('random-result-score')).toBeNull();
    expect(screen.getByTestId('random-end-check')).toHaveTextContent('Check 1/2');
    expect(screen.getByTestId('random-another')).toBeTruthy();
    expect((await rows()).find((r) => r.itemId === META_ITEM_ID)?.data).toEqual({ rounds: 2 });
    expect((await rows()).find((r) => r.itemId === RUN_ITEM_ID)).toMatchObject({ state: 'none', data: null });
    await press('random-done');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
