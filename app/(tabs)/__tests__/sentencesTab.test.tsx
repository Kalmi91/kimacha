// The Sentences tab (beta): queue from learned words, build then type the same sentence, a right sentence gives each
// learned word one half, a wrong one goes to the end. Mock pattern: pcicSentenceCard.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
  stop: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('@/lib/practice/halfStep', () => {
  const actual = jest.requireActual('@/lib/practice/halfStep');
  return { ...actual, recordPracticeResult: jest.fn(actual.recordPracticeResult) };
});

jest.mock('@/data/pcic', () => {
  const mk = (n: number, es: string, en: string, exampleEs?: string, exampleEn?: string) => ({
    id: `a1-w${n}`, es, en, kind: 'word' as const, section: 'Test', order: n, exampleEs, exampleEn,
  });
  const ITEMS = [
    mk(1, 'el libro', 'the book', 'El libro y la mesa.', 'The book and the table.'),
    mk(2, 'la mesa', 'the table', 'La mesa y el libro.', 'The table and the book.'),
    mk(3, 'el gato', 'the cat', 'El gato.', 'The cat.'),
    mk(4, 'el perro', 'the dog', 'El perro y el gato.', 'The dog and the cat.'),
  ];
  return {
    PCIC_LEVELS: ['A1'],
    PCIC_VIEW_LEVELS: ['A1'],
    pcicItemsForLevel: () => ITEMS,
    findPcicItem: (id: string) => ITEMS.find((i) => i.id === id),
    levelOfItem: () => undefined,
    setPcicTarget: () => {},
  };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { __resetBetaForTest, setBeta } from '@/lib/beta';
import { __resetForTests as resetDailyXp } from '@/lib/dailyXp';
import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { recordPracticeResult } from '@/lib/practice/halfStep';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import SentencesScreen from '../sentences';

jest.setTimeout(30000);

const mockRecord = recordPracticeResult as jest.Mock;

const flush = async (times = 5) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const learned = (n: number, due = '2099-01-01'): Sm2Card => ({
  ...sm2NewCard(`a1-w${n}`), state: 'review', interval: 3, reps: 2, due, lastReview: '2026-10-09', introducedAt: '2026-10-09',
});

const learnWords = async (nums: number[], dueNums: number[] = []) => {
  for (const n of nums) await getDb().upsertPcicCard(learned(n, dueNums.includes(n) ? '2000-01-01' : '2099-01-01'));
};

type R = ReturnType<typeof render>;
const build = (r: R, words: string[]) => {
  for (const w of words) fireEvent.press(r.getAllByText(w)[0]);
};
const check = (r: R) => fireEvent.press(r.getByText('Check'));
const next = (r: R) => fireEvent.press(r.getByText(/^Next/));
const typeIt = (r: R, text: string) => {
  fireEvent.changeText(r.getByPlaceholderText('Type the sentence'), text);
  fireEvent.press(r.getByText('✓ Check'));
};
const doneCount = (r: R) => String(r.getByTestId('sentences-progress-text').props.children);

beforeEach(async () => {
  await getDb().resetPcicCards();
  await getDb().setOnboarding('en', 'es');
  __resetBetaForTest();
  await getDb().setBetaFlag('xpV2', false);
  resetDailyXp();
  await getDb().addDailyXpTenths(localDateString(), -100000);
  mockRecord.mockClear();
});
afterEach(() => setLanguage('en'));

describe('Sentences tab', () => {
  it('no learned words: the empty state (EN and ES)', async () => {
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByText('Learn more words to unlock sentences')).toBeTruthy();
    expect(r.getByText('Sentences')).toBeTruthy();
    r.unmount();
    setLanguage('es');
    const es = render(<SentencesScreen />);
    await flush();
    expect(es.getByText('Aprende más palabras para desbloquear frases')).toBeTruthy();
    expect(es.getByText('Frases')).toBeTruthy();
  });

  it('only sentences of learned words, shortest first: build, then type the same sentence', async () => {
    await learnWords([1, 2, 3]); // the dog is not learned, so "The dog and the cat." stays out
    const r = render(<SentencesScreen />);
    await flush();
    expect(doneCount(r)).toBe('0 / 3');
    expect(r.queryByText('The dog and the cat.')).toBeNull();
    // step 1: the 2-word sentence
    expect(r.getByText('Step 1 of 2: build the sentence')).toBeTruthy();
    expect(r.getByText('The cat.')).toBeTruthy();
    build(r, ['el', 'gato']);
    check(r);
    next(r);
    await flush();
    // step 2: the same sentence, typed
    expect(r.getByText('Step 2 of 2: type the sentence')).toBeTruthy();
    expect(r.getByText('The cat.')).toBeTruthy();
    typeIt(r, 'el gato');
    next(r);
    await flush();
    expect(doneCount(r)).toBe('1 / 3');
    expect(r.getByText('The book and the table.')).toBeTruthy();
  });

  it('a sentence with a due word comes before shorter ones', async () => {
    await learnWords([1, 2, 3], [1]); // the book is due: both sentences with "libro" go first
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByText('The book and the table.')).toBeTruthy();
  });

  it('a right sentence: each learned word gets one "correct" half, a word once; the round ends with a summary', async () => {
    await learnWords([1, 2, 3]);
    const r = render(<SentencesScreen />);
    await flush();
    const play = async (built: string[], typed: string) => {
      build(r, built);
      check(r);
      next(r);
      await flush();
      typeIt(r, typed);
      next(r);
      await flush();
    };
    await play(['el', 'gato'], 'el gato');
    expect(mockRecord.mock.calls.map((c) => c.slice(0, 2))).toEqual([['a1-w3', 'correct']]);
    await play(['el', 'libro', 'y', 'la', 'mesa'], 'el libro y la mesa');
    await play(['la', 'mesa', 'y', 'el', 'libro'], 'la mesa y el libro');
    const calls = mockRecord.mock.calls.map((c) => c.slice(0, 2).join(':'));
    expect(calls.sort()).toEqual(['a1-w1:correct', 'a1-w1:correct', 'a1-w2:correct', 'a1-w2:correct', 'a1-w3:correct']);
    expect(r.getByText('Round done: 3 sentences')).toBeTruthy();

    // "el libro" and "la mesa" got 2 halves = one full step (reps 2 -> 3); "el gato" has 1 half
    const cards = new Map((await getDb().getPcicCards()).map((c) => [c.itemId, c]));
    expect(cards.get('a1-w1')).toMatchObject({ reps: 3, halfSteps: 0 });
    expect(cards.get('a1-w2')).toMatchObject({ reps: 3, halfSteps: 0 });
    expect(cards.get('a1-w3')).toMatchObject({ reps: 2, halfSteps: 1 });

    // more: those sentences are done for this run, nothing left
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    expect(r.getByText('Learn more words to unlock sentences')).toBeTruthy();
  });

  it('wrong typing: no result for the words, no step back, the sentence comes back at the end', async () => {
    await learnWords([1, 2, 3]);
    const r = render(<SentencesScreen />);
    await flush();
    build(r, ['el', 'gato']);
    check(r);
    next(r);
    await flush();
    typeIt(r, 'la gata');
    next(r);
    await flush();
    expect(mockRecord).not.toHaveBeenCalled();
    expect(doneCount(r)).toBe('0 / 3');
    // the other two come first, "The cat." is last
    expect(r.getByText('The book and the table.')).toBeTruthy();
    build(r, ['el', 'libro', 'y', 'la', 'mesa']);
    check(r);
    next(r);
    await flush();
    typeIt(r, 'el libro y la mesa');
    next(r);
    await flush();
    expect(r.getByText('The table and the book.')).toBeTruthy();
    build(r, ['la', 'mesa', 'y', 'el', 'libro']);
    check(r);
    next(r);
    await flush();
    typeIt(r, 'la mesa y el libro');
    next(r);
    await flush();
    expect(r.getByText('The cat.')).toBeTruthy();
    expect(r.getByText('Step 1 of 2: build the sentence')).toBeTruthy();
    expect(doneCount(r)).toBe('2 / 3');
  });

  it('wrong build: the sentence goes to the end and the typing step is skipped', async () => {
    await learnWords([1, 2, 3]);
    const r = render(<SentencesScreen />);
    await flush();
    build(r, ['gato']);
    check(r);
    next(r);
    await flush();
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
    expect(r.getByText('Step 1 of 2: build the sentence')).toBeTruthy();
    expect(r.getByText('The book and the table.')).toBeTruthy();
    expect(mockRecord).not.toHaveBeenCalled();
    expect(doneCount(r)).toBe('0 / 3');
  });

  // "el gato" is a one-word sentence on the word a1-w3 (reps 2): its half is worth 1 XP with the switch on.
  const playGato = async (r: R) => {
    build(r, ['el', 'gato']);
    check(r);
    next(r);
    await flush();
    typeIt(r, 'el gato');
    next(r);
    await flush();
  };

  it('beta xpV2 off (default): a right sentence gives the half but no XP', async () => {
    await learnWords([3]);
    const r = render(<SentencesScreen />);
    await flush();
    await playGato(r);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(0);
  });

  it('beta xpV2 on: a right sentence earns one half XP per word (1 XP; 0.2 XP from the 3rd repetition)', async () => {
    await setBeta('xpV2', true);
    await learnWords([3]);
    const r = render(<SentencesScreen />);
    await flush();
    await playGato(r);
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(10);
    r.unmount();

    await getDb().resetPcicCards();
    await getDb().upsertPcicCard({ ...learned(3), reps: 3 });
    const again = render(<SentencesScreen />);
    await flush();
    await playGato(again);
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(12);
  });
});
