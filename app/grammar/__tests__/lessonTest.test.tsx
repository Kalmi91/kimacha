// the end-of-lesson grammar test on the lesson screen:
// the button on the done page, 10 questions, 80% threshold, the lesson % does not change,
// saving the result, the "Test passed" mark, failing does not lock anything.
// Mock pattern: roundEndBrutal.test.tsx / drillButtons.test.tsx.

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
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: mockReplace }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: 'presente-regular' }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PALETTE_FILLS } from '@/constants/GrammarPalettes';
import { getDb } from '@/lib/database.web';
import { GRAMMAR_PROGRESS_KEY, lessonFor, nextWrittenTopic, scoredKinds } from '@/lib/grammar/syllabus';
import { kindBestKey } from '@/lib/grammar/lessonScore';
import { buildLessonTest, lessonTestKey, mergeLessonTestResult, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { ThemeProvider } from '@/lib/ThemeContext';
import GrammarLessonScreen from '../[topic]';

jest.setTimeout(60000);

const TOPIC = 'presente-regular';
const NOW = 1700000000000;

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};
const press = async (testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};

const seedBest = async (kinds: string[]) => {
  for (const k of kinds) {
    await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, kindBestKey(TOPIC, k as never), 'best', { correct: 6, total: 10 });
  }
};
const bestRows = async () => (await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY)).filter((r) => r.state === 'best');

// Plays through a "choice" round (picks the first option) until the done page appears.
const playChoiceRound = async () => {
  await press('grammar-start-choice');
  for (let i = 0; i < 40 && !screen.queryByTestId('grammar-start-lessontest'); i++) {
    const opt = screen.queryAllByTestId('grammar-option')[0];
    if (opt) {
      fireEvent.press(opt);
      await flush(1);
    }
    const next = screen.queryByTestId('grammar-next');
    if (next) {
      fireEvent.press(next);
      await flush(1);
    }
  }
};

const expectedQuestions = (): LessonTestQuestion[] =>
  buildLessonTest(lessonFor('es', TOPIC)!, { seed: NOW, learnedLang: 'es', contentLang: 'en' });

// Solving one question on the exam card: a right or a wrong answer.
const solve = async (q: LessonTestQuestion, ok: boolean) => {
  const v = q.view;
  if (v.card === 'choice') {
    await press(`exam-option-${ok ? v.correctIndex : (v.correctIndex + 1) % v.options.length}`);
  } else if (v.card === 'type') {
    fireEvent.changeText(screen.getByTestId('exam-input'), ok ? v.answer : 'zzz');
    await press('exam-check');
  } else if (v.card === 'match') {
    const order = v.pairs.map((_, i) => i);
    if (!ok) [order[0], order[1]] = [order[1], order[0]];
    for (const i of order) await press(`exam-right-${i}`);
    await press('exam-check');
  } else {
    throw new Error('presente-regular nem tartalmaz ilyen kártyát');
  }
  if (!ok) {
    expect(screen.getByText('Not quite!')).toBeTruthy();
    await press('exam-next');
  } else {
    expect(screen.queryByText('Not quite!')).toBeNull();
  }
};

const runTest = async (wrongAt: number[]) => {
  const qs = expectedQuestions();
  for (let i = 0; i < qs.length; i++) {
    expect(screen.getByTestId('lesson-test-counter').props.children).toBe(`Question ${i + 1} / ${qs.length}`);
    await solve(qs[i], !wrongAt.includes(i));
  }
  return qs;
};

describe.each(['brand', 'classic'] as const)('lecke végi teszt (%s paletta)', (palette) => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette(palette);
    await db.resetGameProgress(GRAMMAR_PROGRESS_KEY);
  });
  afterEach(() => (Date.now as jest.Mock).mockRestore());

  const open = async () => {
    render(
      <ThemeProvider>
        <GrammarLessonScreen />
      </ThemeProvider>
    );
    await flush();
  };

  it('B1 b: amíg nem volt kör minden fajtából, a gomb szürke és a teendőt írja', async () => {
    await seedBest(['match', 'form']); // "why" is missing, "choice" is just being finished
    await open();
    expect(screen.queryByTestId('grammar-start-lessontest')).toBeNull(); // not on the lesson page, only on the done page
    await playChoiceRound();
    expect(screen.getByTestId('grammar-start-lessontest')).toBeDisabled();
    expect(screen.getByTestId('grammar-lessontest-note')).toHaveTextContent('Finish all practice types first');
    await press('grammar-start-lessontest');
    expect(screen.queryByTestId('lesson-test-counter')).toBeNull();
  });

  it('B1 b: ha minden fajtából volt kör, a gomb él, alatta "10 questions, pass 80%"', async () => {
    await seedBest(['match', 'form', 'why']);
    await open();
    await playChoiceRound();
    expect(screen.getByTestId('grammar-start-lessontest')).not.toBeDisabled();
    expect(screen.getByTestId('grammar-lessontest-note')).toHaveTextContent('10 questions, pass 80%');
  });

  it('a done-lapon a teszt-gomb az egyetlen kitöltött gomb, a "Next topic" másodlagos (keretes)', async () => {
    await seedBest(['match', 'form', 'why']);
    await open();
    await playChoiceRound();
    const fill = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style)?.backgroundColor;
    const test = fill('grammar-start-lessontest');
    expect(test).toBeTruthy();
    expect(fill('grammar-next-topic')).not.toBe(test);
    if (palette === 'brand') expect(test).toBe(PALETTE_FILLS.brand.a);
    else expect(fill('grammar-next-topic')).toBeUndefined();
  });

  it('B2 a + 80%: 10 kérdés, helyes után nincs visszajelzés; 10/10 átment, mentődik, "Next topic"', async () => {
    await seedBest(['match', 'form', 'why']);
    await open();
    await playChoiceRound();
    const before = await bestRows();
    await press('grammar-start-lessontest');
    expect(expectedQuestions()).toHaveLength(10);
    await runTest([]);
    expect(screen.getByTestId('lesson-test-verdict')).toHaveTextContent(/Lesson test passed$/);
    expect(screen.getByTestId('lesson-test-score')).toHaveTextContent(/^10 \/ 10/);
    expect(screen.queryByTestId('lesson-test-missed')).toBeNull();
    // saved, per lesson
    const rows = await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY);
    const saved = rows.find((r) => r.itemId === lessonTestKey(TOPIC));
    expect(saved?.state).toBe('passed');
    expect(saved?.data).toMatchObject({ passed: true, best: 100, last: 100 });
    // the kind rows that give the lesson % are untouched
    expect(await bestRows()).toEqual(before);
    // on to the next topic
    const next = nextWrittenTopic('es', TOPIC)!;
    await press('lesson-test-next-topic');
    expect(mockReplace).toHaveBeenCalledWith(`/grammar/${next.id}`);
    await press('lesson-test-back-syllabus');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('B4 a + 80% határ: 7/10 még nem átment, az elrontottak a helyes válasszal; nincs zár; újrapróba', async () => {
    await seedBest(['match', 'form', 'why']);
    await open();
    await playChoiceRound();
    const before = await bestRows();
    await press('grammar-start-lessontest');
    await runTest([1, 4, 8]);
    expect(screen.getByTestId('lesson-test-verdict')).toHaveTextContent(/Not yet$/);
    expect(screen.getByTestId('lesson-test-score')).toHaveTextContent(/^7 \/ 10/);
    expect(screen.getByText('You need 80% to pass.')).toBeTruthy();
    expect(screen.getByTestId('lesson-test-missed')).toBeTruthy();
    expect(screen.getAllByText('Correct answer')).toHaveLength(3 - expectedQuestions().filter((q, i) => [1, 4, 8].includes(i) && q.review.answer === '').length);
    const saved = (await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY)).find((r) => r.itemId === lessonTestKey(TOPIC));
    expect(saved?.state).toBe('failed');
    expect(saved?.data).toMatchObject({ passed: false, best: 70 });
    expect(await bestRows()).toEqual(before);
    // no "Next topic" closure, but it can be retried
    expect(screen.queryByTestId('lesson-test-next-topic')).toBeNull();
    await press('lesson-test-retry');
    expect(screen.getByTestId('lesson-test-counter').props.children).toBe('Question 1 / 10');
  });

  it('az elrontott "miért" tételnél az eredmény-lapon a kérdés szövege is látszik', async () => {
    await seedBest(['match', 'form', 'why']);
    await open();
    await playChoiceRound();
    await press('grammar-start-lessontest');
    const qs = expectedQuestions();
    await runTest(qs.map((_, i) => i)); // every question wrong
    const why = qs.filter((q) => q.kind === 'why');
    expect(why.length).toBeGreaterThan(0);
    for (const q of why) expect(screen.getByText(q.review.question)).toBeTruthy();
    expect(screen.getAllByText(/^Why «/).length).toBe(why.length);
  });

  it('8/10 átment (a határon)', async () => {
    await seedBest(['match', 'form', 'why']);
    await open();
    await playChoiceRound();
    await press('grammar-start-lessontest');
    await runTest([0, 5]);
    expect(screen.getByTestId('lesson-test-verdict')).toHaveTextContent(/Lesson test passed$/);
    expect(screen.getByTestId('lesson-test-score')).toHaveTextContent(/^8 \/ 10/);
  });

  it('a ✕ megerősítés után vissza a leckéhez, mentés nélkül', async () => {
    await seedBest(['match', 'form', 'why']);
    await open();
    await playChoiceRound();
    await press('grammar-start-lessontest');
    await press('lesson-test-close');
    await press('lesson-test-keep-going');
    expect(screen.getByTestId('lesson-test-counter')).toBeTruthy();
    await press('lesson-test-close');
    await press('lesson-test-leave');
    expect(screen.getByTestId('grammar-start-choice')).toBeTruthy();
    expect((await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY)).find((r) => r.itemId === lessonTestKey(TOPIC))).toBeUndefined();
  });

  it('"Test passed" jel a lecke-oldalon, ha a lecke már átment a teszten', async () => {
    await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, lessonTestKey(TOPIC), 'passed', mergeLessonTestResult(null, 9, 10, '2026-10-01', []));
    await open();
    expect(screen.getByTestId('grammar-test-passed')).toHaveTextContent(/Test passed · best 90%$/);
  });

  it('a lecke-oldalon nincs jel, amíg nem ment át', async () => {
    await getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, lessonTestKey(TOPIC), 'failed', mergeLessonTestResult(null, 5, 10, '2026-10-01', []));
    await open();
    expect(screen.queryByTestId('grammar-test-passed')).toBeNull();
  });

  it('a teszt-gomb szabálya megegyezik a lecke fajtáival (nincs kimaradó fajta)', () => {
    expect(scoredKinds(lessonFor('es', TOPIC)!)).toEqual(['choice', 'match', 'form', 'why']);
  });
});
