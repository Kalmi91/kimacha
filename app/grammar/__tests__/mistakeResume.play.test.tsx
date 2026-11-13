jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/grammar',
  useLocalSearchParams: () => ({ topic: 'basic_verbs' }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { buildGrammarRound, isChoiceRoundItem } from '@/lib/games/grammarChoice';
import { kindProgressFromRows } from '@/lib/grammar/lessonScore';
import { GRAMMAR_PROGRESS_KEY, lessonFor } from '@/lib/grammar/syllabus';
import { setLanguage } from '@/lib/i18n';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { hashString } from '@/lib/shuffle';
import { makeFlush } from '@/test-utils/flush';
import GrammarLessonScreen from '../[topic]';

const flush = makeFlush(4);
const lesson = lessonFor('en', 'basic_verbs')!;
const now = 1700000000000;
const round = buildGrammarRound(lesson, hashString(`${lesson.topic}:${now}`)).filter(isChoiceRoundItem);

async function clearProgress() {
  await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
  await getDb().resetGameProgress(RESUME_GAME_ID);
}

async function openRound() {
  const view = render(<GrammarLessonScreen />);
  await flush();
  fireEvent.press(screen.getByTestId('grammar-start-choice'));
  await flush();
  return view;
}

async function answer(index: number, correct: boolean, next = true) {
  const item = round[index];
  const option = correct ? item.correctIndex : (item.correctIndex + 1) % item.options.length;
  fireEvent.press(screen.getAllByTestId('grammar-option')[option]);
  await flush(1);
  if (next) {
    fireEvent.press(screen.getByTestId('grammar-next'));
    await flush(1);
  }
}

async function progress() {
  return kindProgressFromRows(await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY), lesson.topic, 'choice');
}

async function leaveAndReload(view: ReturnType<typeof render>) {
  fireEvent.press(screen.getByText('←'));
  await flush();
  view.unmount();
  await flush();
  return openRound();
}

describe('grammar choice: mistakes survive leaving during answer feedback', () => {
  beforeEach(async () => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await getDb().setOnboarding('es', 'en');
    (getDb() as any).__setLevelForTest('A1');
    setLanguage('es');
    await clearProgress();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setLanguage('en');
  });

  it('one right and one wrong, saved and reloaded, scores the same as an uninterrupted round', async () => {
    let view = await openRound();
    for (let i = 0; i < round.length; i++) await answer(i, i !== 1);
    const uninterrupted = (await progress()).best;
    const percent = screen.getByTestId('grammar-lesson-percent').props.children;
    expect(uninterrupted).toEqual({ correct: round.length - 1, total: round.length });
    view.unmount();
    await flush();
    await clearProgress();

    view = await openRound();
    await answer(0, true);
    await answer(1, false, false);
    expect((await progress()).run).toMatchObject({ index: 1, correct: 1, mistakes: [round[1].item.id] });

    view = await leaveAndReload(view);
    expect(screen.getByTestId('grammar-drill-progress')).toHaveTextContent(`2 / ${round.length}`);
    for (let i = 1; i < round.length; i++) await answer(i, true);
    expect((await progress()).best).toEqual(uninterrupted);
    expect(screen.getByTestId('grammar-lesson-percent')).toHaveTextContent(percent);
    expect(screen.getByTestId('grammar-lesson-percent')).not.toHaveTextContent('100%');
    expect((await progress()).run).toBeNull();
    view.unmount();
  });

  it('keeps a first-item mistake across repeated reloads without counting it twice', async () => {
    let view = await openRound();
    await answer(0, false, false);
    view = await leaveAndReload(view);
    await answer(0, false, false);
    view = await leaveAndReload(view);
    for (let i = 0; i < round.length; i++) await answer(i, true);
    expect((await progress()).best).toEqual({ correct: round.length - 1, total: round.length });
    view.unmount();
  });

  it('keeps a last-item mistake and starts the next round with a clean score', async () => {
    let view = await openRound();
    for (let i = 0; i < round.length - 1; i++) await answer(i, true);
    await answer(round.length - 1, false, false);
    view = await leaveAndReload(view);
    await answer(round.length - 1, true);
    expect((await progress()).best).toEqual({ correct: round.length - 1, total: round.length });

    fireEvent.press(screen.getByText('←'));
    await flush();
    fireEvent.press(screen.getByTestId('grammar-start-choice'));
    await flush();
    for (let i = 0; i < round.length; i++) await answer(i, true);
    expect((await progress()).best).toEqual({ correct: round.length, total: round.length });
    view.unmount();
  });

  it('does not double-count a correct answer repeated after leaving before Next', async () => {
    let view = await openRound();
    await answer(0, true, false);
    view = await leaveAndReload(view);
    for (let i = 0; i < round.length; i++) await answer(i, true);
    expect((await progress()).best).toEqual({ correct: round.length, total: round.length });
    view.unmount();
  });
});
