jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockTopic = 'indefinido-irregular';
let mockTheme = 'light';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({ topic: mockTopic }),
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
}));
jest.mock('@/lib/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));

import { View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getDb } from '@/lib/database.web';
import { GRAMMAR_PROGRESS_KEY, lessonFor } from '@/lib/grammar/syllabus';
import {
  formCheckCells, formCheckProgressKey, freshFormCheckState, startFormCheckPractice, type FormCheckState,
} from '@/lib/grammar/formCheck';
import { setLanguage, t } from '@/lib/i18n';
import ScreenFeedback from '@/lib/screenFeedback';
import GrammarRoundEnd from '@/components/grammar/GrammarRoundEnd';
import FormCheckScreen from '../form-check/[topic]';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(5);
const topicId = 'indefinido-irregular';
const cells = formCheckCells(lessonFor('es', topicId));
const key = formCheckProgressKey(topicId);
const prompt = (i: number) => `${cells[i].verb} · ${cells[i].person}`;
const seed = (state: FormCheckState) => getDb().setGameProgress(GRAMMAR_PROGRESS_KEY, key, 'progress', state);
const saved = async () => (await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY)).find((row) => row.itemId === key)!.data as FormCheckState;
const check = async (typed: string) => {
  fireEvent.changeText(screen.getByTestId('formcheck-input'), typed);
  fireEvent.press(screen.getByTestId('formcheck-check'));
  await flush();
};
const next = async () => {
  fireEvent.press(screen.getByTestId('formcheck-check'));
  await flush();
};
const answer = async (typed: string) => { await check(typed); await next(); };
const expectFeedback = (suffix = '') => {
  expect(screen.UNSAFE_getByType(ScreenFeedback).props.currentCard).toBe(`grammar:${topicId}:formcheck${suffix}`);
  expect(screen.getByRole('button', { name: t().feedback.button })).toBeTruthy();
};
const practice = (count = 1) => startFormCheckPractice({
  ...freshFormCheckState(cells), phase: 'checkEnd', index: cells.length,
  wrong: cells.slice(0, count).map((cell) => ({ id: cell.id, typed: 'miss' })),
});

beforeEach(async () => {
  jest.clearAllMocks();
  mockTopic = topicId;
  mockTheme = 'light';
  setLanguage('en');
  await getDb().setOnboarding('en', 'es');
  await seed(freshFormCheckState(cells));
});

describe('form check playthrough', () => {
  it.each(['light', 'brand-light'])('saves every checked answer and resumes its result before Next (%s)', async (theme) => {
    mockTheme = theme;
    let view = render(<FormCheckScreen />);
    await flush();
    expect(screen.getByText(prompt(0))).toBeTruthy();
    expect(screen.getByTestId('formcheck-progress')).toHaveTextContent('1/55');
    expectFeedback();
    await answer(cells[0].answer);
    await check('');
    expect(screen.getByTestId('formcheck-result')).toHaveTextContent(`✕ Not quite · ${cells[1].answer}`);
    expect((await saved()).result).toEqual({ id: cells[1].id, typed: '', correct: false });
    view.unmount();
    view = render(<FormCheckScreen />);
    await flush();
    expect(screen.getByText(prompt(1))).toBeTruthy();
    expect(screen.getByTestId('formcheck-result')).toHaveTextContent(`✕ Not quite · ${cells[1].answer}`);
    await next();
    expect((await saved()).wrong).toEqual([{ id: cells[1].id, typed: '' }]);
    expect(screen.getByText(prompt(2))).toBeTruthy();
    fireEvent.press(screen.getByTestId('formcheck-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('lists only missed forms, then repeats a miss after three others and resumes the practice queue', async () => {
    await seed({ ...freshFormCheckState(cells), index: 52, wrong: cells.slice(0, 3).map((cell) => ({ id: cell.id, typed: 'earlier miss' })) });
    let view = render(<FormCheckScreen />);
    await flush();
    await answer(cells[52].answer);
    await answer('wrong');
    await answer(cells[54].answer);
    expect(screen.getByTestId('formcheck-progress')).toHaveTextContent('51/55');
    expectFeedback(':end');
    expect(screen.getAllByTestId('formcheck-missing')).toHaveLength(4);
    for (const i of [0, 1, 2, 53]) expect(screen.getByText(`${prompt(i)} → ${cells[i].answer}`)).toBeTruthy();
    view.unmount();
    view = render(<FormCheckScreen />);
    await flush();
    expect(screen.getAllByTestId('formcheck-missing')).toHaveLength(4);
    fireEvent.press(screen.getByTestId('formcheck-practice'));
    await flush();
    expectFeedback(':practice');
    expect(screen.getByTestId('formcheck-progress')).toHaveTextContent('0/4');
    await answer('wrong again');
    for (const i of [1, 2, 53]) {
      expect(screen.getByText(prompt(i))).toBeTruthy();
      await answer(cells[i].answer);
    }
    expect(screen.getByText(prompt(0))).toBeTruthy();
    const before = await saved();
    view.unmount();
    view = render(<FormCheckScreen />);
    await flush();
    expect(screen.getByText(prompt(0))).toBeTruthy();
    expect(await saved()).toEqual(before);
    await check('miss before exit');
    view.unmount();
    view = render(<FormCheckScreen />);
    await flush();
    expect(screen.getByTestId('formcheck-input').props.value).toBe('miss before exit');
    expect(screen.getByTestId('formcheck-result')).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-mistyped'));
    await flush();
    expect((await saved()).streaks[cells[0].id]).toBe(1);
    expect(screen.getByText(prompt(1))).toBeTruthy();
    await answer(cells[1].answer);
    expect(screen.getByTestId('formcheck-progress')).toHaveTextContent('1/4');
    expect((await saved()).queue).not.toContain(cells[1].id);
    view.unmount();
  });

  it('accepts a mistyped check answer without adding it to the missing list', async () => {
    render(<FormCheckScreen />);
    await flush();
    await check('typo');
    fireEvent.press(screen.getByTestId('grammar-mistyped'));
    await flush();
    expect((await saved()).wrong).toEqual([]);
    expect(screen.getByText(prompt(1))).toBeTruthy();
  });

  it('hides practice when every form is known and can start a fresh check', async () => {
    await seed({ ...freshFormCheckState(cells), index: 54 });
    const view = render(<FormCheckScreen />);
    await flush();
    await answer(cells[54].answer);
    expect(screen.getByText(t().grammar.formCheck.allKnown)).toBeTruthy();
    expect(screen.queryByTestId('formcheck-practice')).toBeNull();
    expect(screen.getByTestId('formcheck-progress')).toHaveTextContent('55/55');
    fireEvent.press(screen.getByTestId('formcheck-start-again'));
    await flush();
    expect(screen.getByText(prompt(0))).toBeTruthy();
    expect(await saved()).toEqual(freshFormCheckState(cells));
    view.unmount();
    await seed({ ...freshFormCheckState(cells), phase: 'checkEnd', index: 55 });
    render(<FormCheckScreen />);
    await flush();
    expect(screen.getByText(prompt(0))).toBeTruthy();
  });

  it('completes one-off practice, registers its feedback, and reopens as a fresh check', async () => {
    await seed(practice());
    const view = render(<FormCheckScreen />);
    await flush();
    await answer(cells[0].answer);
    expect(screen.getByText(prompt(0))).toBeTruthy();
    await answer(cells[0].answer);
    expect(screen.getByText(t().grammar.formCheck.complete)).toBeTruthy();
    expectFeedback(':practice-end');
    expect((await saved()).phase).toBe('practiceEnd');
    view.unmount();
    render(<FormCheckScreen />);
    await flush();
    expect(screen.getByTestId('formcheck-progress')).toHaveTextContent('1/55');
    expect(screen.queryByTestId('formcheck-result')).toBeNull();
  });

  it.each(['other-topic', 'wrong-language'])('does not serve a check outside the enabled slice (%s)', async (variant) => {
    if (variant === 'other-topic') mockTopic = 'ser-estar';
    else await getDb().setOnboarding('es', 'en');
    render(<FormCheckScreen />);
    await flush();
    expect(screen.queryByTestId('formcheck-input')).toBeNull();
    expect(screen.getByTestId('formcheck-back')).toBeTruthy();
    expect(screen.UNSAFE_getByType(ScreenFeedback)).toBeTruthy();
  });

  it('uses the Hungarian learner labels', async () => {
    setLanguage('hu');
    await seed({ ...freshFormCheckState(cells), phase: 'checkEnd', index: 55, wrong: [{ id: cells[0].id, typed: 'x' }] });
    render(<FormCheckScreen />);
    await flush();
    expect(screen.getByText('Igealak-felmérés')).toBeTruthy();
    expect(screen.getByText('Gyakorold a hiányzókat (1)')).toBeTruthy();
  });
});

const showDone = (topic?: string, learnedLang = 'es') => render(
  <GrammarRoundEnd topicId={topic} learnedLang={learnedLang} score={{ correct: 4, total: 5 }} progressRows={[]} roundStats={null} prevPct={null} header={<View />} lessonScoreOf={() => 80} setPhase={jest.fn()} setScore={jest.fn()} />
);

describe('done-screen form check card', () => {
  it.each(['light', 'brand-light'])('opens the check while keeping the two existing buttons (%s)', async (theme) => {
    mockTheme = theme;
    showDone(topicId);
    await flush();
    expect(screen.getByText('55 forms, typed')).toBeTruthy();
    expect(screen.getByTestId('grammar-practice-again')).toBeTruthy();
    expect(screen.getByTestId('grammar-back-course')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    fireEvent.press(screen.getByTestId('grammar-formcheck-card'));
    expect(mockPush).toHaveBeenCalledWith(`/grammar/form-check/${topicId}`);
  });

  it.each([[undefined, 'es'], ['ser-estar', 'es'], [topicId, 'en']])('hides the card for %s / %s', async (topic, language) => {
    showDone(topic, language);
    await flush();
    expect(screen.queryByTestId('grammar-formcheck-card')).toBeNull();
  });

  it('shows the remaining practice count from the saved state', async () => {
    await seed(practice(4));
    showDone(topicId);
    await flush();
    expect(screen.getByText('Continue: 4 forms left')).toBeTruthy();
  });

  it('says continue for a check left mid-way and practice for an unpractised wrong list', async () => {
    await seed({ ...freshFormCheckState(cells), index: 10 });
    let view = showDone(topicId);
    await flush();
    expect(screen.getByText('Continue: 45 forms left')).toBeTruthy();
    view.unmount();
    await seed({ ...freshFormCheckState(cells), phase: 'checkEnd', index: 55, wrong: cells.slice(0, 2).map((cell) => ({ id: cell.id, typed: 'x' })) });
    view = showDone(topicId);
    await flush();
    expect(screen.getByText(t().grammar.formCheck.practice(2))).toBeTruthy();
    view.unmount();
  });

  it('awards the XP once when Check is tapped twice before the re-render', async () => {
    const xp = jest.spyOn(require('@/lib/xpAward'), 'awardXpThen');
    render(<FormCheckScreen />);
    await flush();
    fireEvent.changeText(screen.getByTestId('formcheck-input'), cells[0].answer);
    // both taps run the same handler, the one rendered before the result showed
    const press = screen.UNSAFE_getAllByProps({ testID: 'formcheck-check' })[0].props.onPress;
    act(() => { press(); press(); });
    await flush();
    expect(screen.getByTestId('formcheck-result')).toBeTruthy();
    expect(xp).toHaveBeenCalledTimes(1);
    xp.mockRestore();
  });
});
