// The Practice tab's Quick match game (components/practice/MatchGame.tsx, lib/practice/match.ts). Mock pattern:
// practiceModes.test.tsx. Fake timers drive the countdown and the 300 ms flash. The real corpus is used: the learner knows the
// first 100 words of A1 and 24 of them are due.

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
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
import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { loadSavedGame, saveGame } from '@/lib/practice/gameRound';
import { MATCH_ROUND_MS, boardColumns, currentBoard, matchCard, type MatchState } from '@/lib/practice/match';
import { savePracticeMode } from '@/lib/practice/practiceMode';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import PracticeScreen from '../practice';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const flush = makeFlush(12);

const learned = (itemId: string, due: string): Sm2Card => ({
  ...sm2NewCard(itemId),
  state: 'review',
  interval: 4,
  reps: 2,
  due,
  lastReview: '2000-01-01',
  introducedAt: '2000-01-01',
});

// The first 100 words of A1 are learned; `dueCount` of them are due (the first ones, the longest overdue first).
const learnWords = async (dueCount = 24) => {
  setPcicTarget('es');
  const items = pcicItemsForLevel('A1').slice(0, 100);
  for (const [i, it] of items.entries()) {
    await getDb().upsertPcicCard(learned(it.id, i < dueCount ? `2000-01-${String(i + 1).padStart(2, '0')}` : '2099-01-01'));
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
// the clock: time passes, the timers fire
const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};
const savedState = async () => (await loadSavedGame('match'))!.state as MatchState;
const startMatch = async (view: View) => press(view, 'practice-mode-match');
// taps the Spanish card and the English card of word `id` on the table in play
const tapCards = async (view: View, esId: string, enId = esId) => {
  const state = await savedState();
  const cols = boardColumns(state.boards[currentBoard(state)]);
  await press(view, `match-es-${cols.es.indexOf(esId)}`);
  await press(view, `match-en-${cols.en.indexOf(enId)}`);
};
// finds every pair of the tables in play, one table after the other
const findAll = async (view: View) => {
  for (;;) {
    const state = await savedState();
    const board = currentBoard(state);
    if (board < 0 || state.over) return;
    for (const id of state.boards[board]) {
      await tapCards(view, id);
      await advance(300);
    }
  }
};
const halves = async (id: string) => (await getDb().getPcicCard(id))?.halfSteps ?? 0;

beforeEach(async () => {
  jest.useFakeTimers();
  await getDb().resetPcicCards();
  await getDb().setPracticeRound(null);
  await getDb().setBetaFlag('practiceDictation', true);
  await getDb().setBetaFlag('practiceScramble', true);
  await getDb().setBetaFlag('practiceMatch', true);
  await getDb().setBetaFlag('xpV2', false);
  __resetBetaForTest();
  await saveGame('match', null);
  await savePracticeMode('reading');
});
afterEach(() => {
  jest.useRealTimers();
  setLanguage('en');
});

describe('Practice tab: the Match mode', () => {
  it('has its chip; switched off the chip is gone', async () => {
    await learnWords();
    let view = await mount();
    expect(view.getByText('Match')).toBeTruthy();
    view.unmount();
    await getDb().setBetaFlag('practiceMatch', false);
    __resetBetaForTest();
    view = await mount();
    expect(view.queryByTestId('practice-mode-match')).toBeNull();
    view.unmount();
  });

  it('a round is 3 tables of 5 pairs: Spanish cards left, English right, labelled with their text, the timer shows the minute', async () => {
    await learnWords();
    const view = await mount();
    await startMatch(view);
    const state = await savedState();
    expect(state.boards.map((b) => b.length)).toEqual([5, 5, 5]);
    for (const board of state.boards) {
      const meanings = board.map((id) => matchCard(findPcicItem(id)!).en.toLowerCase());
      expect(new Set(meanings).size).toBe(5);
    }
    const cols = boardColumns(state.boards[0]);
    cols.es.forEach((id, i) => expect(view.getByTestId(`match-es-${i}`).props.accessibilityLabel).toBe(matchCard(findPcicItem(id)!).es));
    cols.en.forEach((id, i) => expect(view.getByTestId(`match-en-${i}`).props.accessibilityLabel).toBe(matchCard(findPcicItem(id)!).en));
    expect(view.queryByTestId('match-es-5')).toBeNull();
    expect(view.getByTestId('match-timer').props.accessibilityLabel).toBe('60 s left');
    expect(view.getByText('1/3')).toBeTruthy();
    view.unmount();
  });

  it('a right pair flashes green and is gone; found on the first try it is one half for the word', async () => {
    await learnWords();
    const view = await mount();
    await startMatch(view);
    const state = await savedState();
    const id = state.boards[0][0];
    const cols = boardColumns(state.boards[0]);
    await tapCards(view, id);
    expect(view.getByTestId(`match-es-${cols.es.indexOf(id)}`)).toBeTruthy();
    await advance(300);
    expect(view.queryByTestId(`match-es-${cols.es.indexOf(id)}`)).toBeNull();
    expect(view.queryByTestId(`match-en-${cols.en.indexOf(id)}`)).toBeNull();
    expect((await savedState()).found).toEqual([id]);
    expect(await halves(id)).toBe(1);
    view.unmount();
  });

  it('a wrong pair flashes red, marks both words and gives nothing; the pair found later is no half; a miss never sends a word back', async () => {
    await learnWords();
    const view = await mount();
    await startMatch(view);
    const [a, b] = (await savedState()).boards[0];
    const before = await getDb().getPcicCard(a);
    await tapCards(view, a, b);
    await advance(300);
    expect((await savedState()).missed).toEqual([a, b]);
    expect((await savedState()).found).toEqual([]);
    const cols = boardColumns((await savedState()).boards[0]);
    expect(view.getByTestId(`match-es-${cols.es.indexOf(a)}`)).toBeTruthy();
    expect(view.getByTestId(`match-en-${cols.en.indexOf(b)}`)).toBeTruthy();
    await tapCards(view, a);
    await advance(300);
    expect((await savedState()).found).toEqual([a]);
    expect(await halves(a)).toBe(0);
    expect(await getDb().getPcicCard(a)).toMatchObject({ interval: before!.interval, due: before!.due, wrongStreak: 0 });
    view.unmount();
  });

  it('the bar counts down; leaving and coming back continues from the time that was left', async () => {
    await learnWords();
    let view = await mount();
    await startMatch(view);
    await advance(10_000);
    expect(view.getByTestId('match-timer').props.accessibilityLabel).toBe('50 s left');
    view.unmount();
    expect(MATCH_ROUND_MS - (await savedState()).leftMs).toBe(10_000);
    // time does not run while the screen is away
    await advance(30_000);
    view = await mount();
    expect(view.getByTestId('match-timer').props.accessibilityLabel).toBe('50 s left');
    await advance(5_000);
    expect(view.getByTestId('match-timer').props.accessibilityLabel).toBe('45 s left');
    view.unmount();
  });

  it('a round left after some pairs keeps them', async () => {
    await learnWords();
    let view = await mount();
    await startMatch(view);
    const ids = (await savedState()).boards[0];
    await tapCards(view, ids[0]);
    await tapCards(view, ids[1]);
    await advance(300);
    view.unmount();
    view = await mount();
    const cols = boardColumns(ids);
    expect(view.queryByTestId(`match-es-${cols.es.indexOf(ids[0])}`)).toBeNull();
    expect(view.queryByTestId(`match-es-${cols.es.indexOf(ids[1])}`)).toBeNull();
    expect(view.getByTestId(`match-es-${cols.es.indexOf(ids[2])}`)).toBeTruthy();
    expect(await halves(ids[0])).toBe(1);
    view.unmount();
  });

  it('time up ends the round with the pairs found and the whole minute; New round starts other words', async () => {
    await learnWords(40);
    const view = await mount();
    await startMatch(view);
    const first = (await savedState()).boards.flat();
    await tapCards(view, first[0]);
    await advance(60_000);
    expect(view.getByTestId('match-done').props.children).toBe('Time is up');
    expect(view.getByTestId('match-result').props.children).toBe('1 of 15 pairs, 60 s');
    expect(view.queryByTestId('match-best')).toBeNull();
    expect((await savedState()).over).toBe('time');
    await press(view, 'match-again');
    const next = await savedState();
    expect(next).toMatchObject({ found: [], leftMs: MATCH_ROUND_MS, over: null });
    expect(first).not.toContain(next.boards[0][0]);
    expect(view.getByTestId('match-timer').props.accessibilityLabel).toBe('60 s left');
    view.unmount();
  });

  it('all 15 pairs found: the result with the time, and the best time is kept and shown', async () => {
    await learnWords();
    const view = await mount();
    await startMatch(view);
    await advance(7_000);
    await findAll(view);
    const took = Math.ceil(((await savedState()).over === 'all' ? MATCH_ROUND_MS - (await savedState()).leftMs : 0) / 1000);
    expect(took).toBeGreaterThanOrEqual(7);
    expect(view.getByTestId('match-done').props.children).toBe('All pairs found');
    expect(view.getByTestId('match-result').props.children).toBe(`15 of 15 pairs, ${took} s`);
    expect(view.getByTestId('match-best').props.children).toBe(`Best time: ${took} s`);
    // a slower round does not replace the best time
    await press(view, 'match-again');
    await advance(20_000);
    await findAll(view);
    expect(view.getByTestId('match-done').props.children).toBe('All pairs found');
    expect(view.getByTestId('match-best').props.children).toBe(`Best time: ${took} s`);
    view.unmount();
  });

  it('too few words for a table: the empty text', async () => {
    setPcicTarget('es');
    for (const it of pcicItemsForLevel('A1').slice(0, 3)) await getDb().upsertPcicCard(learned(it.id, '2000-01-01'));
    const view = await mount();
    await startMatch(view);
    expect(view.getByTestId('match-empty')).toBeTruthy();
    view.unmount();
  });

  it('Spanish UI: the chip and the timer are Spanish', async () => {
    await learnWords();
    setLanguage('es');
    const view = await mount();
    await startMatch(view);
    expect(view.getByText('Parejas')).toBeTruthy();
    expect(view.getByTestId('match-timer').props.accessibilityLabel).toBe('60 s restantes');
    view.unmount();
  });
});
