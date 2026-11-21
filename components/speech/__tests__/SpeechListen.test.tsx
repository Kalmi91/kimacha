// The "Greetings: listening" step of the Speak tab. The player module is a stub (nothing plays).

jest.mock('@/lib/speech', () => ({ ...require('@/test-utils/mocks').speechMock(), stop: jest.fn() }));
jest.mock('expo-router', () => {
  const React = require('react');
  return { useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(() => cb(), []) };
});
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));

const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
  setPlaybackRate: jest.fn(),
  remove: jest.fn(),
  shouldCorrectPitch: false,
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};
const mockMakePlayer = jest.fn((_id: string) => mockPlayer);
jest.mock('@/lib/listeningPlayer', () => ({ makeListeningPlayer: (id: string) => mockMakePlayer(id) }));

import { act, fireEvent, render } from '@testing-library/react-native';
import { BackHandler, ScrollView, StyleSheet } from 'react-native';

import SpeechTab from '@/components/speech/SpeechTab';
import { getDb } from '@/lib/database';
import { setLanguage, t } from '@/lib/i18n';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { getXp } from '@/lib/dailyXp';
import { GREETINGS, GREETINGS_EN, LISTENING_PROGRESS_KEY, LISTENING_RATE_KEY, TAXI, quizKeyFor, runKeyFor, type ListeningData } from '@/lib/speech/listening';
import { ThemeProvider } from '@/lib/ThemeContext';
import { XP_ITEMS_GAME } from '@/lib/xpAward';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const flush = makeFlush(20);
const sx = t().speechTab;
const N = GREETINGS.pairs.length;

const mount = async () => {
  const view = render(
    <ThemeProvider>
      <SpeechTab />
    </ThemeProvider>,
  );
  await flush();
  return view;
};
type View = Awaited<ReturnType<typeof mount>>;
const press = async (view: View, testID: string) => {
  fireEvent.press(view.getByTestId(testID));
  await flush();
};
const open = async (item: ListeningData = GREETINGS) => {
  const view = await mount();
  await press(view, `speech-listen-card-${item.id}`);
  return view;
};
// question qi: tap its right option (the test ids carry the option index of the data) or a wrong one
const answerRight = async (view: View, item: ListeningData, qi: number) => press(view, `speech-listen-q-${qi}-opt-${item.questions![qi].answer}`);
const answerWrong = async (view: View, item: ListeningData, qi: number) => press(view, `speech-listen-q-${qi}-opt-${(item.questions![qi].answer + 1) % 3}`);
const markAllRight = async (view: View, item: ListeningData) => {
  for (let i = 0; i < item.questions!.length; i++) await answerRight(view, item, i);
};
// mark every question right, then grade with the check button
const answerAll = async (view: View, item: ListeningData) => {
  await markAllRight(view, item);
  await press(view, 'speech-listen-quiz-check');
};
const xpNow = async () => (await getXp()).xp;
// the pair i, right: tap its place and its greeting (the test ids are the pair indexes, the column order is the screen's business)
const match = async (view: View, i: number) => {
  await press(view, `speech-listen-left-${i}`);
  await press(view, `speech-listen-right-${i}`);
};
const matchAll = async (view: View) => {
  for (let i = 0; i < N; i++) await match(view, i);
};

beforeEach(async () => {
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
  mockMakePlayer.mockClear();
  for (const fn of [mockPlayer.play, mockPlayer.pause, mockPlayer.seekTo, mockPlayer.setPlaybackRate, mockPlayer.remove]) fn.mockClear();
  await getDb().setOnboarding('en', 'es');
  await getDb().resetGameProgress(LISTENING_PROGRESS_KEY);
  await getDb().resetGameProgress(XP_ITEMS_GAME);
  for (const key of [LISTENING_RATE_KEY, runKeyFor(GREETINGS), runKeyFor(GREETINGS_EN), quizKeyFor(GREETINGS), quizKeyFor(TAXI)]) await saveResumeValue(getDb(), key, null);
});
afterEach(() => {
  jest.useRealTimers();
  setLanguage('en');
  (BackHandler.addEventListener as jest.Mock).mockRestore();
});

describe('Speak tab: greetings listening', () => {
  it('Spanish shows two cards, English one, other targets none', async () => {
    const view = await mount();
    expect(view.getByText(sx.greetTitle)).toBeTruthy();
    expect(view.getByText(sx.taxiTitle)).toBeTruthy();
    expect(view.getByText(sx.loTitle)).toBeTruthy();
    expect(view.getByTestId(`speech-listen-card-${TAXI.id}`)).toBeTruthy();
    expect(view.getByTestId('speech-listen-card-es-lo')).toBeTruthy();
    expect(view.queryByTestId(`speech-listen-done-${GREETINGS.id}`)).toBeNull();
    if (GREETINGS.durationSec > 0) expect(view.getByTestId(`speech-listen-length-${GREETINGS.id}`)).toBeTruthy();
    view.unmount();
    await getDb().setOnboarding('es', 'en');
    const en = await mount();
    expect(en.getByTestId(`speech-listen-card-${GREETINGS_EN.id}`)).toBeTruthy();
    expect(en.queryByTestId(`speech-listen-card-${TAXI.id}`)).toBeNull();
    expect(en.getByText(sx.greetTeaserEn)).toBeTruthy();
    en.unmount();
    await getDb().setOnboarding('en', 'hu');
    const other = await mount();
    expect(other.queryByTestId(`speech-listen-card-${GREETINGS.id}`)).toBeNull();
    expect(other.queryByTestId(`speech-listen-card-${GREETINGS_EN.id}`)).toBeNull();
    other.unmount();
  });

  it('English: Play makes the English player, all pairs write the en-greetings row, the runs are kept apart', async () => {
    await getDb().setOnboarding('es', 'en');
    const view = await open(GREETINGS_EN);
    await press(view, 'speech-listen-play');
    expect(mockMakePlayer).toHaveBeenCalledWith('en-greetings');
    expect(view.queryByTestId('speech-listen-quiz')).toBeNull();
    expect(view.getByText(sx.matchInstructionEn)).toBeTruthy();
    const n = GREETINGS_EN.pairs.length;
    for (let i = 0; i < n; i++) await match(view, i);
    const rows = await getDb().getGameProgress(LISTENING_PROGRESS_KEY);
    expect(rows.find((r) => r.itemId === 'en-greetings')?.state).toBe('done');
    expect(rows.find((r) => r.itemId === GREETINGS.id)).toBeUndefined();
    view.unmount();
    const esRun = { seed: 5, matched: [0], mistakes: 0 };
    await saveResumeValue(getDb(), runKeyFor(GREETINGS), esRun);
    expect(await loadResumeValue(getDb(), runKeyFor(GREETINGS))).toEqual(esRun);
    expect((await loadResumeValue(getDb(), runKeyFor(GREETINGS_EN)) as { matched: number[] }).matched.length).toBe(n);
  });

  it('a saved done row gives the tick', async () => {
    await getDb().setGameProgress(LISTENING_PROGRESS_KEY, GREETINGS.id, 'done', { mistakes: 0 });
    const view = await mount();
    expect(view.getByTestId(`speech-listen-done-${GREETINGS.id}`)).toBeTruthy();
    expect(view.queryByTestId(`speech-listen-done-${TAXI.id}`)).toBeNull();
    view.unmount();
  });

  it('opens with the feedback button; back returns to the list and pauses', async () => {
    const view = await open();
    expect(view.getByLabelText(t().feedback.button)).toBeTruthy();
    expect(view.getByTestId('speech-listen-screen')).toBeTruthy();
    await press(view, 'speech-back');
    expect(view.getByTestId(`speech-listen-card-${GREETINGS.id}`)).toBeTruthy();
    expect(mockPlayer.pause).toHaveBeenCalled();
    view.unmount();
  });

  it('no empty band above the tab bar: without a dock the scroller keeps no room for one', async () => {
    const view = await open();
    const scroller = view.getByTestId('speech-listen-screen').findAllByType(ScrollView)[0];
    expect(StyleSheet.flatten(scroller.props.style).marginBottom).toBe(0);
    view.unmount();
  });

  it('Play starts the recording in one tap; leaving pauses and releases it', async () => {
    const view = await open();
    await press(view, 'speech-listen-play');
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockPlayer.remove).toHaveBeenCalled();
  });

  it('a speed chip sets the rate with pitch correction, saves it, and the next visit restores it', async () => {
    const view = await open();
    await press(view, 'speech-listen-rate-1.3');
    expect(mockPlayer.setPlaybackRate).toHaveBeenLastCalledWith(1.3, 'high');
    expect(mockPlayer.shouldCorrectPitch).toBe(true);
    expect(await loadResumeValue(getDb(), LISTENING_RATE_KEY)).toBe(1.3);
    view.unmount();
    const again = await open();
    expect(again.getByTestId('speech-listen-rate-1.3').props.accessibilityState.selected).toBe(true);
    again.unmount();
  });

  it('Replay seeks to the start and plays', async () => {
    const view = await open();
    await press(view, 'speech-listen-replay');
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalled();
    view.unmount();
  });

  it('a wrong pair counts a mistake and unselects after a moment', async () => {
    const view = await open();
    jest.useFakeTimers();
    await press(view, 'speech-listen-left-0');
    await press(view, 'speech-listen-right-1');
    await act(async () => {
      jest.advanceTimersByTime(800);
    });
    jest.useRealTimers();
    await flush();
    await matchAll(view);
    expect(view.getByTestId('speech-listen-result').props.children).toBe(sx.matchResult(1));
    view.unmount();
  });

  it('all pairs and all questions: result, progress row, tick; a re-mount restores; Try again clears', async () => {
    const view = await open();
    await matchAll(view);
    expect(view.getByTestId('speech-listen-result').props.children).toBe(sx.matchResult(0));
    // the Spanish greetings have questions too: the row waits for them
    expect((await getDb().getGameProgress(LISTENING_PROGRESS_KEY)).find((r) => r.itemId === GREETINGS.id)).toBeUndefined();
    await answerAll(view, GREETINGS);
    const rows = await getDb().getGameProgress(LISTENING_PROGRESS_KEY);
    expect(rows.find((r) => r.itemId === GREETINGS.id)?.state).toBe('done');
    view.unmount();
    const back = await open();
    expect(back.getByTestId('speech-listen-result')).toBeTruthy();
    await press(back, 'speech-listen-again');
    expect(back.queryByTestId('speech-listen-result')).toBeNull();
    back.unmount();
    const list = await mount();
    expect(list.getByTestId(`speech-listen-done-${GREETINGS.id}`)).toBeTruthy();
    list.unmount();
  });

  it('the matching alone does not finish the Spanish greetings, the questions alone neither', async () => {
    const view = await open();
    await answerAll(view, GREETINGS);
    expect((await getDb().getGameProgress(LISTENING_PROGRESS_KEY)).find((r) => r.itemId === GREETINGS.id)).toBeUndefined();
    await matchAll(view);
    expect((await getDb().getGameProgress(LISTENING_PROGRESS_KEY)).find((r) => r.itemId === GREETINGS.id)?.state).toBe('done');
    view.unmount();
  });

  it('the taxi: player, no matching card, all questions; the player is made for the item', async () => {
    const view = await open(TAXI);
    expect(mockMakePlayer).toHaveBeenCalledWith('es-taxi');
    expect(view.getByText(sx.taxiTitle)).toBeTruthy();
    expect(view.queryByTestId('speech-listen-left-0')).toBeNull();
    expect(view.getByTestId('speech-listen-quiz')).toBeTruthy();
    for (let i = 0; i < 12; i++) expect(view.getByTestId(`speech-listen-q-${i}`)).toBeTruthy();
    expect(view.queryByTestId('speech-listen-q-12')).toBeNull();
    expect(view.queryByTestId('speech-listen-quiz-result')).toBeNull();
    await answerAll(view, TAXI);
    expect(view.getByTestId('speech-listen-quiz-result').props.children).toBe(sx.quizResult(12, 12));
    expect((await getDb().getGameProgress(LISTENING_PROGRESS_KEY)).find((r) => r.itemId === TAXI.id)?.state).toBe('done');
    view.unmount();
  });

  it('marking gives no XP, no result and no colour; a re-pick replaces the mark; the check button waits for all', async () => {
    const view = await open(TAXI);
    const before = await xpNow();
    const right = TAXI.questions![0].answer;
    const wrong = (right + 1) % 3;
    await answerRight(view, TAXI, 0);
    expect(await xpNow()).toBe(before);
    expect(view.queryByTestId('speech-listen-quiz-result')).toBeNull();
    expect(view.getByTestId(`speech-listen-q-0-opt-${right}`).props.accessibilityState).toEqual({ disabled: false, selected: true });
    await press(view, `speech-listen-q-0-opt-${wrong}`);
    expect(view.getByTestId(`speech-listen-q-0-opt-${right}`).props.accessibilityState.selected).toBe(false);
    expect(view.getByTestId(`speech-listen-q-0-opt-${wrong}`).props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('speech-listen-quiz-marked').props.children).toBe(sx.quizMarked(1, 12));
    expect(view.getByTestId('speech-listen-quiz-check').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(view.getByTestId('speech-listen-quiz-check'));
    await flush();
    expect(view.queryByTestId('speech-listen-quiz-result')).toBeNull();
    for (let i = 1; i < 12; i++) await answerRight(view, TAXI, i);
    expect(view.getByTestId('speech-listen-quiz-check').props.accessibilityState.disabled).toBe(false);
    expect(await xpNow()).toBe(before);
    view.unmount();
  });

  it('XP: check pays 1 per right answer, again after Try again 0.5, a wrong answer nothing, answers locked after', async () => {
    const view = await open(TAXI);
    const before = await xpNow();
    await answerWrong(view, TAXI, 0);
    for (let i = 1; i < 12; i++) await answerRight(view, TAXI, i);
    await press(view, 'speech-listen-quiz-check');
    expect(await xpNow()).toBe(before + 11);
    expect(view.getByTestId('speech-listen-quiz-result').props.children).toBe(sx.quizResult(11, 12));
    expect(view.getByTestId(`speech-listen-q-0-opt-${TAXI.questions![0].answer}`).props.accessibilityState.disabled).toBe(true);
    await press(view, `speech-listen-q-0-opt-${TAXI.questions![0].answer}`);
    expect(await xpNow()).toBe(before + 11);
    expect(view.queryByTestId('speech-listen-quiz-check')).toBeNull();
    await press(view, 'speech-listen-quiz-again');
    expect(view.queryByTestId('speech-listen-quiz-result')).toBeNull();
    expect(view.getByTestId('speech-listen-quiz-check').props.accessibilityState.disabled).toBe(true);
    await answerAll(view, TAXI);
    expect(await xpNow()).toBe(before + 11 + 6.5);
    view.unmount();
  });

  it('two fast presses of the check button pay once', async () => {
    const view = await open(TAXI);
    const before = await xpNow();
    await markAllRight(view, TAXI);
    const btn = view.getByTestId('speech-listen-quiz-check');
    fireEvent.press(btn);
    fireEvent.press(btn);
    await flush();
    expect(await xpNow()).toBe(before + 12);
    view.unmount();
  });

  it('marks survive a re-mount unchecked; a checked run restores with the result and pays nothing again', async () => {
    const view = await open(TAXI);
    await answerRight(view, TAXI, 0);
    await answerWrong(view, TAXI, 1);
    view.unmount();
    const back = await open(TAXI);
    expect(back.getByTestId(`speech-listen-q-0-opt-${TAXI.questions![0].answer}`).props.accessibilityState).toEqual({ disabled: false, selected: true });
    expect(back.getByTestId('speech-listen-quiz-marked').props.children).toBe(sx.quizMarked(2, 12));
    for (let i = 2; i < 12; i++) await answerRight(back, TAXI, i);
    await press(back, 'speech-listen-quiz-check');
    const after = await xpNow();
    back.unmount();
    const again = await open(TAXI);
    expect(await xpNow()).toBe(after);
    expect(again.getByTestId('speech-listen-quiz-result').props.children).toBe(sx.quizResult(11, 12));
    expect(again.getByTestId(`speech-listen-q-2-opt-0`).props.accessibilityState.disabled).toBe(true);
    again.unmount();
  });

  it('the XP line of the result counts the whole run across a re-mount, and Try again starts it from 0', async () => {
    const view = await open(TAXI);
    const before = await xpNow();
    await answerRight(view, TAXI, 0);
    view.unmount();
    const back = await open(TAXI);
    for (let i = 1; i < 12; i++) await answerRight(back, TAXI, i);
    await press(back, 'speech-listen-quiz-check');
    const paid = (await xpNow()) - before;
    expect(paid).toBe(12);
    expect(back.getByTestId('speech-listen-quiz-xp').props.children).toBe(sx.quizXp(paid));
    await press(back, 'speech-listen-quiz-again');
    await answerAll(back, TAXI);
    expect(back.getByTestId('speech-listen-quiz-xp').props.children).toBe(sx.quizXp(6));
    back.unmount();
  });

  it('English still completes with the matching alone', async () => {
    await getDb().setOnboarding('es', 'en');
    const view = await open(GREETINGS_EN);
    for (let i = 0; i < GREETINGS_EN.pairs.length; i++) await match(view, i);
    expect((await getDb().getGameProgress(LISTENING_PROGRESS_KEY)).find((r) => r.itemId === GREETINGS_EN.id)?.state).toBe('done');
    view.unmount();
  });

  it('half-matched pairs survive a re-mount', async () => {
    const view = await open();
    await match(view, 0);
    await match(view, 1);
    view.unmount();
    const back = await open();
    expect(back.getByTestId('speech-listen-left-0').props.accessibilityState.disabled).toBe(true);
    expect(back.getByTestId('speech-listen-left-1').props.accessibilityState.disabled).toBe(true);
    expect(back.getByTestId('speech-listen-left-2').props.accessibilityState.disabled).toBe(false);
    back.unmount();
  });
});
