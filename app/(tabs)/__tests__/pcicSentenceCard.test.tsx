// PLAN-ketiranyu 7. lépés: minden 4. ÚJ szó után mondatkártya a pakli-menetben
// (felváltva összerakós és begépelős), csak gyakorlás: nem ír SRS-t (K3).
// Mock-minta: app/(tabs)/__tests__/pcicDirection.test.tsx.

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
    // A teszt ezzel tudja újra "fókuszba hozni" a fület (fülváltás és vissza).
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

describe('PCIC fül: mondatkártya (PLAN-ketiranyu 7. lépés)', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(RESUME_GAME_ID);
    await getDb().setOnboarding('en', 'es');
    await getDb().setPcicLevel('A1');
    mockSpeak.mockClear();
  });

  // Egy ÚJ szó megválaszolása: begépeli a helyes alakot, Check, Next.
  const answerWord = async (r: ReturnType<typeof render>, prompt: string) => {
    expect(r.getByText(prompt)).toBeTruthy();
    fireEvent.changeText(r.UNSAFE_getByType(TextInput), ANSWERS[prompt]);
    fireEvent.press(r.getByText('✓ Check'));
    await flush();
    fireEvent.press(r.getByText('Next → Knew it'));
    await flush();
  };

  it('a 4. új szó után összerakós kártya jön, a 8. után begépelős, és egyik sem ír SRS-t', async () => {
    const r = render(<PcicScreen />);
    await flush();

    for (const prompt of ['the book', 'the table', 'the cat']) await answerWord(r, prompt);
    expect(r.queryByText('Type the sentence')).toBeNull();
    expect(r.queryByText('The book and the table.')).toBeNull();

    await answerWord(r, 'the house');
    // Összerakós kártya: a forrás-mondat felül, a következő szó még nem szól.
    expect(r.getByText('The book and the table.')).toBeTruthy();
    expect(r.queryByText('the dog')).toBeNull();
    expect(mockSpeak).not.toHaveBeenCalledWith('the dog', 'en-US');

    for (const w of ['el', 'libro', 'y', 'la', 'mesa']) fireEvent.press(r.getAllByText(w)[0]);
    fireEvent.press(r.getByText('Check'));
    fireEvent.press(r.getByText(/^Next/));
    await flush();

    // A kártya bezárult: a 5. szó promptja látszik és felolvasódik.
    expect(r.getByText('the dog')).toBeTruthy();
    expect(mockSpeak).toHaveBeenCalledWith('the dog', 'en-US');
    expect((await getDb().getPcicCards()).length).toBe(4);

    for (const prompt of ['the dog', 'the chair', 'the glass', 'the light']) await answerWord(r, prompt);
    // Begépelős kártya: az 5. szónak nincs mondata, a 6.-é (silla) megy át a kapun.
    expect(r.getByText('The chair and the table.')).toBeTruthy();
    fireEvent.changeText(r.getByPlaceholderText('Type the sentence'), 'la silla y la mesa');
    fireEvent.press(r.getByText('✓ Check'));
    fireEvent.press(r.getByText(/^Next/));
    await flush();

    expect((await getDb().getPcicCards()).length).toBe(8);
  });

  it('a visszavonás (Undo) visszaadja a kadencia-számlálót: az újra értékelt 4. szó ismét mondatot ad', async () => {
    const r = render(<PcicScreen />);
    await flush();
    for (const prompt of ['the book', 'the table', 'the cat']) await answerWord(r, prompt);
    await answerWord(r, 'the house');
    // Bezárás rossz építéssel is lehet: egy csempe, Check, Next.
    fireEvent.press(r.getAllByText('mesa')[0]);
    fireEvent.press(r.getByText('Check'));
    fireEvent.press(r.getByText(/^Next/));
    await flush();

    fireEvent.press(r.getByLabelText('Undo'));
    await flush();
    // Az undo a felfedett állapotot állítja vissza: újra a Next értékel.
    fireEvent.press(r.getByText('Next → Knew it'));
    await flush();
    expect(r.getByText('The book and the table.')).toBeTruthy();
  });

  it('a számláló fülváltáson át is számol: 3 új szó, fókusz-újratöltés, a 4. után jön a kártya', async () => {
    const r = render(<PcicScreen />);
    await flush();
    for (const prompt of ['the book', 'the table', 'the cat']) await answerWord(r, prompt);

    // Settingsbe és vissza: a fül újra fókuszba kerül, load() újraépíti a sort.
    await act(async () => {
      (globalThis as { __focusCb?: () => void }).__focusCb?.();
    });
    await flush();
    expect(r.queryByText('The book and the table.')).toBeNull();

    await answerWord(r, 'the house');
    expect(r.getByText('The book and the table.')).toBeTruthy();
  });
});
