// The Practice tab's games with German as the learned language: Opposites, Dictation, Scramble, Match. The German deck is the small
// fixture of test-utils/germanDeck.ts (the generated deck may still be short), the learner speaks Hungarian or English. What is
// checked on screen: German words with their article, read aloud in de-DE, typing with ss / ae / ue, ß and ä as single tiles.

jest.mock('@/data/words/de/a1.json', () => require('@/test-utils/germanDeck').germanDeckA1());
// the fixture is the whole German deck: the generated higher levels stay out of the test
jest.mock('@/data/words/de/a2.json', () => []);
jest.mock('@/data/words/de/b1.json', () => []);
jest.mock('@/data/words/de/b2.json', () => []);
jest.mock('@/data/words/de/c1.json', () => []);
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
import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { loadSavedGame, saveGame } from '@/lib/practice/gameRound';
import { matchCard, type MatchState } from '@/lib/practice/match';
import { oppositeText, type OppositesState } from '@/lib/practice/opposites';
import { savePracticeMode } from '@/lib/practice/practiceMode';
import { scrambleTiles, scrambleWord, seedOf, type ScrambleState } from '@/lib/practice/scramble';
import { speak } from '@/lib/speech';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';
import PracticeScreen from '../practice';

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

// Every card of the German fixture is learned and due; `first` words are the longest overdue, in the given order.
const learnWords = async (first: string[] = []) => {
  setPcicTarget('de', 'hu');
  const items = pcicItemsForLevel('A1');
  const order = [...first.map((de) => items.find((i) => i.de === de)!), ...items.filter((i) => !first.includes(i.de!))];
  for (const [n, it] of order.entries()) await getDb().upsertPcicCard(learned(it.id, `2000-01-${String(n + 1).padStart(2, '0')}`));
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
const text = (view: View, testID: string) => view.getByTestId(testID).props.children;
const answer = async (view: View, typed: string) => {
  fireEvent.changeText(view.getByTestId('dictation-input'), typed);
  await flush();
  await press(view, 'dictation-check');
};
const halves = async (id: string) => (await getDb().getPcicCard(id))?.halfSteps ?? 0;
const queueOf = async (mode: string) => ((await loadSavedGame(mode))!.state as { queue: string[] }).queue;

beforeEach(async () => {
  mockSpeak.mockClear();
  await getDb().setOnboarding('hu', 'de');
  await getDb().resetPcicCards();
  await getDb().setPracticeRound(null);
  await getDb().setStrictAccents(false);
  for (const mode of ['dictation', 'scramble', 'match', 'opposites']) await saveGame(mode, null);
  await savePracticeMode('reading');
});
afterEach(() => setLanguage('en'));

describe('Practice tab, German as the learned language', () => {
  it('Dictation: the German word is read aloud in de-DE, the hint says German, ss for ß and ae for ä are right, the capital is not graded', async () => {
    await learnWords(['die Straße', 'das Mädchen', 'die Leute (Pl.)']);
    const view = await mount();
    await press(view, 'practice-mode-dictation');
    expect(await queueOf('dictation')).toHaveLength(8);
    expect(mockSpeak).toHaveBeenLastCalledWith('die Straße', 'de-DE');
    expect(view.getByPlaceholderText('Type in German')).toBeTruthy();
    await answer(view, 'die strasse');
    expect(view.getByText('Correct!')).toBeTruthy();
    expect(await halves(pcicItemsForLevel('A1').find((i) => i.de === 'die Straße')!.id)).toBe(1);
    await press(view, 'dictation-next');
    expect(mockSpeak).toHaveBeenLastCalledWith('das Mädchen', 'de-DE');
    await answer(view, 'das Maedchen');
    expect(view.getByText('Correct!')).toBeTruthy();
    await press(view, 'dictation-next');
    // what is read aloud and graded has no bracketed gloss: "die Leute", the (Pl.) is optional
    expect(mockSpeak).toHaveBeenLastCalledWith('die Leute', 'de-DE');
    await answer(view, 'die Leute');
    expect(view.getByText('Correct!')).toBeTruthy();
    view.unmount();
  });

  it('Dictation: a wrong article is wrong and the correct form is shown with its article; strict accents make ss for ß wrong', async () => {
    await getDb().setStrictAccents(true);
    await learnWords(['die Straße', 'das Auto']);
    const view = await mount();
    await press(view, 'practice-mode-dictation');
    await answer(view, 'die Strasse');
    expect(view.getByText('Wrong')).toBeTruthy();
    expect(text(view, 'dictation-answer')).toBe('die Straße');
    expect(text(view, 'dictation-meaning')).toBe('Means: utca');
    await press(view, 'dictation-next');
    await answer(view, 'der Auto');
    expect(view.getByText('Wrong')).toBeTruthy();
    expect(text(view, 'dictation-answer')).toBe('das Auto');
    view.unmount();
  });

  it('Scramble: the article is fixed text, ß and ä are tiles of their own, a noun keeps its capital; a clean word is one half', async () => {
    await learnWords(['die Straße', 'das Mädchen']);
    const view = await mount();
    await press(view, 'practice-mode-scramble');
    const id = (await queueOf('scramble'))[0];
    const word = scrambleWord(findPcicItem(id)!, 'de');
    expect(word).toMatchObject({ article: 'die', letters: ['S', 't', 'r', 'a', 'ß', 'e'], meaning: 'utca' });
    expect(text(view, 'scramble-article')).toBe('die');
    expect(text(view, 'scramble-meaning')).toBe('utca');
    const tiles = scrambleTiles(word.letters, seedOf(id));
    expect(tiles).toContain('ß');
    tiles.forEach((letter, i) => expect(view.getByTestId(`scramble-letter-${i}`).props.accessibilityLabel).toBe(letter));
    const used = new Set<number>();
    for (const letter of word.letters) {
      const at = tiles.findIndex((l, i) => l === letter && !used.has(i));
      used.add(at);
      await press(view, `scramble-letter-${at}`);
    }
    expect(view.getByTestId('scramble-result')).toBeTruthy();
    expect(((await loadSavedGame('scramble'))!.state as ScrambleState).finished).toBe('clean');
    expect(await halves(id)).toBe(1);
    await press(view, 'scramble-next');
    expect(text(view, 'scramble-article')).toBe('das');
    expect(scrambleWord(findPcicItem((await queueOf('scramble'))[0])!, 'de').letters[1]).toBe('ä');
    view.unmount();
  });

  it('Match: the German words with their article on the left, the learner\'s meanings on the right', async () => {
    await learnWords();
    const view = await mount();
    await press(view, 'practice-mode-match');
    const state = (await loadSavedGame('match'))!.state as MatchState;
    expect(state.boards.length).toBeGreaterThan(0);
    const shown = (side: 'es' | 'en') => [...Array(5).keys()].map((i) => view.getByTestId(`match-${side}-${i}`).props.accessibilityLabel);
    const board = state.boards[0].map((id) => matchCard(findPcicItem(id)!, 'de'));
    expect([...shown('es')].sort()).toEqual(board.map((c) => c.es).sort());
    expect([...shown('en')].sort()).toEqual(board.map((c) => c.en).sort());
    for (const label of shown('es')) expect(label).not.toMatch(/[()/]/);
    view.unmount();
  });

  it('Opposites: the German word with its article is shown and read aloud in de-DE, four German options, the right one is credited', async () => {
    await learnWords();
    const view = await mount();
    await press(view, 'practice-mode-opposites');
    const saved = await loadSavedGame('opposites');
    const state = saved!.state as OppositesState;
    const id = state.queue[0];
    const question = state.questions[id];
    const word = oppositeText(findPcicItem(id)!, 'de');
    expect(text(view, 'opposites-word')).toBe(word);
    expect(mockSpeak).toHaveBeenLastCalledWith(word, 'de-DE');
    question.options.forEach((option, i) => {
      expect(view.getByTestId(`opposites-option-${i}`).props.accessibilityLabel).toBe(oppositeText(findPcicItem(option)!, 'de'));
    });
    expect(question.options.map((o) => findPcicItem(o)!.pos)).toEqual(Array(4).fill(findPcicItem(id)!.pos));
    await press(view, `opposites-option-${question.options.indexOf(question.answer)}`);
    expect(view.getByText('Correct!')).toBeTruthy();
    expect(await halves(id)).toBe(1);
    await press(view, 'opposites-next');
    const next = ((await loadSavedGame('opposites'))!.state as OppositesState).queue[0];
    expect(next).not.toBe(id);
    view.unmount();
  });

  it('Opposites: a wrong option shows the right word with its article', async () => {
    await learnWords();
    const view = await mount();
    await press(view, 'practice-mode-opposites');
    const state = (await loadSavedGame('opposites'))!.state as OppositesState;
    const id = state.queue[0];
    const question = state.questions[id];
    await press(view, `opposites-option-${question.options.findIndex((o) => o !== question.answer)}`);
    expect(view.getByText('Wrong')).toBeTruthy();
    expect(text(view, 'opposites-answer')).toBe(`The opposite: ${oppositeText(findPcicItem(question.answer)!, 'de')}`);
    expect(await halves(id)).toBe(0);
    view.unmount();
  });
});
