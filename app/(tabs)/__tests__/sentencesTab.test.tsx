// The Sentences tab (beta): queue from learned words; a round is 4 sentences built from tiles, then ONE of them typed.
// The half of a sentence is paid by its right build only (not by the typing), a wrong step sends the sentence to the end,
// a round that was left continues where it stopped (saved), and the feedback button is on the screen.
// Mock pattern: pcicSentenceCard.test.tsx.

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
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));
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
    mk(4, 'el perro', 'the dog', 'El perro y la mesa.', 'The dog and the table.'),
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
import { clearSentenceRound, loadSentenceRound, pickTypedId, saveSentenceRound } from '@/lib/sentenceRound';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import SentencesScreen from '../sentences';

jest.setTimeout(30000);

const mockRecord = recordPracticeResult as jest.Mock;

const flush = async (times = 12) => {
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

// The four sentences of the mocked corpus: the prompt on screen, the tiles to build it, the text to type it.
const SENT: Record<string, { tiles: string[]; typed: string; item: string }> = {
  'The cat.': { tiles: ['el', 'gato'], typed: 'el gato', item: 'a1-w3' },
  'The book and the table.': { tiles: ['el', 'libro', 'y', 'la', 'mesa'], typed: 'el libro y la mesa', item: 'a1-w1' },
  'The table and the book.': { tiles: ['la', 'mesa', 'y', 'el', 'libro'], typed: 'la mesa y el libro', item: 'a1-w2' },
  'The dog and the table.': { tiles: ['el', 'perro', 'y', 'la', 'mesa'], typed: 'el perro y la mesa', item: 'a1-w4' },
};
// With all four words learned the round is, shortest first and then in corpus order: cat, book-table, table-book, dog-table.
const ROUND_ORDER = ['The cat.', 'The book and the table.', 'The table and the book.', 'The dog and the table.'];
const FIRST_ORDER_IDS = ROUND_ORDER.map((en) => SENT[en].item);
// The calls the halves make in that order: one per learned word of each sentence.
const HALVES_IN_ORDER = ['a1-w3', 'a1-w1', 'a1-w2', 'a1-w2', 'a1-w1', 'a1-w4', 'a1-w2'];

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
const progress = (r: R) => String(r.getByTestId('sentences-progress-text').props.children);
const stepText = (r: R) => String(r.getByTestId('sentences-step').props.children);
// Which of the four prompts is on screen (the tiles card and the typing card both show it).
const onScreen = (r: R) => Object.keys(SENT).filter((en) => r.queryByText(en) !== null);
const current = (r: R) => {
  const shown = onScreen(r);
  expect(shown).toHaveLength(1);
  return shown[0];
};
// Builds the current sentence right (or wrong: only its first tile) and moves on.
const buildCurrent = async (r: R, right = true) => {
  const en = current(r);
  build(r, right ? SENT[en].tiles : SENT[en].tiles.slice(0, 1));
  check(r);
  next(r);
  await flush();
  return en;
};
const typeCurrent = async (r: R, right = true) => {
  const en = current(r);
  typeIt(r, right ? SENT[en].typed : 'la gata');
  next(r);
  await flush();
  return en;
};
const halves = () => mockRecord.mock.calls.map((c) => c[0]);

beforeEach(async () => {
  await getDb().resetPcicCards();
  await getDb().setOnboarding('en', 'es');
  await clearSentenceRound(getDb());
  __resetBetaForTest();
  await getDb().setBetaFlag('xpV2', false);
  resetDailyXp();
  await getDb().addDailyXpTenths(localDateString(), -100000);
  mockRecord.mockClear();
});
afterEach(() => {
  setLanguage('en');
  // @ts-expect-error test-only cleanup of a global set per test
  delete global.fetch;
});

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

  it('only sentences of learned words, shortest first: builds first, the typing only after the last build', async () => {
    await learnWords([1, 2, 3]); // the dog is not learned, so "The dog and the table." stays out
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 4'); // 3 builds + the one typing
    expect(r.queryByText('The dog and the table.')).toBeNull();
    expect(stepText(r)).toBe('Build the sentence 1 of 3');
    expect(await buildCurrent(r)).toBe('The cat.');
    expect(stepText(r)).toBe('Build the sentence 2 of 3');
    expect(await buildCurrent(r)).toBe('The book and the table.');
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
    expect(await buildCurrent(r)).toBe('The table and the book.');
    expect(progress(r)).toBe('3 / 4');
    expect(stepText(r)).toBe('Last step: type this sentence');
    expect(r.getByPlaceholderText('Type the sentence')).toBeTruthy();
  });

  it('a sentence with a due word comes before shorter ones', async () => {
    await learnWords([1, 2, 3], [1]); // the book is due: both sentences with "libro" go first
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByText('The book and the table.')).toBeTruthy();
  });

  it('Spanish UI: the step labels and the progress label', async () => {
    await learnWords([1, 2, 3, 4]);
    setLanguage('es');
    const r = render(<SentencesScreen />);
    await flush();
    expect(stepText(r)).toBe('Construye la frase 1 de 4');
    expect(r.getAllByLabelText('Pasos hechos: 0 de 5').length).toBeGreaterThan(0);
    r.unmount();
    // the typing step: play the four builds in English, come back in Spanish (the saved round continues)
    setLanguage('en');
    const en = render(<SentencesScreen />);
    await flush();
    for (let i = 0; i < 4; i++) await buildCurrent(en);
    en.unmount();
    setLanguage('es');
    const typing = render(<SentencesScreen />);
    await flush();
    expect(stepText(typing)).toBe('Último paso: escribe esta frase');
    expect(typing.getAllByLabelText('Pasos hechos: 4 de 5').length).toBeGreaterThan(0);
  });
});

describe('the 4:1 rhythm', () => {
  it('4 builds, then exactly 1 typing, and the typed sentence is one of the 4 built (the seeded pick)', async () => {
    await learnWords([1, 2, 3, 4]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 5');
    const built: string[] = [];
    for (let i = 0; i < 4; i++) {
      expect(stepText(r)).toBe(`Build the sentence ${i + 1} of 4`);
      expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
      built.push(await buildCurrent(r));
      expect(progress(r)).toBe(`${i + 1} / 5`);
    }
    expect(built).toEqual(ROUND_ORDER);
    // the typing: one sentence, the one the seeded pick names, one of the four
    expect(stepText(r)).toBe('Last step: type this sentence');
    const typedEn = current(r);
    expect(built).toContain(typedEn);
    const expectedId = pickTypedId(localDateString(), FIRST_ORDER_IDS);
    expect(SENT[typedEn].item).toBe(expectedId);
    expect(await typeCurrent(r)).toBe(typedEn);
    // after the typing the round is over: no second typing, no further build
    expect(r.getByText('Round done: 4 sentences')).toBeTruthy();
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
  });

  it('the half is paid by the builds only: one call per learned word of each sentence, the typing adds none', async () => {
    await learnWords([1, 2, 3, 4]);
    const r = render(<SentencesScreen />);
    await flush();
    for (let i = 0; i < 4; i++) await buildCurrent(r);
    expect(halves()).toEqual(HALVES_IN_ORDER);
    await typeCurrent(r);
    expect(halves()).toEqual(HALVES_IN_ORDER);
    expect(mockRecord.mock.calls.every((c) => c[1] === 'correct')).toBe(true);
    // "el libro" 2 halves = one full step (reps 2 -> 3), "la mesa" 3 halves = a step and a half, "el gato" / "el perro" one half
    const cards = new Map((await getDb().getPcicCards()).map((c) => [c.itemId, c]));
    expect(cards.get('a1-w1')).toMatchObject({ reps: 3, halfSteps: 0 });
    expect(cards.get('a1-w2')).toMatchObject({ reps: 3, halfSteps: 1 });
    expect(cards.get('a1-w3')).toMatchObject({ reps: 2, halfSteps: 1 });
    expect(cards.get('a1-w4')).toMatchObject({ reps: 2, halfSteps: 1 });
  });

  it('a wrong build: no half, the sentence goes to the end of the round and the typing waits for it', async () => {
    await learnWords([1, 2, 3, 4]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(await buildCurrent(r, false)).toBe('The cat.');
    expect(mockRecord).not.toHaveBeenCalled();
    expect(progress(r)).toBe('0 / 5');
    expect(stepText(r)).toBe('Build the sentence 1 of 4');
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
    // the other three come first, the cat is last, then the typing
    expect(await buildCurrent(r)).toBe('The book and the table.');
    expect(await buildCurrent(r)).toBe('The table and the book.');
    expect(await buildCurrent(r)).toBe('The dog and the table.');
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
    expect(await buildCurrent(r)).toBe('The cat.');
    expect(stepText(r)).toBe('Last step: type this sentence');
    expect(halves()).toEqual(['a1-w1', 'a1-w2', 'a1-w2', 'a1-w1', 'a1-w4', 'a1-w2', 'a1-w3']);
  });

  it('a wrong typing: no new half, no step back; the sentence is built and typed again, still no half', async () => {
    await learnWords([1, 2, 3, 4]);
    const r = render(<SentencesScreen />);
    await flush();
    for (let i = 0; i < 4; i++) await buildCurrent(r);
    const paid = [...halves()];
    const typedEn = await typeCurrent(r, false);
    expect(halves()).toEqual(paid);
    expect(progress(r)).toBe('4 / 5');
    // the same sentence comes back as the only one left: built again, typed again
    expect(current(r)).toBe(typedEn);
    expect(stepText(r)).toBe('Build the sentence 4 of 4');
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
    await buildCurrent(r);
    expect(halves()).toEqual(paid);
    expect(stepText(r)).toBe('Last step: type this sentence');
    expect(await typeCurrent(r)).toBe(typedEn);
    expect(halves()).toEqual(paid);
    expect(r.getByText('Round done: 4 sentences')).toBeTruthy();
  });

  it('after the round the finished sentences are left out of the next one', async () => {
    await learnWords([1, 2, 3, 4]);
    const r = render(<SentencesScreen />);
    await flush();
    for (let i = 0; i < 4; i++) await buildCurrent(r);
    await typeCurrent(r);
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    expect(r.getByText('Learn more words to unlock sentences')).toBeTruthy();
  });
});

describe('beta xpV2', () => {
  // "el gato" is a one-word sentence on the word a1-w3 (reps 2): its half is worth 1 XP with the switch on.
  const playGato = async (r: R) => {
    await buildCurrent(r);
    await typeCurrent(r);
  };

  it('off (default): a right build gives the half but no XP', async () => {
    await learnWords([3]);
    const r = render(<SentencesScreen />);
    await flush();
    await playGato(r);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(0);
  });

  it('on: the build earns one half XP per word (1 XP; 0.2 XP from the 3rd repetition), the typing earns none', async () => {
    await setBeta('xpV2', true);
    await learnWords([3]);
    const r = render(<SentencesScreen />);
    await flush();
    await buildCurrent(r);
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(10);
    await typeCurrent(r);
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

describe('a round that was left continues', () => {
  it('half way: another mount (other tab / app restart) is on the same sentence with the same progress, nothing paid twice', async () => {
    await learnWords([1, 2, 3, 4]);
    const first = render(<SentencesScreen />);
    await flush();
    await buildCurrent(first);
    await buildCurrent(first);
    expect(halves()).toEqual(HALVES_IN_ORDER.slice(0, 3));
    first.unmount();

    const back = render(<SentencesScreen />);
    await flush();
    expect(progress(back)).toBe('2 / 5');
    expect(stepText(back)).toBe('Build the sentence 3 of 4');
    expect(current(back)).toBe('The table and the book.');
    await buildCurrent(back);
    await buildCurrent(back);
    expect(halves()).toEqual(HALVES_IN_ORDER);
    expect(stepText(back)).toBe('Last step: type this sentence');
  });

  it('waiting for the typing: the same sentence to type after a mount, no half paid again', async () => {
    await learnWords([1, 2, 3, 4]);
    const first = render(<SentencesScreen />);
    await flush();
    for (let i = 0; i < 4; i++) await buildCurrent(first);
    const typedEn = current(first);
    first.unmount();

    const back = render(<SentencesScreen />);
    await flush();
    expect(stepText(back)).toBe('Last step: type this sentence');
    expect(progress(back)).toBe('4 / 5');
    expect(current(back)).toBe(typedEn);
    expect(halves()).toEqual(HALVES_IN_ORDER);
    expect(await typeCurrent(back)).toBe(typedEn);
    expect(halves()).toEqual(HALVES_IN_ORDER);
    expect(back.getByText('Round done: 4 sentences')).toBeTruthy();
  });

  it('a sentence already rated (built right) pays nothing when it is built again after a wrong typing and a mount', async () => {
    await learnWords([1, 2, 3, 4]);
    const first = render(<SentencesScreen />);
    await flush();
    for (let i = 0; i < 4; i++) await buildCurrent(first);
    const typedEn = await typeCurrent(first, false);
    first.unmount();

    const back = render(<SentencesScreen />);
    await flush();
    expect(current(back)).toBe(typedEn);
    expect(stepText(back)).toBe('Build the sentence 4 of 4');
    await buildCurrent(back);
    expect(halves()).toEqual(HALVES_IN_ORDER);
    expect(stepText(back)).toBe('Last step: type this sentence');
  });

  it('the position is saved on every step (a wrong build too), and the saved round is dropped at the end of the round', async () => {
    await learnWords([1, 2, 3, 4]);
    const r = render(<SentencesScreen />);
    await flush();
    const db = getDb();
    expect(await loadSentenceRound(db)).toMatchObject({ queue: FIRST_ORDER_IDS, rated: [], typeId: null, phase: 'build' });
    await buildCurrent(r, false);
    expect(await loadSentenceRound(db)).toMatchObject({ queue: [...FIRST_ORDER_IDS.slice(1), FIRST_ORDER_IDS[0]], rated: [] });
    for (let i = 0; i < 4; i++) await buildCurrent(r);
    expect(await loadSentenceRound(db)).toMatchObject({ queue: [], phase: 'type', rated: expect.arrayContaining(FIRST_ORDER_IDS) });
    await typeCurrent(r);
    expect(await loadSentenceRound(db)).toBeNull();
  });

  it('a new day starts a new round, a saved round of another day is not continued', async () => {
    await learnWords([1, 2, 3, 4]);
    const first = render(<SentencesScreen />);
    await flush();
    await buildCurrent(first);
    await buildCurrent(first);
    first.unmount();
    const saved = await loadSentenceRound(getDb());
    expect(saved).not.toBeNull();
    await saveSentenceRound(getDb(), { ...saved!, day: '2000-01-01' });

    const next = render(<SentencesScreen />);
    await flush();
    expect(progress(next)).toBe('0 / 5');
    expect(stepText(next)).toBe('Build the sentence 1 of 4');
    expect(current(next)).toBe('The cat.');
    expect((await loadSentenceRound(getDb()))?.day).toBe(localDateString());
  });

  it('a broken saved value does not stop the tab: a fresh round starts', async () => {
    await learnWords([1, 2, 3, 4]);
    await getDb().setGameProgress('app-resume', 'sentences', 'saved', { day: localDateString(), phase: 'build' });
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 5');
    expect(current(r)).toBe('The cat.');
  });
});

describe('the feedback button', () => {
  it('is on the screen with a round, with an empty round and after the round, with the sentences screen id in the message', async () => {
    const empty = render(<SentencesScreen />);
    await flush();
    expect(empty.getByLabelText('Feedback')).toBeTruthy();
    empty.unmount();

    await learnWords([1, 2, 3, 4]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as never);
    const r = render(<SentencesScreen />);
    await flush();
    fireEvent.press(r.getByLabelText('Feedback'));
    fireEvent.changeText(r.getByPlaceholderText('Share your thoughts...'), 'the tiles are small');
    // fake timers just for the send: the button's "thanks" toast runs a 2 s timer
    jest.useFakeTimers();
    await act(async () => {
      fireEvent.press(r.getByText('Send'));
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = decodeURIComponent((global.fetch as jest.Mock).mock.calls[0][0] as string);
    expect(url).toContain('currentCard=');
    expect(url).toContain('sentences:a1-w3');
    expect(url).toContain('languagePair=en-es');

    for (let i = 0; i < 4; i++) await buildCurrent(r);
    expect(r.getByLabelText('Feedback')).toBeTruthy(); // the typing step
    await typeCurrent(r);
    expect(r.getByText('Round done: 4 sentences')).toBeTruthy();
    expect(r.getByLabelText('Feedback')).toBeTruthy();
  });
});
