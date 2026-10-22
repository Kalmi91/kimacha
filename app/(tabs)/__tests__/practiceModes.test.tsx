// The Practice tab's mode chips and the Dictation game (components/practice/modes.ts, DictationGame.tsx). Mock pattern:
// practice.test.tsx (db, router, speech, safe area). The real corpus is used: the learner knows the first 100 words of A1.

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

import { fireEvent, render } from '@testing-library/react-native';

import { findPcicItem, pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { __resetBetaForTest } from '@/lib/beta';
import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { speechLang } from '@/lib/languages';
import { dictationWord } from '@/lib/practice/dictation';
import { loadSavedGame, saveGame } from '@/lib/practice/gameRound';
import { savePracticeMode } from '@/lib/practice/practiceMode';
import { speak } from '@/lib/speech';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import PracticeScreen from '../practice';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const mockSpeak = speak as jest.Mock;
const flush = makeFlush(20);

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
const learnWords = async (dueCount = 9) => {
  setPcicTarget('es');
  const items = pcicItemsForLevel('A1').slice(0, 100);
  for (const [i, it] of items.entries()) {
    await getDb().upsertPcicCard(learned(it.id, i < dueCount ? `2000-01-${String(i + 1).padStart(2, '0')}` : '2099-01-01'));
  }
  return items.slice(0, dueCount).map((it) => it.id);
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
const startDictation = async (view: View) => press(view, 'practice-mode-dictation');
const savedRound = async () => (await loadSavedGame('dictation'))!;
const queueOf = async () => (savedRound().then((r) => (r.state as { queue: string[] }).queue));
const sayOf = (id: string) => dictationWord(findPcicItem(id)!, 'es').say;
const type = async (view: View, text: string) => {
  fireEvent.changeText(view.getByTestId('dictation-input'), text);
  await flush();
};
// types `text`, Check
const answer = async (view: View, text: string) => {
  await type(view, text);
  await press(view, 'dictation-check');
};
const answerRight = async (view: View) => answer(view, sayOf((await queueOf())[0]));
const halves = async (id: string) => (await getDb().getPcicCard(id))?.halfSteps ?? 0;

beforeEach(async () => {
  mockSpeak.mockClear();
  await getDb().resetPcicCards();
  await getDb().setPracticeRound(null);
  await getDb().setStrictAccents(false);
  await getDb().setBetaFlag('practiceDictation', true);
  await getDb().setBetaFlag('xpV2', false);
  __resetBetaForTest();
  await saveGame('dictation', null);
  await savePracticeMode('reading');
});
afterEach(() => setLanguage('en'));

describe('Practice tab: the mode chips', () => {
  it('Reading is the default; the chip row lists Reading and the switched-on game, and the reading round is what shows', async () => {
    await learnWords();
    const view = await mount();
    expect(view.getByTestId('practice-modes')).toBeTruthy();
    expect(view.getByTestId('practice-mode-reading').props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('practice-mode-dictation').props.accessibilityState.selected).toBe(false);
    expect(view.getByText('Reading')).toBeTruthy();
    expect(view.getByText('Dictation')).toBeTruthy();
    expect(view.getByTestId('practice-screen')).toBeTruthy();
    expect(view.queryByTestId('dictation-screen')).toBeNull();
    view.unmount();
  });

  it('with the game switched off only Reading is left and the chip row is gone', async () => {
    await learnWords();
    await getDb().setBetaFlag('practiceDictation', false);
    await getDb().setBetaFlag('practiceScramble', false);
    await getDb().setBetaFlag('practiceMatch', false);
    const view = await mount();
    expect(view.queryByTestId('practice-modes')).toBeNull();
    expect(view.getByTestId('practice-screen')).toBeTruthy();
    view.unmount();
  });

  it('a chosen mode is kept when the tab is opened again; switching the game off falls back to Reading', async () => {
    await learnWords();
    let view = await mount();
    await startDictation(view);
    expect(view.getByTestId('dictation-screen')).toBeTruthy();
    expect(view.getByTestId('practice-mode-dictation').props.accessibilityState.selected).toBe(true);
    view.unmount();
    view = await mount();
    expect(view.getByTestId('dictation-screen')).toBeTruthy();
    expect(view.queryByTestId('practice-screen')).toBeNull();
    view.unmount();
    await getDb().setBetaFlag('practiceDictation', false);
    __resetBetaForTest();
    view = await mount();
    expect(view.getByTestId('practice-screen')).toBeTruthy();
    view.unmount();
  });

  it('Spanish UI: the chip titles are Spanish', async () => {
    await learnWords();
    setLanguage('es');
    const view = await mount();
    expect(view.getByText('Lectura')).toBeTruthy();
    expect(view.getByText('Dictado')).toBeTruthy();
    view.unmount();
  });
});

describe('Dictation', () => {
  it('a round is 8 words, the first one is read aloud with its article, the screen has the speaker, the replay, the field and Check', async () => {
    const due = await learnWords(9);
    const view = await mount();
    await startDictation(view);
    const round = await savedRound();
    expect(round.ids).toEqual(due.slice(0, 8));
    expect(mockSpeak).toHaveBeenCalledWith(sayOf(due[0]), speechLang('es'));
    for (const id of ['dictation-speak', 'dictation-replay', 'dictation-input', 'dictation-check']) expect(view.getByTestId(id)).toBeTruthy();
    expect(view.getByText('1/8')).toBeTruthy();
    expect(view.getByTestId('level-counter')).toBeTruthy();
    mockSpeak.mockClear();
    await press(view, 'dictation-replay');
    expect(mockSpeak).toHaveBeenLastCalledWith(sayOf(due[0]), speechLang('es'));
    view.unmount();
  });

  it('Check needs a typing; a right word shows the green badge, the form and the English, gives one half and Next goes on', async () => {
    const due = await learnWords(9);
    const view = await mount();
    await startDictation(view);
    fireEvent.press(view.getByTestId('dictation-check'));
    await flush();
    expect(view.queryByTestId('dictation-result')).toBeNull();
    await answerRight(view);
    expect(view.getByText('Correct!')).toBeTruthy();
    expect(view.getByTestId('dictation-answer').props.children).toBe(findPcicItem(due[0])!.es);
    expect(view.getByTestId('dictation-meaning').props.children).toBe(`Means: ${findPcicItem(due[0])!.en}`);
    expect(await halves(due[0])).toBe(1);
    await press(view, 'dictation-next');
    expect(view.getByText('2/8')).toBeTruthy();
    expect(await queueOf()).toEqual(due.slice(1, 8));
    expect((await getDb().getPcicCard(due[1]))?.halfSteps).toBe(0);
    view.unmount();
  });

  it('a wrong word shows the correct form, earns nothing and comes back once at the end; two wrong in a row are a step back', async () => {
    const due = await learnWords(9);
    const view = await mount();
    await startDictation(view);
    await answer(view, 'qqqqqqq');
    expect(view.getByText('Wrong')).toBeTruthy();
    expect(view.getByTestId('dictation-answer').props.children).toBe(findPcicItem(due[0])!.es);
    expect(await halves(due[0])).toBe(0);
    expect((await getDb().getPcicCard(due[0]))?.wrongStreak).toBe(1);
    await press(view, 'dictation-next');
    expect(await queueOf()).toEqual([...due.slice(1, 8), due[0]]);
    // seven right ones, then the first word again: wrong a second time = one step back
    for (let i = 0; i < 7; i++) {
      await answerRight(view);
      await press(view, 'dictation-next');
    }
    expect(await queueOf()).toEqual([due[0]]);
    mockSpeak.mockClear();
    const before = await getDb().getPcicCard(due[0]);
    await answer(view, 'qqqqqqq');
    const after = await getDb().getPcicCard(due[0]);
    expect(after!.wrongStreak).toBe(0);
    expect(after!.interval).toBe(Math.max(1, Math.round(before!.interval / before!.ease)));
    expect(after!.interval).toBeLessThan(before!.interval);
    await press(view, 'dictation-next');
    // the word was asked twice: the round is over
    expect(view.getByTestId('dictation-done')).toBeTruthy();
    expect(view.getByTestId('dictation-score').props.children).toBe('7 of 8 right first time');
    view.unmount();
  });

  it('the end of the round shows x of 8 and New round starts other words', async () => {
    const due = await learnWords(9);
    const view = await mount();
    await startDictation(view);
    for (let i = 0; i < 8; i++) {
      await answerRight(view);
      await press(view, 'dictation-next');
    }
    expect(view.getByTestId('dictation-score').props.children).toBe('8 of 8 right first time');
    for (const id of due.slice(0, 8)) expect(await halves(id)).toBe(1);
    await press(view, 'dictation-again');
    const next = await savedRound();
    expect(next.ids[0]).toBe(due[8]);
    expect(next.ids).toHaveLength(8);
    expect(view.getByTestId('dictation-input')).toBeTruthy();
    view.unmount();
  });

  it('leaving and coming back the same day continues on the same word; a checked word is shown again and never credited twice', async () => {
    const due = await learnWords(9);
    let view = await mount();
    await startDictation(view);
    await answerRight(view);
    await press(view, 'dictation-next');
    await answerRight(view);
    view.unmount();
    expect(await halves(due[1])).toBe(1);
    mockSpeak.mockClear();
    view = await mount();
    expect(view.getByText('2/8')).toBeTruthy();
    expect(view.getByTestId('dictation-answer').props.children).toBe(findPcicItem(due[1])!.es);
    expect(view.getByTestId('dictation-next')).toBeTruthy();
    expect(mockSpeak).not.toHaveBeenCalled();
    await press(view, 'dictation-next');
    expect(await halves(due[1])).toBe(1);
    expect(view.getByText('3/8')).toBeTruthy();
    view.unmount();
  });

  it('a round saved on another day is not resumed; its words go to the end of the new one', async () => {
    const due = await learnWords(9);
    await saveGame('dictation', { v: 1, mode: 'dictation', date: '2000-01-01', target: 'es', ids: due.slice(0, 8), state: { queue: [due[5]], retried: [], firstTry: [], turn: 3, checked: null } });
    const view = await mount();
    await startDictation(view);
    expect((await savedRound()).ids).toEqual([due[8], ...due.slice(0, 7)]);
    expect(view.getByText('1/8')).toBeTruthy();
    view.unmount();
  });

  it('the Accents-count switch decides: a missing accent is a mistake with it on', async () => {
    await learnWords(9);
    const accented = pcicItemsForLevel('A1').slice(0, 9).find((it) => /[áéíóúñ]/.test(dictationWord(it, 'es').say));
    expect(accented).toBeDefined();
    await getDb().setStrictAccents(true);
    const view = await mount();
    await startDictation(view);
    const folded = (id: string) => sayOf(id).normalize('NFD').replace(/[̀-ͯ]/g, '');
    const queue = await queueOf();
    // go to the accented word with right answers
    for (const id of queue) {
      if (id === accented!.id) break;
      await answer(view, sayOf(id));
      await press(view, 'dictation-next');
    }
    await answer(view, folded(accented!.id));
    expect(view.getByText('Wrong')).toBeTruthy();
    view.unmount();
  });

  it('fewer than 3 usable words: the empty text, no round', async () => {
    setPcicTarget('es');
    const items = pcicItemsForLevel('A1').slice(0, 2);
    for (const it of items) await getDb().upsertPcicCard(learned(it.id, '2000-01-01'));
    const view = await mount();
    await startDictation(view);
    expect(view.getByTestId('dictation-empty').props.children).toBe('Learn a few more words, then there will be something to practice here');
    expect(view.queryByTestId('dictation-input')).toBeNull();
    view.unmount();
  });
});
