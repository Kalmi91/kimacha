// A sentence card after every 4th NEW word in the deck round
// (alternating assemble and type-in), practice only: it writes no SRS.
// Mock pattern: app/(tabs)/__tests__/pcicDirection.test.tsx.

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
    // With this the test can bring the tab back "into focus" (tab switch and back).
    (globalThis as { __focusCb?: () => void }).__focusCb = cb;
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

jest.mock('@/data/pcic', () => {
  const mk = (n: number, es: string, en: string, exampleEs?: string, exampleEn?: string) => ({
    id: `a1-w${n}`, es, en, kind: 'word' as const, section: 'Test', order: n, exampleEs, exampleEn,
  });
  const ITEMS = [
    mk(1, 'el libro', 'the book', 'El libro y la mesa.', 'The book and the table.'),
    mk(2, 'la mesa', 'the table', 'La mesa y el libro.', 'The table and the book.'),
    mk(3, 'el gato', 'the cat', 'El gato y el perro.', 'The cat and the dog.'),
    mk(4, 'la casa', 'the house', 'La casa y la mesa.', 'The house and the table.'),
    mk(5, 'el perro', 'the dog'),
    mk(6, 'la silla', 'the chair', 'La silla y la mesa.', 'The chair and the table.'),
    mk(7, 'el vaso', 'the glass', 'El vaso y la casa.', 'The glass and the house.'),
    mk(8, 'la luz', 'the light', 'La luz y el vaso.', 'The light and the glass.'),
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
import { TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { speak } from '@/lib/speech';
import PcicScreen from '../index';

const mockSpeak = speak as jest.Mock;

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const ANSWERS: Record<string, string> = {
  'the book': 'el libro',
  'the table': 'la mesa',
  'the cat': 'el gato',
  'the house': 'la casa',
  'the dog': 'el perro',
  'the chair': 'la silla',
  'the glass': 'el vaso',
  'the light': 'la luz',
};

describe('PCIC tab: sentence card', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(RESUME_GAME_ID);
    await getDb().setOnboarding('en', 'es');
    await getDb().setPcicLevel('A1');
    mockSpeak.mockClear();
  });

  // Answering a NEW word: types the correct form, Check, Next.
  const answerWord = async (r: ReturnType<typeof render>, prompt: string) => {
    expect(r.getByText(prompt)).toBeTruthy();
    fireEvent.changeText(r.UNSAFE_getByType(TextInput), ANSWERS[prompt]);
    fireEvent.press(r.getByText('✓ Check'));
    await flush();
    fireEvent.press(r.getByText('Next → Knew it'));
    await flush();
  };

  it('after the 4th new word a build-the-sentence card comes, after the 8th a type-it card, and neither writes SRS', async () => {
    const r = render(<PcicScreen />);
    await flush();

    for (const prompt of ['the book', 'the table', 'the cat']) await answerWord(r, prompt);
    expect(r.queryByText('Type the sentence')).toBeNull();
    expect(r.queryByText('The book and the table.')).toBeNull();

    await answerWord(r, 'the house');
    // Assemble card: the source sentence on top, the next word does not speak yet.
    expect(r.getByText('The book and the table.')).toBeTruthy();
    expect(r.queryByText('the dog')).toBeNull();
    expect(mockSpeak).not.toHaveBeenCalledWith('the dog', 'en-US');

    for (const w of ['el', 'libro', 'y', 'la', 'mesa']) fireEvent.press(r.getAllByText(w)[0]);
    fireEvent.press(r.getByText('Check'));
    fireEvent.press(r.getByText(/^Next/));
    await flush();

    // The card closed: the prompt of the 5th word shows and is read aloud.
    expect(r.getByText('the dog')).toBeTruthy();
    expect(mockSpeak).toHaveBeenCalledWith('the dog', 'en-US');
    expect((await getDb().getPcicCards()).length).toBe(4);

    for (const prompt of ['the dog', 'the chair', 'the glass', 'the light']) await answerWord(r, prompt);
    // Type-in card: the 5th word has no sentence, the 6th's (silla) goes through the gate.
    expect(r.getByText('The chair and the table.')).toBeTruthy();
    fireEvent.changeText(r.getByPlaceholderText('Type the sentence'), 'la silla y la mesa');
    fireEvent.press(r.getByText('✓ Check'));
    fireEvent.press(r.getByText(/^Next/));
    await flush();

    expect((await getDb().getPcicCards()).length).toBe(8);
  });

  it('Undo restores the cadence counter: the re-rated 4th word gives a sentence again', async () => {
    const r = render(<PcicScreen />);
    await flush();
    for (const prompt of ['the book', 'the table', 'the cat']) await answerWord(r, prompt);
    await answerWord(r, 'the house');
    // It can also be closed with a wrong build: one tile, Check, Next.
    fireEvent.press(r.getAllByText('mesa')[0]);
    fireEvent.press(r.getByText('Check'));
    fireEvent.press(r.getByText(/^Next/));
    await flush();

    fireEvent.press(r.getByLabelText('Undo'));
    await flush();
    // Undo restores the revealed state: Next grades again.
    fireEvent.press(r.getByText('Next → Knew it'));
    await flush();
    expect(r.getByText('The book and the table.')).toBeTruthy();
  });

  it('the counter also counts across tab switches: 3 new words, focus reload, the card comes after the 4th', async () => {
    const r = render(<PcicScreen />);
    await flush();
    for (const prompt of ['the book', 'the table', 'the cat']) await answerWord(r, prompt);

    // To Settings and back: the tab gets focus again, load() rebuilds the queue.
    await act(async () => {
      (globalThis as { __focusCb?: () => void }).__focusCb?.();
    });
    await flush();
    expect(r.queryByText('The book and the table.')).toBeNull();

    await answerWord(r, 'the house');
    expect(r.getByText('The book and the table.')).toBeTruthy();
  });
});
