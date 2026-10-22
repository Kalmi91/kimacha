// The Practice tab's Opposites game (components/practice/OppositesGame.tsx, lib/practice/opposites.ts). Mock pattern:
// practiceModes.test.tsx. The real corpus and pair data are used: the learner knows about 40 adjectives, pairs together.

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
import { buildQuestion, oppositeText, oppositesOf, type OppositesState } from '@/lib/practice/opposites';
import { savePracticeMode } from '@/lib/practice/practiceMode';
import { speak } from '@/lib/speech';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { ThemeProvider } from '@/lib/ThemeContext';
import PracticeScreen from '../practice';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const mockSpeak = speak as jest.Mock;
const flush = makeFlush(20);
// an answer needs its state, the credit and the fire-and-forget save to settle
const answerFlush = makeFlush(12);

const learned = (itemId: string, due: string): Sm2Card => ({
  ...sm2NewCard(itemId),
  state: 'review',
  interval: 4,
  reps: 2,
  due,
  lastReview: '2000-01-01',
  introducedAt: '2000-01-01',
});

// About 40 adjectives are learned (every pair is complete); `dueCount` of the ones that can be asked are due (the longest overdue first).
const learnWords = async (dueCount = 12, size = 40) => {
  setPcicTarget('es');
  const all = [...pcicItemsForLevel('A1'), ...pcicItemsForLevel('A2'), ...pcicItemsForLevel('B1')];
  const ids = new Set<string>();
  for (const it of all) {
    if (ids.size >= size) break;
    if (it.pos !== 'adj' || oppositesOf(it.id).length === 0) continue;
    ids.add(it.id);
    for (const p of oppositesOf(it.id)) if (findPcicItem(p)?.pos === 'adj') ids.add(p);
  }
  const askable = [...ids].filter((id) => buildQuestion(findPcicItem(id)!, ids) !== null);
  const due = new Map(askable.slice(0, dueCount).map((id, n) => [id, `2000-01-${String(n + 1).padStart(2, '0')}`]));
  for (const id of ids) await getDb().upsertPcicCard(learned(id, due.get(id) ?? '2099-01-01'));
};

const mount = async () => {
  const view = render(<ThemeProvider><PracticeScreen /></ThemeProvider>);
  await flush();
  return view;
};
type View = Awaited<ReturnType<typeof mount>>;

const press = async (view: View, testID: string) => {
  fireEvent.press(view.getByTestId(testID));
  await (testID.startsWith('opposites-option-') ? answerFlush() : flush());
};
const startOpposites = async (view: View) => press(view, 'practice-mode-opposites');
const savedRound = async () => (await loadSavedGame('opposites'))!;
const stateOf = async () => (await savedRound()).state as OppositesState;
// the word on screen: its id, question and text
const headWord = async () => {
  const state = await stateOf();
  const id = state.queue[0];
  const question = state.questions[id];
  return { id, question, text: oppositeText(findPcicItem(id)!) };
};
const rightIndex = async () => {
  const { question } = await headWord();
  return question.options.indexOf(question.answer);
};
const wrongIndex = async () => {
  const { question } = await headWord();
  return question.options.findIndex((o) => o !== question.answer);
};
const halves = async (id: string) => (await getDb().getPcicCard(id))?.halfSteps ?? 0;

beforeEach(async () => {
  mockSpeak.mockClear();
  await getDb().resetPcicCards();
  await getDb().setPracticeRound(null);
  await getDb().setBetaFlag('practiceOpposites', true);
  await getDb().setBetaFlag('xpV2', false);
  __resetBetaForTest();
  await saveGame('opposites', null);
  await savePracticeMode('reading');
});
afterEach(() => setLanguage('en'));

describe('Practice tab: the Opposites mode', () => {
  it('has its chip; switched off the chip is gone and the other modes stay', async () => {
    await learnWords();
    let view = await mount();
    expect(view.getByText('Opposites')).toBeTruthy();
    view.unmount();
    await getDb().setBetaFlag('practiceOpposites', false);
    __resetBetaForTest();
    view = await mount();
    expect(view.queryByTestId('practice-mode-opposites')).toBeNull();
    expect(view.getByTestId('practice-mode-dictation')).toBeTruthy();
    view.unmount();
  });

  it('a round is 8 words: the word is shown and read aloud, the question, 4 options labelled with their text and never two opposites of the word', async () => {
    await learnWords();
    const view = await mount();
    await startOpposites(view);
    const round = await savedRound();
    expect(round.ids).toHaveLength(8);
    const { id, question, text } = await headWord();
    expect(id).toBe(round.ids[0]);
    expect(view.getByTestId('opposites-word').props.children).toBe(text);
    expect(view.getByText('What is the opposite?')).toBeTruthy();
    expect(mockSpeak).toHaveBeenLastCalledWith(text, speechLang('es'));
    question.options.forEach((option, i) => {
      expect(view.getByTestId(`opposites-option-${i}`).props.accessibilityLabel).toBe(oppositeText(findPcicItem(option)!));
    });
    expect(view.queryByTestId('opposites-option-4')).toBeNull();
    expect(question.options.filter((o) => oppositesOf(id).includes(o))).toEqual([question.answer]);
    expect(view.getByText('1/8')).toBeTruthy();
    expect(view.queryByTestId('opposites-next')).toBeNull();
    view.unmount();
  });

  it('the right option shows Correct, gives one half to the asked word and locks the options; Next goes on', async () => {
    await learnWords();
    const view = await mount();
    await startOpposites(view);
    const { id, question } = await headWord();
    await press(view, `opposites-option-${await rightIndex()}`);
    expect(view.getByText('Correct!')).toBeTruthy();
    expect(view.getByTestId('opposites-result')).toBeTruthy();
    expect(await halves(id)).toBe(1);
    // a second tap on the same word changes and credits nothing
    await press(view, `opposites-option-${await wrongIndex()}`);
    expect((await stateOf()).picked).toBe(question.answer);
    expect(await halves(id)).toBe(1);
    await press(view, 'opposites-next');
    expect(view.getByText('2/8')).toBeTruthy();
    expect((await stateOf()).right).toEqual([id]);
    expect(view.queryByTestId('opposites-result')).toBeNull();
    view.unmount();
  });

  it('a wrong option shows the right one and gives no half; the card stays where it was, never a step back', async () => {
    await learnWords();
    const view = await mount();
    await startOpposites(view);
    const { id, question } = await headWord();
    const before = await getDb().getPcicCard(id);
    await press(view, `opposites-option-${await wrongIndex()}`);
    expect(view.getByText('Wrong')).toBeTruthy();
    expect(view.getByTestId('opposites-answer').props.children).toBe(`The opposite: ${oppositeText(findPcicItem(question.answer)!)}`);
    const after = await getDb().getPcicCard(id);
    expect(after).toMatchObject({ halfSteps: 0, wrongStreak: 0, state: before!.state, interval: before!.interval, due: before!.due });
    await press(view, 'opposites-next');
    expect(view.getByText('2/8')).toBeTruthy();
    expect((await stateOf()).right).toEqual([]);
    view.unmount();
  });

  it('leaving after an answer and coming back shows the result again and credits nothing twice', async () => {
    await learnWords();
    let view = await mount();
    await startOpposites(view);
    const { id } = await headWord();
    await press(view, `opposites-option-${await rightIndex()}`);
    view.unmount();
    mockSpeak.mockClear();
    view = await mount();
    expect(view.getByTestId('opposites-result')).toBeTruthy();
    expect(view.getByTestId('opposites-next')).toBeTruthy();
    expect(mockSpeak).not.toHaveBeenCalled();
    expect(await halves(id)).toBe(1);
    view.unmount();
  });

  it('the end of the round shows x of 8 right and New round starts other words', async () => {
    await learnWords(14);
    const view = await mount();
    await startOpposites(view);
    const first = (await savedRound()).ids;
    for (let n = 0; n < 8; n++) {
      await press(view, `opposites-option-${n === 0 ? await wrongIndex() : await rightIndex()}`);
      await press(view, 'opposites-next');
    }
    expect(view.getByTestId('opposites-score').props.children).toBe('7 of 8 right first time');
    await press(view, 'opposites-again');
    const next = (await savedRound()).ids;
    expect(next).toHaveLength(8);
    expect(first).not.toContain(next[0]);
    view.unmount();
  });

  it('too few words with a learned opposite: the empty text', async () => {
    await learnWords(12, 4);
    const view = await mount();
    await startOpposites(view);
    expect(view.getByTestId('opposites-empty').props.children).toBe('Learn more words to unlock opposites');
    view.unmount();
  });

  it('Spanish UI: the chip and the texts are Spanish', async () => {
    await learnWords();
    setLanguage('es');
    const view = await mount();
    await startOpposites(view);
    expect(view.getByText('Opuestos')).toBeTruthy();
    expect(view.getByText('¿Cuál es el opuesto?')).toBeTruthy();
    await press(view, `opposites-option-${await wrongIndex()}`);
    expect(view.getByTestId('opposites-answer').props.children).toMatch(/^El opuesto: /);
    view.unmount();
  });
});
