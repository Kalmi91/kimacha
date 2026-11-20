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
const mockMakePlayer = jest.fn((_lang: string) => mockPlayer);
jest.mock('@/lib/listeningPlayer', () => ({ makeListeningPlayer: (lang: string) => mockMakePlayer(lang) }));

import { act, fireEvent, render } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import SpeechTab from '@/components/speech/SpeechTab';
import { getDb } from '@/lib/database';
import { setLanguage, t } from '@/lib/i18n';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { GREETINGS, GREETINGS_EN, LISTENING_PROGRESS_KEY, LISTENING_RATE_KEY, runKeyFor } from '@/lib/speech/listening';
import { ThemeProvider } from '@/lib/ThemeContext';
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
const open = async () => {
  const view = await mount();
  await press(view, 'speech-listen-card');
  return view;
};
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
  for (const key of [LISTENING_RATE_KEY, runKeyFor('es'), runKeyFor('en')]) await saveResumeValue(getDb(), key, null);
});
afterEach(() => {
  jest.useRealTimers();
  setLanguage('en');
  (BackHandler.addEventListener as jest.Mock).mockRestore();
});

describe('Speak tab: greetings listening', () => {
  it('the card is on the list for Spanish and English, not for other targets', async () => {
    const view = await mount();
    expect(view.getByText(sx.greetTitle)).toBeTruthy();
    expect(view.queryByTestId('speech-listen-done')).toBeNull();
    if (GREETINGS.durationSec > 0) expect(view.getByTestId('speech-listen-length')).toBeTruthy();
    view.unmount();
    await getDb().setOnboarding('es', 'en');
    const en = await mount();
    expect(en.getByTestId('speech-listen-card')).toBeTruthy();
    expect(en.getByText(sx.greetTeaserEn)).toBeTruthy();
    en.unmount();
    await getDb().setOnboarding('en', 'hu');
    const other = await mount();
    expect(other.queryByTestId('speech-listen-card')).toBeNull();
    other.unmount();
  });

  it('English: Play makes the English player, all pairs write the en-greetings row, the runs are kept apart', async () => {
    await getDb().setOnboarding('es', 'en');
    const view = await open();
    await press(view, 'speech-listen-play');
    expect(mockMakePlayer).toHaveBeenCalledWith('en');
    expect(view.getByText(sx.matchInstructionEn)).toBeTruthy();
    const n = GREETINGS_EN.pairs.length;
    for (let i = 0; i < n; i++) await match(view, i);
    const rows = await getDb().getGameProgress(LISTENING_PROGRESS_KEY);
    expect(rows.find((r) => r.itemId === 'en-greetings')?.state).toBe('done');
    expect(rows.find((r) => r.itemId === GREETINGS.id)).toBeUndefined();
    view.unmount();
    const esRun = { seed: 5, matched: [0], mistakes: 0 };
    await saveResumeValue(getDb(), runKeyFor('es'), esRun);
    expect(await loadResumeValue(getDb(), runKeyFor('es'))).toEqual(esRun);
    expect((await loadResumeValue(getDb(), runKeyFor('en')) as { matched: number[] }).matched.length).toBe(n);
  });

  it('a saved done row gives the tick', async () => {
    await getDb().setGameProgress(LISTENING_PROGRESS_KEY, GREETINGS.id, 'done', { mistakes: 0 });
    const view = await mount();
    expect(view.getByTestId('speech-listen-done')).toBeTruthy();
    view.unmount();
  });

  it('opens with the feedback button; back returns to the list and pauses', async () => {
    const view = await open();
    expect(view.getByLabelText(t().feedback.button)).toBeTruthy();
    expect(view.getByTestId('speech-listen-screen')).toBeTruthy();
    await press(view, 'speech-back');
    expect(view.getByTestId('speech-listen-card')).toBeTruthy();
    expect(mockPlayer.pause).toHaveBeenCalled();
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

  it('all pairs matched: result, progress row, tick; a re-mount restores; Try again clears', async () => {
    const view = await open();
    await matchAll(view);
    expect(view.getByTestId('speech-listen-result').props.children).toBe(sx.matchResult(0));
    const rows = await getDb().getGameProgress(LISTENING_PROGRESS_KEY);
    expect(rows.find((r) => r.itemId === GREETINGS.id)?.state).toBe('done');
    view.unmount();
    const back = await open();
    expect(back.getByTestId('speech-listen-result')).toBeTruthy();
    await press(back, 'speech-listen-again');
    expect(back.queryByTestId('speech-listen-result')).toBeNull();
    back.unmount();
    const list = await mount();
    expect(list.getByTestId('speech-listen-done')).toBeTruthy();
    list.unmount();
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
