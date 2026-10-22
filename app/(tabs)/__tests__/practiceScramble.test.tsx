// The Practice tab's Letter scramble game (components/practice/ScrambleGame.tsx, lib/practice/scramble.ts). Mock pattern:
// practiceModes.test.tsx. The real corpus is used: the learner knows the first 100 words of A1.

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
import { loadSavedGame, saveGame } from '@/lib/practice/gameRound';
import { savePracticeMode } from '@/lib/practice/practiceMode';
import { scrambleTiles, scrambleWord, seedOf, type ScrambleState } from '@/lib/practice/scramble';
import { speak } from '@/lib/speech';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import PracticeScreen from '../practice';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const mockSpeak = speak as jest.Mock;
const flush = makeFlush(20);
// a tap only needs its state and the fire-and-forget save to settle
const tapFlush = makeFlush(8);

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
const learnWords = async (dueCount = 12) => {
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
  await (testID.startsWith('scramble-letter-') ? tapFlush() : flush());
};
const startScramble = async (view: View) => press(view, 'practice-mode-scramble');
const savedRound = async () => (await loadSavedGame('scramble'))!;
const stateOf = async () => (await savedRound()).state as ScrambleState;
// the word on screen: its letters and the shuffled tiles
const headWord = async () => {
  const id = (await stateOf()).queue[0];
  const word = scrambleWord(findPcicItem(id)!, 'es');
  return { id, word, tiles: scrambleTiles(word.letters, seedOf(id)) };
};
// taps the tile for the next letter (the first unused one with that letter); `count` letters
const tapRight = async (view: View, count?: number) => {
  const { word, tiles } = await headWord();
  const used = new Set((await stateOf()).used);
  const upTo = count ?? word.letters.length;
  for (let k = used.size; k < upTo; k++) {
    const index = tiles.findIndex((l, i) => l === word.letters[k] && !used.has(i));
    used.add(index);
    await press(view, `scramble-letter-${index}`);
  }
};
// a tile that is NOT the next letter
const tapWrong = async (view: View) => {
  const { word, tiles } = await headWord();
  const used = new Set((await stateOf()).used);
  const next = word.letters[used.size];
  await press(view, `scramble-letter-${tiles.findIndex((l, i) => l !== next && !used.has(i))}`);
};
const halves = async (id: string) => (await getDb().getPcicCard(id))?.halfSteps ?? 0;

beforeEach(async () => {
  mockSpeak.mockClear();
  await getDb().resetPcicCards();
  await getDb().setPracticeRound(null);
  await getDb().setBetaFlag('practiceDictation', true);
  await getDb().setBetaFlag('practiceScramble', true);
  await getDb().setBetaFlag('xpV2', false);
  __resetBetaForTest();
  await saveGame('scramble', null);
  await savePracticeMode('reading');
});
afterEach(() => setLanguage('en'));

describe('Practice tab: the Scramble mode', () => {
  it('has its chip; switched off the chip is gone and the other modes stay', async () => {
    await learnWords();
    let view = await mount();
    expect(view.getByText('Scramble')).toBeTruthy();
    view.unmount();
    await getDb().setBetaFlag('practiceScramble', false);
    __resetBetaForTest();
    view = await mount();
    expect(view.queryByTestId('practice-mode-scramble')).toBeNull();
    expect(view.getByTestId('practice-mode-dictation')).toBeTruthy();
    view.unmount();
  });

  it('a round is 8 words: the meaning, a place per letter (the article is fixed text), the shuffled letters as buttons labelled with the letter', async () => {
    await learnWords();
    const view = await mount();
    await startScramble(view);
    const round = await savedRound();
    expect(round.ids).toHaveLength(8);
    const { id, word, tiles } = await headWord();
    expect(view.getByTestId('scramble-meaning').props.children).toBe(word.meaning);
    if (word.article) expect(view.getByTestId('scramble-article').props.children).toBe(word.article);
    for (let k = 0; k < word.letters.length; k++) {
      expect(view.getByTestId(`scramble-slot-${k}`).props.accessibilityLabel).toBe('Empty place');
    }
    expect(view.queryByTestId(`scramble-slot-${word.letters.length}`)).toBeNull();
    tiles.forEach((letter, i) => expect(view.getByTestId(`scramble-letter-${i}`).props.accessibilityLabel).toBe(letter));
    expect(tiles).not.toEqual(word.letters);
    expect(view.getByText('1/8')).toBeTruthy();
    expect(view.getByTestId('scramble-mistakes').props.children).toBe('Mistakes: 0');
    expect(view.getByTestId('scramble-skip')).toBeTruthy();
    expect(id).toBe(round.ids[0]);
    view.unmount();
  });

  it('a right letter jumps into its place and its button goes; the last one reads the word aloud and gives one half', async () => {
    await learnWords();
    const view = await mount();
    await startScramble(view);
    const { id, word, tiles } = await headWord();
    await tapRight(view, 1);
    expect(view.getByTestId('scramble-slot-0').props.accessibilityLabel).toBe(word.letters[0]);
    expect(view.queryAllByTestId(/^scramble-letter-/)).toHaveLength(tiles.length - 1);
    expect(mockSpeak).not.toHaveBeenCalled();
    await tapRight(view);
    expect(mockSpeak).toHaveBeenLastCalledWith(word.say, speechLang('es'));
    expect(view.getByText('Correct!')).toBeTruthy();
    expect(await halves(id)).toBe(1);
    await press(view, 'scramble-next');
    expect(view.getByText('2/8')).toBeTruthy();
    expect((await stateOf()).clean).toEqual([id]);
    view.unmount();
  });

  it('a wrong letter counts a mistake and places nothing; a word done with a mistake gives no half and never a step back', async () => {
    await learnWords();
    const view = await mount();
    await startScramble(view);
    const { id, tiles } = await headWord();
    const before = await getDb().getPcicCard(id);
    await tapWrong(view);
    expect(view.getByTestId('scramble-mistakes').props.children).toBe('Mistakes: 1');
    expect((await stateOf()).used).toEqual([]);
    expect(view.queryAllByTestId(/^scramble-letter-/)).toHaveLength(tiles.length);
    await tapRight(view);
    expect(view.getByTestId('scramble-result').props.children).toBe('1 mistake, no half this time');
    const after = await getDb().getPcicCard(id);
    expect(after).toMatchObject({ halfSteps: 0, wrongStreak: 0, interval: before!.interval, due: before!.due });
    view.unmount();
  });

  it('Skip shows the solution, reads it aloud and gives no half; Next goes on', async () => {
    await learnWords();
    const view = await mount();
    await startScramble(view);
    const { id, word } = await headWord();
    await press(view, 'scramble-skip');
    expect(view.getByTestId('scramble-result').props.children).toBe('Solution');
    word.letters.forEach((letter, k) => expect(view.getByTestId(`scramble-slot-${k}`).props.accessibilityLabel).toBe(letter));
    expect(mockSpeak).toHaveBeenLastCalledWith(word.say, speechLang('es'));
    expect(await halves(id)).toBe(0);
    await press(view, 'scramble-next');
    expect(view.getByText('2/8')).toBeTruthy();
    expect((await stateOf()).clean).toEqual([]);
    view.unmount();
  });

  it('leaving in the middle of a word and coming back keeps the placed letters and the mistakes; a finished word is not credited twice', async () => {
    await learnWords();
    let view = await mount();
    await startScramble(view);
    const { id, word } = await headWord();
    await tapWrong(view);
    await tapRight(view, 2);
    view.unmount();
    view = await mount();
    expect(view.getByTestId('scramble-slot-1').props.accessibilityLabel).toBe(word.letters[1]);
    expect(view.getByTestId('scramble-mistakes').props.children).toBe('Mistakes: 1');
    await tapRight(view);
    view.unmount();
    mockSpeak.mockClear();
    view = await mount();
    expect(view.getByTestId('scramble-result')).toBeTruthy();
    expect(mockSpeak).not.toHaveBeenCalled();
    expect(await halves(id)).toBe(0);
    view.unmount();
  });

  it('the end of the round shows x of 8 (words with no mistake) and New round starts other words', async () => {
    await learnWords(14);
    const view = await mount();
    await startScramble(view);
    const first = (await savedRound()).ids;
    for (let n = 0; n < 8; n++) {
      if (n === 0) await press(view, 'scramble-skip');
      else await tapRight(view);
      await press(view, 'scramble-next');
    }
    expect(view.getByTestId('scramble-score').props.children).toBe('7 of 8 right first time');
    await press(view, 'scramble-again');
    const next = (await savedRound()).ids;
    expect(next).toHaveLength(8);
    expect(first).not.toContain(next[0]);
    view.unmount();
  });

  it('too few words that can be put in order: the empty text', async () => {
    setPcicTarget('es');
    const items = pcicItemsForLevel('A1').slice(0, 2);
    for (const it of items) await getDb().upsertPcicCard(learned(it.id, '2000-01-01'));
    const view = await mount();
    await startScramble(view);
    expect(view.getByTestId('scramble-empty')).toBeTruthy();
    view.unmount();
  });

  it('Spanish UI: the chip and the texts are Spanish', async () => {
    await learnWords();
    setLanguage('es');
    const view = await mount();
    await startScramble(view);
    expect(view.getByText('Letras')).toBeTruthy();
    expect(view.getByTestId('scramble-mistakes').props.children).toBe('Errores: 0');
    expect(view.getByText('Omitir')).toBeTruthy();
    view.unmount();
  });
});
