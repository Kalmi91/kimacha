// Leaving the Sentences tab and coming back (blur, then focus) keeps the round: the same sentence and order, the
// same counter, and a finished round stays on its done screen. Mock pattern: sentencesTab.test.tsx, with a
// useFocusEffect that can be fired again.

jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
  stop: jest.fn(),
}));
let mockFocus: (() => void) | null = null;
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    mockFocus = cb;
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));

jest.mock('@/data/pcic', () => {
  const mk = (n: number, es: string, en: string, exampleEs?: string, exampleEn?: string) => ({
    id: `a1-w${n}`, es, en, kind: 'word' as const, section: 'Test', order: n, exampleEs, exampleEn,
  });
  const ITEMS = [
    mk(1, 'el libro', 'the book', 'El libro y la mesa.', 'The book and the table.'),
    mk(2, 'la mesa', 'the table', 'La mesa y el libro.', 'The table and the book.'),
    mk(3, 'el gato', 'the cat', 'El gato.', 'The cat.'),
    mk(4, 'el perro', 'the dog', 'El perro y la mesa.', 'The dog and the table.'),
    mk(5, 'la casa', 'the house', 'La casa y el gato.', 'The house and the cat.'),
    mk(6, 'el pan', 'the bread', 'Un pan y una casa.', 'A bread and a house.'),
  ];
  return {
    PCIC_LEVELS: ['A1'],
    PCIC_VIEW_LEVELS: ['A1'],
    pcicItemsForLevel: () => ITEMS,
    findPcicItem: (id: string) => ITEMS.find((i) => i.id === id),
    levelOfItem: () => 'A1',
    setPcicTarget: () => {},
  };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { __resetBetaForTest } from '@/lib/beta';
import { __resetForTests as resetDailyXp } from '@/lib/dailyXp';
import { getDb } from '@/lib/database';
import { clearSentenceRound } from '@/lib/sentenceRound';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import SentencesScreen from '../sentences';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(12);

const learned = (n: number): Sm2Card => ({
  ...sm2NewCard(`a1-w${n}`), state: 'review', interval: 3, reps: 2, due: '2099-01-01', lastReview: '2026-10-09', introducedAt: '2026-10-09',
});

const SENT: Record<string, { tiles: string[]; typed: string }> = {
  'The cat.': { tiles: ['el', 'gato'], typed: 'el gato' },
  'The book and the table.': { tiles: ['el', 'libro', 'y', 'la', 'mesa'], typed: 'el libro y la mesa' },
  'The table and the book.': { tiles: ['la', 'mesa', 'y', 'el', 'libro'], typed: 'la mesa y el libro' },
  'The dog and the table.': { tiles: ['el', 'perro', 'y', 'la', 'mesa'], typed: 'el perro y la mesa' },
  'The house and the cat.': { tiles: ['la', 'casa', 'y', 'el', 'gato'], typed: 'la casa y el gato' },
  'A bread and a house.': { tiles: ['un', 'pan', 'y', 'una', 'casa'], typed: 'un pan y una casa' },
};

type R = ReturnType<typeof render>;
const progress = (r: R) => String(r.getByTestId('sentences-progress-text').props.children);
const stepText = (r: R) => String(r.getByTestId('sentences-step').props.children);
const current = (r: R) => {
  const shown = Object.keys(SENT).filter((en) => r.queryByText(en) !== null);
  expect(shown).toHaveLength(1);
  return shown[0];
};
const buildCurrent = async (r: R) => {
  const en = current(r);
  for (const w of SENT[en].tiles) fireEvent.press(r.getAllByText(w)[0]);
  fireEvent.press(r.getByText('Check'));
  fireEvent.press(r.getByText(/^Next/));
  await flush();
  return en;
};
const typeCurrent = async (r: R) => {
  const en = current(r);
  fireEvent.changeText(r.getByPlaceholderText('Type the sentence'), SENT[en].typed);
  fireEvent.press(r.getByText('✓ Check'));
  fireEvent.press(r.getByText(/^Next/));
  await flush();
  return en;
};
// One sentence of the round: its build, then its typing.
const playSentence = async (r: R) => {
  const en = await buildCurrent(r);
  expect(await typeCurrent(r)).toBe(en);
  return en;
};
// The tab loses focus and gets it back: the focus effect runs again.
const refocus = async () => {
  await act(async () => {
    mockFocus?.();
  });
  await flush();
};

beforeEach(async () => {
  await getDb().resetPcicCards();
  await getDb().setOnboarding('en', 'es');
  await clearSentenceRound(getDb());
  __resetBetaForTest();
  await getDb().setBetaFlag('xpV2', false);
  // these tests read the prompt on every step; the listen-and-type step (beta sentenceListening, on by default) hides it
  await getDb().setBetaFlag('sentenceListening', false);
  resetDailyXp();
  await getDb().addDailyXpTenths(localDateString(), -100000);
  for (const n of [1, 2, 3, 4, 5, 6]) await getDb().upsertPcicCard(learned(n));
});

describe('Sentences tab keeps its round across blur and focus', () => {
  it('3 of 10 steps done: after blur and focus the same sentence, the same step and the same counter', async () => {
    const r = render(<SentencesScreen />);
    await flush();
    const first = await playSentence(r);
    const second = await buildCurrent(r);
    expect(second).not.toBe(first);
    expect(progress(r)).toBe('3 / 10');
    const label = stepText(r);
    expect(label).toBe('Sentence 2 of 5 · Type the whole sentence');

    await refocus();

    expect(progress(r)).toBe('3 / 10');
    expect(stepText(r)).toBe(label);
    expect(current(r)).toBe(second);
    expect(await typeCurrent(r)).toBe(second);
    expect(await playSentence(r)).not.toBe(second);
    expect(progress(r)).toBe('6 / 10');
  });

  it('a finished round stays on its done screen after blur and focus', async () => {
    const r = render(<SentencesScreen />);
    await flush();
    for (let i = 0; i < 5; i++) await playSentence(r);
    expect(r.getByTestId('sentences-round-done')).toBeTruthy();

    await refocus();

    expect(r.getByTestId('sentences-round-done')).toBeTruthy();
    expect(r.queryByTestId('sentences-more')).toBeTruthy();
  });
});
