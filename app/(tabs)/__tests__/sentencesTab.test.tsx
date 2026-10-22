// The Sentences tab (beta): queue from learned words; a round is 4 sentences built from tiles (no credit), then ONE other,
// shorter sentence typed. The typing credits word by word (a right word gets its half even if the rest is wrong, a due
// word typed wrong is a wrong typed answer), a wrong build sends the sentence to the end, the typing ends the round, a
// round that was left continues where it stopped (saved; an older saved round starts again), the `focus` route
// parameter puts the sentences with those words first, the level counter on top drops as words are credited, and the
// feedback button is on the screen. Mock pattern: pcicSentenceCard.test.tsx.

jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
  stop: jest.fn(),
}));
// The route parameters of the screen: a test sets `mockParams.focus` before it renders.
const mockParams: { focus?: string } = {};
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => mockParams,
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

// The words-open lemma data does not know the mocked corpus above: a small fake lookup (item -> its Spanish lemmas, lemma -> English gloss).
jest.mock('@/lib/sentenceHint', () => {
  const actual = jest.requireActual('@/lib/sentenceHint');
  const LEMMAS: Record<string, string[]> = {
    'a1-w1': ['el', 'libro', 'y', 'la', 'mesa'],
    'a1-w2': ['la', 'mesa', 'y', 'el', 'libro'],
    'a1-w3': ['el', 'gato'],
    'a1-w4': ['el', 'perro', 'y', 'la', 'mesa'],
    'a1-w5': ['la', 'casa', 'y', 'el', 'gato'],
    'a1-w6': ['un', 'pan', 'y', 'una', 'casa'],
  };
  const GLOSS: Record<string, string[]> = {
    el: ['the'], la: ['the'], libro: ['book'], mesa: ['table'], gato: ['cat'], perro: ['dog'], casa: ['house'], y: ['and'], un: ['a'], una: ['a'], pan: ['bread'],
  };
  const lookup = { sentenceLemmas: (id: string) => LEMMAS[id], glosses: (lemma: string) => GLOSS[lemma] ?? [], cardLemma: () => undefined };
  return { ...actual, hintPieces: (entry: unknown) => actual.hintPieces(entry, lookup) };
});

import { act, fireEvent, render, within } from '@testing-library/react-native';

import ResultBadge from '@/components/ResultBadge';
import { __resetBetaForTest, setBeta } from '@/lib/beta';
import { __resetForTests as resetDailyXp } from '@/lib/dailyXp';
import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { clearSentenceRound, loadSentenceRound, saveSentenceRound } from '@/lib/sentenceRound';
import { addDays, sm2NewCard, sm2Review, type Sm2Card } from '@/lib/sm2';
import sample from '@/lib/mistakes/__fixtures__/sample.json';
import { validateMistakesPayload, type MistakesBatch } from '@/lib/mistakes/format';
import { ThemeProvider } from '@/lib/ThemeContext';
import { localDateString } from '@/lib/usageStats';
import { recordPracticeResult } from '@/lib/practice/halfStep';
import { speak } from '@/lib/speech';
import SentencesScreen from '../sentences';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const mockRecord = recordPracticeResult as jest.Mock;
const mockSpeak = speak as jest.Mock;

const flush = makeFlush(14);

const learned = (n: number, due = '2099-01-01'): Sm2Card => ({
  ...sm2NewCard(`a1-w${n}`), state: 'review', interval: 3, reps: 2, due, lastReview: '2026-10-09', introducedAt: '2026-10-09',
});

const learnWords = async (nums: number[], dueNums: number[] = []) => {
  for (const n of nums) await getDb().upsertPcicCard(learned(n, dueNums.includes(n) ? '2000-01-01' : '2099-01-01'));
};

// The sentences of the mocked corpus: the prompt on screen, the tiles to build it, the text to type it.
const SENT: Record<string, { tiles: string[]; typed: string; item: string }> = {
  'The cat.': { tiles: ['el', 'gato'], typed: 'el gato', item: 'a1-w3' },
  'The book and the table.': { tiles: ['el', 'libro', 'y', 'la', 'mesa'], typed: 'el libro y la mesa', item: 'a1-w1' },
  'The table and the book.': { tiles: ['la', 'mesa', 'y', 'el', 'libro'], typed: 'la mesa y el libro', item: 'a1-w2' },
  'The dog and the table.': { tiles: ['el', 'perro', 'y', 'la', 'mesa'], typed: 'el perro y la mesa', item: 'a1-w4' },
  'The house and the cat.': { tiles: ['la', 'casa', 'y', 'el', 'gato'], typed: 'la casa y el gato', item: 'a1-w5' },
  'A bread and a house.': { tiles: ['un', 'pan', 'y', 'una', 'casa'], typed: 'un pan y una casa', item: 'a1-w6' },
};
// With all six words learned: "The cat." (the only short one) is typed, the builds are picked from the five 5-word
// sentences with variety (not three starting with "el"): the dog sentence is the one left out.
const BUILD_ORDER = ['The book and the table.', 'The table and the book.', 'The house and the cat.', 'A bread and a house.'];
const BUILD_IDS = BUILD_ORDER.map((en) => SENT[en].item);
const TYPED = 'The cat.';

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
// Which of the prompts is on screen (the tiles card and the typing card both show it).
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
// Types the current sentence: right, or `text` instead, and moves on.
const typeCurrent = async (r: R, text?: string) => {
  const en = current(r);
  typeIt(r, text ?? SENT[en].typed);
  next(r);
  await flush(24);
  return en;
};
const calls = () => mockRecord.mock.calls.map((c) => [c[0], c[1]]);
const card = async (n: number) => (await getDb().getPcicCards()).find((c) => c.itemId === `a1-w${n}`);

beforeEach(async () => {
  await getDb().resetPcicCards();
  await getDb().setOnboarding('en', 'es');
  await getDb().setPcicLevel('A1');
  await getDb().setGrammarPalette('classic');
  await clearSentenceRound(getDb());
  __resetBetaForTest();
  await getDb().setBetaFlag('xpV2', false);
  // the listening builds (beta sentenceListening, on by default) have their own describe below; every other test runs with it off
  await getDb().setBetaFlag('sentenceListening', false);
  // the tap-a-word hints (beta sentenceHint, on by default) have their own describe at the end
  await getDb().setBetaFlag('sentenceHint', false);
  resetDailyXp();
  await getDb().addDailyXpTenths(localDateString(), -100000);
  mockRecord.mockClear();
  delete mockParams.focus;
});
afterEach(() => {
  setLanguage('en');
  // @ts-expect-error test-only cleanup of a global set per test
  delete global.fetch;
});

describe('Sentences tab', () => {
  it('no learned words: the empty state (EN and ES); one header only (the navigator\'s), no second "Sentences" title', async () => {
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByText('Learn more words to unlock sentences')).toBeTruthy();
    expect(r.queryByText('Sentences')).toBeNull();
    r.unmount();
    setLanguage('es');
    const es = render(<SentencesScreen />);
    await flush();
    expect(es.getByText('Aprende más palabras para desbloquear frases')).toBeTruthy();
    expect(es.queryByText('Frases')).toBeNull();
  });

  it('a round has no title either (the progress is the only text on the header row)', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.queryByText('Sentences')).toBeNull();
    expect(r.queryAllByRole('header')).toHaveLength(0);
  });

  it('only sentences of learned words: 3 words -> 3 sentences, the shortest is typed, the other two are built', async () => {
    await learnWords([1, 2, 3]); // the dog is not learned, so "The dog and the table." stays out
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 3'); // 2 builds + the one typing
    expect(r.queryByText('The dog and the table.')).toBeNull();
    expect(stepText(r)).toBe('Build the sentence 1 of 2');
    expect(await buildCurrent(r)).toBe('The book and the table.');
    expect(await buildCurrent(r)).toBe('The table and the book.');
    expect(stepText(r)).toBe('Last step: type this sentence');
    expect(current(r)).toBe(TYPED);
  });

  it('Spanish UI: the step labels and the progress label', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
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

describe('the level counter on top (FB503)', () => {
  it('shows the level the Words tab shows (its words) and the due words of the level, EN and ES', async () => {
    await learnWords([1, 2, 3, 4, 5, 6], [1, 2]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByTestId('level-counter')).toBeTruthy();
    expect(r.getByText('A1')).toBeTruthy();
    expect(r.getByText('6 words')).toBeTruthy(); // = the Words tab's "N words" chip: every item of the level
    expect(r.getByText('due 2')).toBeTruthy();
    expect(r.getByLabelText('Level A1: 6 words, 2 due')).toBeTruthy();
    r.unmount();
    setLanguage('es');
    const es = render(<SentencesScreen />);
    await flush();
    expect(es.getByText('6 palabras')).toBeTruthy();
    expect(es.getByLabelText('Nivel A1: 6 palabras, 2 pendientes')).toBeTruthy();
  });

  it('is there with an empty round too', async () => {
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByLabelText('Level A1: 6 words, 0 due')).toBeTruthy();
  });

  it('drops after the typing credits the due words (the builds do not move it)', async () => {
    await learnWords([1, 2], [1, 2]); // book and table, both due
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByText('due 2')).toBeTruthy();
    await buildCurrent(r);
    await flush();
    expect(r.getByText('due 2')).toBeTruthy(); // a build credits nothing
    await typeCurrent(r); // the typed sentence has both words: both get their half
    await flush(24);
    expect(r.getByText('due 0')).toBeTruthy();
    expect(r.getByLabelText('Level A1: 6 words, 0 due')).toBeTruthy();
  });

  it('a word typed wrong stays due', async () => {
    await learnWords([1, 2], [1, 2]);
    const r = render(<SentencesScreen />);
    await flush();
    await buildCurrent(r);
    await typeCurrent(r, 'el libro y la silla'); // the book right, the table wrong
    await flush(24);
    expect(r.getByText('due 1')).toBeTruthy();
  });
});

describe('FB502: the "Correct" feedback is centered', () => {
  it('on the tiles card and on the typing card', async () => {
    await learnWords([1, 2]);
    const r = render(<SentencesScreen />);
    await flush();
    build(r, SENT[current(r)].tiles);
    check(r);
    expect(r.getByText('Correct!')).toBeTruthy();
    expect(r.UNSAFE_getByType(ResultBadge).props.align).toBe('center');
    next(r);
    await flush();
    typeIt(r, SENT[current(r)].typed);
    expect(r.getByText('Correct!')).toBeTruthy();
    expect(r.UNSAFE_getByType(ResultBadge).props.align).toBe('center');
  });
});

describe('the 4:1 rhythm', () => {
  it('4 builds, then exactly 1 typing of another, shorter sentence', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
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
    expect(built).toEqual(BUILD_ORDER);
    expect(stepText(r)).toBe('Last step: type this sentence');
    const typedEn = current(r);
    expect(built).not.toContain(typedEn); // FB509: its own sentence ...
    expect(typedEn).toBe(TYPED);
    expect(SENT[typedEn].tiles.length).toBeLessThan(Math.min(...built.map((en) => SENT[en].tiles.length))); // ... and shorter
    expect(await typeCurrent(r)).toBe(typedEn);
    expect(r.getByText('Round done: 5 sentences')).toBeTruthy();
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
  });

  it('a build credits nothing: no half, no XP, however many builds are right', async () => {
    await setBeta('xpV2', true);
    await learnWords([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]); // due, so a credited build would move the schedule
    const r = render(<SentencesScreen />);
    await flush();
    for (let i = 0; i < 4; i++) await buildCurrent(r);
    expect(mockRecord).not.toHaveBeenCalled();
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(0);
    expect((await card(1))?.halfSteps ?? 0).toBe(0);
  });

  it('a wrong build: no credit, the sentence goes to the end of the round and the typing waits for it', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(await buildCurrent(r, false)).toBe(BUILD_ORDER[0]);
    expect(mockRecord).not.toHaveBeenCalled();
    expect(progress(r)).toBe('0 / 5');
    expect(stepText(r)).toBe('Build the sentence 1 of 4');
    expect(await buildCurrent(r)).toBe(BUILD_ORDER[1]);
    expect(await buildCurrent(r)).toBe(BUILD_ORDER[2]);
    expect(await buildCurrent(r)).toBe(BUILD_ORDER[3]);
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
    expect(await buildCurrent(r)).toBe(BUILD_ORDER[0]);
    expect(stepText(r)).toBe('Last step: type this sentence');
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('after the round the finished sentences are left out of the next one', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    for (let i = 0; i < 4; i++) await buildCurrent(r);
    await typeCurrent(r);
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    // only the dog sentence was left out of the first round: it is the whole next round
    expect(current(r)).toBe('The dog and the table.');
    expect(progress(r)).toBe('0 / 1');
    expect(stepText(r)).toBe('Last step: type this sentence');
  });
});

describe('the typing credits word by word (FB505/508, Kálmán 2026-10-12)', () => {
  // The book and the table learned; the table due. A pool of two sentences: "The book and the table." is typed.
  const twoWords = async (dueNums: number[] = [2]) => {
    await learnWords([1, 2], dueNums);
    const r = render(<SentencesScreen />);
    await flush();
    expect(await buildCurrent(r)).toBe('The table and the book.');
    expect(current(r)).toBe('The book and the table.');
    return r;
  };

  it('the whole sentence right: every learned word gets its half', async () => {
    const r = await twoWords();
    await typeCurrent(r);
    expect(calls()).toEqual([['a1-w1', 'correct'], ['a1-w2', 'correct']]);
    expect((await card(1))?.halfSteps).toBe(1);
    expect((await card(2))?.halfSteps).toBe(1);
  });

  it('a partly right sentence: the right word gets its half, the due word that is wrong counts as a wrong typed answer', async () => {
    const r = await twoWords();
    await typeCurrent(r, 'el libro y la silla');
    expect(calls()).toEqual([['a1-w1', 'correct'], ['a1-w2', 'wrongTyped']]);
    expect((await card(1))?.halfSteps).toBe(1);
    expect((await card(2))).toMatchObject({ wrongStreak: 1, halfSteps: 0 });
    expect(r.getByText('Round done: 2 sentences')).toBeTruthy();
  });

  it('a word that is wrong but not due is left alone', async () => {
    const r = await twoWords([]);
    await typeCurrent(r, 'el libro y la silla');
    expect(calls()).toEqual([['a1-w1', 'correct']]);
    expect((await card(2))?.wrongStreak ?? 0).toBe(0);
  });

  it('a missing word counts as wrong; the right ones still count', async () => {
    const r = await twoWords();
    await typeCurrent(r, 'la mesa');
    expect(calls()).toEqual([['a1-w2', 'correct']]);
    expect((await card(1))?.halfSteps ?? 0).toBe(0);
  });

  it('"Knew it" on a sentence the check marked wrong credits every word', async () => {
    const r = await twoWords();
    typeIt(r, 'el libro y la silla');
    fireEvent.press(r.getByTestId('sentence-grade-good'));
    next(r);
    await flush(24);
    expect(calls()).toEqual([['a1-w1', 'correct'], ['a1-w2', 'correct']]);
  });

  it('the typing ends the round, right or wrong: the sentence is not asked again (no second credit for words just shown)', async () => {
    const r = await twoWords();
    await typeCurrent(r, 'xx');
    expect(r.getByText('Round done: 2 sentences')).toBeTruthy();
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
    expect(await loadSentenceRound(getDb())).toBeNull();
    expect(calls()).toEqual([['a1-w2', 'wrongTyped']]);
  });

  it('a single learned sentence is typed alone (no builds)', async () => {
    await learnWords([3]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 1');
    expect(stepText(r)).toBe('Last step: type this sentence');
    expect(await typeCurrent(r)).toBe('The cat.');
    expect(calls()).toEqual([['a1-w3', 'correct']]);
  });
});

describe('the due words come first (FB505/508)', () => {
  it('a due word brings its sentence into the round, and the due sentence is built first', async () => {
    await learnWords([1, 2, 3, 4, 5, 6], [4]); // the dog is due: its sentence would have been left out by variety
    const r = render(<SentencesScreen />);
    await flush();
    expect(current(r)).toBe('The dog and the table.');
    expect((await loadSentenceRound(getDb()))?.entries.map((e) => e.itemId)).toContain('a1-w4');
  });
});

describe('the `focus` route parameter', () => {
  it('the sentences with the focus words come first; without it the usual priority', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const plain = render(<SentencesScreen />);
    await flush();
    expect((await loadSentenceRound(getDb()))?.entries.map((e) => e.itemId)).not.toContain('a1-w4');
    plain.unmount();
    await clearSentenceRound(getDb());

    mockParams.focus = 'a1-w4,a1-w999';
    const focused = render(<SentencesScreen />);
    await flush();
    expect(current(focused)).toBe('The dog and the table.');
    expect((await loadSentenceRound(getDb()))).toMatchObject({ focus: 'a1-w4,a1-w999' });
  });

  it('a round saved for another focus (or none) is not continued: the new focus starts a new round', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const first = render(<SentencesScreen />);
    await flush();
    await buildCurrent(first);
    first.unmount();

    mockParams.focus = 'a1-w4';
    const focused = render(<SentencesScreen />);
    await flush();
    expect(progress(focused)).toBe('0 / 5');
    expect(current(focused)).toBe('The dog and the table.');
    await buildCurrent(focused);
    focused.unmount();

    // the same focus again: the round continues
    const back = render(<SentencesScreen />);
    await flush();
    expect(progress(back)).toBe('1 / 5');
  });
});

describe('the progress bar counts the same steps as the number (a block per step)', () => {
  it('classic bar: max = the steps of the round, now = the steps done', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByTestId('sentences-progress').props.accessibilityValue).toEqual({ min: 0, max: 5, now: 0 });
    await buildCurrent(r);
    await buildCurrent(r);
    expect(progress(r)).toBe('2 / 5');
    expect(r.getByTestId('sentences-progress').props.accessibilityValue).toEqual({ min: 0, max: 5, now: 2 });
  });

  it('brand (segmented) bar: exactly 5 blocks for "x / 5", not 8', async () => {
    await getDb().setGrammarPalette('brand');
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(
      <ThemeProvider>
        <SentencesScreen />
      </ThemeProvider>,
    );
    await flush();
    for (let i = 0; i < 5; i++) expect(r.queryByTestId(`sentences-progress-${i}`)).toBeTruthy();
    expect(r.queryByTestId('sentences-progress-5')).toBeNull();
    expect(progress(r)).toBe('0 / 5');
    r.unmount();
    // a round of other length: the blocks follow the count
    await clearSentenceRound(getDb());
    await getDb().resetPcicCards();
    await learnWords([1, 2, 3]);
    const small = render(
      <ThemeProvider>
        <SentencesScreen />
      </ThemeProvider>,
    );
    await flush();
    expect(progress(small)).toBe('0 / 3');
    expect(small.queryByTestId('sentences-progress-2')).toBeTruthy();
    expect(small.queryByTestId('sentences-progress-3')).toBeNull();
  });
});

describe('beta xpV2', () => {
  it('off (default): a typed word gets its half but no XP', async () => {
    await learnWords([3]);
    const r = render(<SentencesScreen />);
    await flush();
    await typeCurrent(r);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(0);
  });

  it('on: each typed word earns XP by its own reps (1 XP; 0.2 XP from the 3rd repetition); a wrong word earns none', async () => {
    await setBeta('xpV2', true);
    await learnWords([3]);
    const r = render(<SentencesScreen />);
    await flush();
    await typeCurrent(r);
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(10);
    r.unmount();

    await getDb().resetPcicCards();
    await getDb().upsertPcicCard({ ...learned(3), reps: 3 });
    const again = render(<SentencesScreen />);
    await flush();
    await typeCurrent(again);
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(12);

    await getDb().resetPcicCards();
    await getDb().upsertPcicCard(learned(3, '2000-01-01'));
    again.unmount();
    const wrong = render(<SentencesScreen />);
    await flush();
    await typeCurrent(wrong, 'el perro');
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(12);
  });
});

describe('a round that was left continues', () => {
  it('half way: another mount (other tab / app restart) is on the same sentence with the same progress', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const first = render(<SentencesScreen />);
    await flush();
    await buildCurrent(first);
    await buildCurrent(first);
    first.unmount();

    const back = render(<SentencesScreen />);
    await flush();
    expect(progress(back)).toBe('2 / 5');
    expect(stepText(back)).toBe('Build the sentence 3 of 4');
    expect(current(back)).toBe(BUILD_ORDER[2]);
    await buildCurrent(back);
    await buildCurrent(back);
    expect(stepText(back)).toBe('Last step: type this sentence');
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('waiting for the typing: the same sentence to type after a mount; the credit comes once, at the typing', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const first = render(<SentencesScreen />);
    await flush();
    for (let i = 0; i < 4; i++) await buildCurrent(first);
    first.unmount();

    const back = render(<SentencesScreen />);
    await flush();
    expect(stepText(back)).toBe('Last step: type this sentence');
    expect(progress(back)).toBe('4 / 5');
    expect(current(back)).toBe(TYPED);
    expect(mockRecord).not.toHaveBeenCalled();
    expect(await typeCurrent(back)).toBe(TYPED);
    expect(calls()).toEqual([['a1-w3', 'correct']]);
    expect(back.getByText('Round done: 5 sentences')).toBeTruthy();
  });

  it('the position is saved on every step (a wrong build too), and the saved round is dropped at the end of the round', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    const db = getDb();
    expect(await loadSentenceRound(db)).toMatchObject({ queue: BUILD_IDS, rated: [], phase: 'build', typed: { itemId: 'a1-w3' } });
    await buildCurrent(r, false);
    expect(await loadSentenceRound(db)).toMatchObject({ queue: [...BUILD_IDS.slice(1), BUILD_IDS[0]], rated: [] });
    for (let i = 0; i < 4; i++) await buildCurrent(r);
    expect(await loadSentenceRound(db)).toMatchObject({ queue: [], phase: 'type', rated: expect.arrayContaining(BUILD_IDS) });
    await typeCurrent(r);
    expect(await loadSentenceRound(db)).toBeNull();
  });

  it('a new day starts a new round, a saved round of another day is not continued', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
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
    expect(current(next)).toBe(BUILD_ORDER[0]);
    expect((await loadSentenceRound(getDb()))?.day).toBe(localDateString());
  });

  it('a broken saved value does not stop the tab: a fresh round starts', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await getDb().setGameProgress('app-resume', 'sentences', 'saved', { day: localDateString(), phase: 'build' });
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 5');
    expect(current(r)).toBe(BUILD_ORDER[0]);
  });

  it('a round saved by the previous version (the typed sentence was one of the built ones) starts again, no error', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const oldEntry = (id: string) => ({ itemId: id, source: `src ${id}`, target: `tgt ${id}`, wordCount: 2, wordIds: [`w-${id}`], due: false });
    await getDb().setGameProgress('app-resume', 'sentences', 'saved', {
      day: localDateString(),
      target: 'es',
      entries: ['a1-w1', 'a1-w2'].map(oldEntry),
      queue: ['a1-w2'],
      rated: ['a1-w1'],
      typeId: null,
      phase: 'build',
    });
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 5');
    expect(current(r)).toBe(BUILD_ORDER[0]);
    expect(await loadSentenceRound(getDb())).toMatchObject({ queue: BUILD_IDS, typed: { itemId: 'a1-w3' } });
  });
});

describe('the feedback button', () => {
  it('is on the screen with a round, with an empty round and after the round, with the sentences screen id in the message', async () => {
    const empty = render(<SentencesScreen />);
    await flush();
    expect(empty.getByLabelText('Feedback')).toBeTruthy();
    empty.unmount();

    await learnWords([1, 2, 3, 4, 5, 6]);
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
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(body.currentCard).toContain(`sentences:${BUILD_IDS[0]}`);
    expect(body.languagePair).toBe('en→es');

    for (let i = 0; i < 4; i++) await buildCurrent(r);
    expect(r.getByLabelText('Feedback')).toBeTruthy(); // the typing step
    await typeCurrent(r);
    expect(r.getByText('Round done: 5 sentences')).toBeTruthy();
    expect(r.getByLabelText('Feedback')).toBeTruthy();
  });
});

describe('the daily streak', () => {
  const YESTERDAY = addDays(localDateString(), -1);
  beforeEach(() => (getDb() as any).__setStreakForTest({ current_count: 4, last_date: YESTERDAY, longest_count: 4 }));

  it('a built sentence counts the day (opening the tab does not); the typing and a second round the same day add nothing', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(await getDb().getStreak()).toEqual({ current_count: 4, last_date: YESTERDAY, longest_count: 4 });
    await buildCurrent(r);
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: localDateString(), longest_count: 5 });
    for (let i = 0; i < 3; i++) await buildCurrent(r);
    await typeCurrent(r);
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    await typeCurrent(r);
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: localDateString(), longest_count: 5 });
  });

  it('a typed sentence counts the day on its own (a round that is only the typing)', async () => {
    await learnWords([3]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(current(r)).toBe(TYPED);
    expect(await getDb().getStreak()).toEqual({ current_count: 4, last_date: YESTERDAY, longest_count: 4 });
    await typeCurrent(r);
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: localDateString(), longest_count: 5 });
  });
});

describe('listening builds (beta sentenceListening, BRIEF-B1)', () => {
  beforeEach(async () => {
    await getDb().setBetaFlag('sentenceListening', true);
    __resetBetaForTest();
    mockSpeak.mockClear();
  });
  const play = (r: R) => r.queryByTestId('sentence-listen-play');
  // Builds the sentence BUILD_ORDER[i] right from its tiles and moves on (the prompt may be hidden, so no current()).
  const buildKnown = async (r: R, i: number) => {
    build(r, SENT[BUILD_ORDER[i]].tiles);
    check(r);
    next(r);
    await flush();
  };

  it('the 2nd and 4th build are heard (🔊 button, prompt hidden, read aloud); the 1st, the 3rd and the typing show the prompt', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    for (let i = 0; i < 4; i++) {
      const listening = i % 2 === 1;
      expect(stepText(r)).toBe(listening ? `Listen and build the sentence ${i + 1} of 4` : `Build the sentence ${i + 1} of 4`);
      expect(play(r) !== null).toBe(listening);
      expect(r.queryByText(BUILD_ORDER[i]) !== null).toBe(!listening);
      if (listening) expect(mockSpeak).toHaveBeenCalledWith(BUILD_ORDER[i], expect.any(String)); // read when the step opens
      await buildKnown(r, i);
    }
    expect(stepText(r)).toBe('Last step: type this sentence');
    expect(current(r)).toBe(TYPED);
    expect(play(r)).toBeNull();
    expect(r.getByPlaceholderText('Type the sentence')).toBeTruthy();
  });

  it('the prompt appears after a right build; the 🔊 button reads it again', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    await buildKnown(r, 0);
    mockSpeak.mockClear();
    fireEvent.press(play(r)!);
    expect(mockSpeak).toHaveBeenCalledWith(BUILD_ORDER[1], expect.any(String));
    build(r, SENT[BUILD_ORDER[1]].tiles);
    expect(r.queryByText(BUILD_ORDER[1])).toBeNull();
    check(r);
    expect(r.getByText(BUILD_ORDER[1])).toBeTruthy();
    expect(r.getByText('Correct!')).toBeTruthy();
  });

  it('a wrong listening build: no credit, the prompt stays hidden, the sentence comes back as a listening one', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    await buildKnown(r, 0);
    build(r, SENT[BUILD_ORDER[1]].tiles.slice(0, 1));
    check(r);
    expect(r.queryByText(BUILD_ORDER[1])).toBeNull();
    next(r);
    await flush();
    expect(mockRecord).not.toHaveBeenCalled();
    expect(play(r)).toBeNull(); // the 3rd: normal
    await buildKnown(r, 2);
    expect(play(r)).not.toBeNull(); // the 4th: listening
    await buildKnown(r, 3);
    // the 2nd sentence is back, at the end of the queue, and is still heard
    expect(play(r)).not.toBeNull();
    expect(r.queryByText(BUILD_ORDER[1])).toBeNull();
    expect(stepText(r)).toMatch(/^Listen and build the sentence/);
  });

  it('switch off: all four builds show the prompt, no 🔊 button (the old behavior)', async () => {
    await getDb().setBetaFlag('sentenceListening', false);
    __resetBetaForTest();
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    for (let i = 0; i < 4; i++) {
      expect(stepText(r)).toBe(`Build the sentence ${i + 1} of 4`);
      expect(play(r)).toBeNull();
      expect(r.getByText(BUILD_ORDER[i])).toBeTruthy();
      await buildKnown(r, i);
    }
  });

  it('Spanish UI: the step label and the button label', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    await buildKnown(r, 0);
    r.unmount();
    setLanguage('es');
    const es = render(<SentencesScreen />); // the saved round continues on the 2nd build
    await flush();
    expect(stepText(es)).toBe('Escucha y construye la frase 2 de 4');
    expect(es.getByLabelText('Reproducir la frase')).toBeTruthy();
    expect(es.getByText('Escucha y construye la frase')).toBeTruthy();
  });
});

describe('mistake step (beta sentenceMistakes, BRIEF-B2)', () => {
  const checked = validateMistakesPayload(sample);
  if (!checked.ok) throw new Error(checked.error);
  const BATCH: MistakesBatch = checked.batch;
  const S1 = `${BATCH.batchId}:s:s1`; // "I don't have tomato." -> "No tengo tomate.", wrong "Pero no tienes tomate."
  const S2 = `${BATCH.batchId}:s:s2`; // "That's fine." -> "Eso está bien.", wrong "Eso es bien."
  const MISTAKE_EN = "I don't have tomato.";
  const seedBatch = (b: MistakesBatch = BATCH) => getDb().saveMistakeBatch(b.batchId, JSON.stringify(b), '2026-10-20T10:00:00.000Z');
  const savedCard = async (id: string) => (await getDb().getMistakeCards()).find((c) => c.itemId === id);
  const label = (r: R) => r.queryByTestId('sentences-mistake-label');
  // Builds the tiles on screen right (or only the first one) and moves on.
  const buildTiles = async (r: R, tiles: string[], right = true) => {
    build(r, right ? tiles : tiles.slice(0, 1));
    check(r);
    next(r);
    await flush();
  };
  const TILES_S1 = ['no', 'tengo', 'tomate'];

  beforeEach(async () => {
    await getDb().setBetaFlag('sentenceMistakes', true);
    await getDb().upsertMistakeCard(sm2NewCard(S1));
    await getDb().upsertMistakeCard(sm2NewCard(S2));
    __resetBetaForTest();
  });
  afterEach(async () => {
    await seedBatch({ ...BATCH, sentences: [] }); // there is no delete: an empty list is "no mistake sentence"
  });

  it('the 3rd build is a sentence from the list (label, English prompt, the faulty words as decoys); a right build = "Knew it" in the mistake deck, nothing for the corpus cards', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await seedBatch();
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 5'); // still 4 builds + the typing
    expect(label(r)).toBeNull();
    expect(await buildCurrent(r)).toBe(BUILD_ORDER[0]);
    expect(await buildCurrent(r)).toBe(BUILD_ORDER[1]);
    expect(stepText(r)).toBe('Build the sentence 3 of 4');
    expect(r.getByTestId('sentences-mistake-label').props.children).toBe('From your mistakes');
    expect(r.getByText(MISTAKE_EN)).toBeTruthy();
    for (const en of Object.keys(SENT)) expect(r.queryByText(en)).toBeNull(); // not a corpus sentence (BUILD_ORDER[2] was replaced)
    for (const w of [...TILES_S1, 'pero', 'tienes']) expect(r.getAllByText(w).length).toBeGreaterThan(0);
    await buildTiles(r, TILES_S1);
    expect(await savedCard(S1)).toEqual(sm2Review(sm2NewCard(S1), 'good', localDateString()));
    expect(await savedCard(S2)).toEqual(sm2NewCard(S2));
    expect(mockRecord).not.toHaveBeenCalled();
    expect(label(r)).toBeNull();
    expect(await buildCurrent(r)).toBe(BUILD_ORDER[3]);
    expect(stepText(r)).toBe('Last step: type this sentence');
    expect(current(r)).toBe(TYPED);
    expect(await savedCard(S1)).toEqual(sm2Review(sm2NewCard(S1), 'good', localDateString())); // nothing more happened to it
  });

  it('a wrong mistake build is "Didn\'t know" and the sentence goes to the end of the round, where it can be built right', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await seedBatch();
    const r = render(<SentencesScreen />);
    await flush();
    await buildCurrent(r);
    await buildCurrent(r);
    await buildTiles(r, TILES_S1, false);
    const again = sm2Review(sm2NewCard(S1), 'again', localDateString());
    expect(await savedCard(S1)).toEqual(again);
    expect(progress(r)).toBe('2 / 5');
    expect(await buildCurrent(r)).toBe(BUILD_ORDER[3]); // the 4th is next, the mistake sentence waits at the end
    expect(label(r)).not.toBeNull();
    expect(r.getByText(MISTAKE_EN)).toBeTruthy();
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
    await buildTiles(r, TILES_S1);
    expect(await savedCard(S1)).toEqual(sm2Review(again, 'good', localDateString()));
    expect(current(r)).toBe(TYPED);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('a round that was left continues on the same mistake step (saved with the round)', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await seedBatch();
    const first = render(<SentencesScreen />);
    await flush();
    await buildCurrent(first);
    await buildCurrent(first);
    first.unmount();
    // the list changes in between: the saved round still holds the sentence
    await seedBatch({ ...BATCH, sentences: [] });
    const again = render(<SentencesScreen />);
    await flush();
    expect(stepText(again)).toBe('Build the sentence 3 of 4');
    expect(again.getByTestId('sentences-mistake-label')).toBeTruthy();
    expect(again.getByText(MISTAKE_EN)).toBeTruthy();
    expect(again.getAllByText('tienes').length).toBeGreaterThan(0);
    expect((await loadSentenceRound(getDb()))?.entries[2].mistake).toEqual({ wrong: 'Pero no tienes tomate.' });
    await buildTiles(again, TILES_S1);
    expect(await savedCard(S1)).toEqual(sm2Review(sm2NewCard(S1), 'good', localDateString()));
  });

  it('a due sentence is chosen before one not seen yet', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await seedBatch();
    await getDb().upsertMistakeCard({ ...sm2NewCard(S2), state: 'learning', due: '2026-10-01', introducedAt: '2026-10-01', lastReview: '2026-10-01' });
    const r = render(<SentencesScreen />);
    await flush();
    await buildCurrent(r);
    await buildCurrent(r);
    expect(r.getByText("That's fine.")).toBeTruthy();
    expect(r.queryByText(MISTAKE_EN)).toBeNull();
    expect(r.getAllByText('es').length).toBeGreaterThan(0); // the faulty "Eso es bien."
  });

  it('no list loaded, a list with only a doubtful sentence, or the switch off: the round is today\'s, nothing touches the mistake deck', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const playRound = async () => {
      const r = render(<SentencesScreen />);
      await flush();
      for (let i = 0; i < 4; i++) {
        expect(stepText(r)).toBe(`Build the sentence ${i + 1} of 4`);
        expect(label(r)).toBeNull();
        expect(await buildCurrent(r)).toBe(BUILD_ORDER[i]);
      }
      r.unmount();
      await clearSentenceRound(getDb());
    };
    await playRound(); // no list
    await seedBatch({ ...BATCH, sentences: BATCH.sentences.filter((s) => s.doubtful) });
    await playRound(); // only a doubtful sentence
    await seedBatch();
    await getDb().setBetaFlag('sentenceMistakes', false);
    __resetBetaForTest();
    await playRound(); // switch off
    expect(await savedCard(S1)).toEqual(sm2NewCard(S1));
    expect(await savedCard(S2)).toEqual(sm2NewCard(S2));
  });

  it('Spanish UI: the label', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await seedBatch();
    const first = render(<SentencesScreen />);
    await flush();
    await buildCurrent(first);
    await buildCurrent(first);
    first.unmount();
    setLanguage('es');
    const es = render(<SentencesScreen />);
    await flush();
    expect(es.getByTestId('sentences-mistake-label').props.children).toBe('De tus errores');
    expect(es.getByText(MISTAKE_EN)).toBeTruthy();
  });
});

describe('tap-a-word hint (beta sentenceHint, BRIEF-B3)', () => {
  const bubble = (r: R) => r.queryByTestId('sentence-hint-bubble');
  const tap = (r: R, index: number) => fireEvent.press(r.getByTestId(`sentence-hint-${index}`));
  // The bubble's own text (a tile with the same word is on screen too).
  const inBubble = (r: R) => within(r.getByTestId('sentence-hint-bubble'));

  beforeEach(async () => {
    await getDb().setBetaFlag('sentenceHint', true);
    __resetBetaForTest();
  });
  afterEach(async () => {
    await getDb().setBetaFlag('sentenceHint', false);
  });

  it('the words of the English prompt that are glosses are tappable; a tap shows the Spanish form and "hint used", a second tap closes it', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(current(r)).toBe('The book and the table.');
    expect(bubble(r)).toBeNull();
    for (let i = 0; i < 5; i++) expect(r.getByTestId(`sentence-hint-${i}`)).toBeTruthy(); // the book and the table
    tap(r, 1);
    expect(r.getByTestId('sentence-hint-bubble')).toBeTruthy();
    expect(inBubble(r).getByText('libro')).toBeTruthy();
    expect(inBubble(r).getByText('hint used')).toBeTruthy();
    tap(r, 4);
    expect(inBubble(r).getByText('mesa')).toBeTruthy();
    expect(inBubble(r).queryByText('libro')).toBeNull();
    tap(r, 4);
    expect(bubble(r)).toBeNull();
  });

  it('the typing step has the hints too; the word that was looked at earns no half, the other words do', async () => {
    await learnWords([1, 2]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(await buildCurrent(r)).toBe('The table and the book.');
    expect(current(r)).toBe('The book and the table.');
    tap(r, 1); // "book" -> libro (card 1)
    expect(inBubble(r).getByText('libro')).toBeTruthy();
    await typeCurrent(r);
    expect((await card(1))?.halfSteps ?? 0).toBe(0);
    expect((await card(2))?.halfSteps).toBe(1);
    expect(calls()).toEqual([['a1-w2', 'correct']]); // card 1 was looked at: no credit at all
  });

  it('a word looked at in a build step earns nothing at the typing of the same round; the hint is kept with the saved round', async () => {
    await learnWords([1, 2]);
    const r = render(<SentencesScreen />);
    await flush();
    tap(r, 1); // build step "The table and the book.": "table" -> mesa (card 2)
    expect(inBubble(r).getByText('mesa')).toBeTruthy();
    await flush(); // the round is saved in the background
    expect((await loadSentenceRound(getDb()))?.hinted).toEqual(['a1-w2']);
    r.unmount();
    const again = render(<SentencesScreen />); // the round continues
    await flush();
    expect((await loadSentenceRound(getDb()))?.hinted).toEqual(['a1-w2']);
    await buildCurrent(again);
    await typeCurrent(again);
    expect((await card(2))?.halfSteps ?? 0).toBe(0);
    expect((await card(1))?.halfSteps).toBe(1);
  });

  it('a word looked at and typed wrong is not a wrong typed answer either; the other due word still is', async () => {
    await learnWords([1, 2], [1, 2]); // both due
    const r = render(<SentencesScreen />);
    await flush();
    await buildCurrent(r);
    const hintedId = current(r) === 'The book and the table.' ? 'a1-w1' : 'a1-w2'; // the 2nd word of the typed sentence: book / table
    const otherId = hintedId === 'a1-w1' ? 'a1-w2' : 'a1-w1';
    tap(r, 1);
    await typeCurrent(r, 'el gato');
    expect(calls()).toEqual([[otherId, 'wrongTyped']]);
  });

  it('on a listening step the prompt, and so the hints, only appear after a right build', async () => {
    await getDb().setBetaFlag('sentenceListening', true);
    __resetBetaForTest();
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    await buildCurrent(r);
    expect(r.queryByTestId('sentence-listen-play')).not.toBeNull();
    expect(r.queryByTestId('sentence-hint-0')).toBeNull(); // no English text yet
    build(r, SENT[BUILD_ORDER[1]].tiles);
    check(r);
    expect(r.getByTestId('sentence-hint-0')).toBeTruthy();
    tap(r, 0); // "The" -> la
    expect(r.getByTestId('sentence-hint-bubble')).toBeTruthy();
    await getDb().setBetaFlag('sentenceListening', false);
  });

  it('switch off: the prompt is plain text, nothing is underlined', async () => {
    await getDb().setBetaFlag('sentenceHint', false);
    __resetBetaForTest();
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByText('The book and the table.')).toBeTruthy();
    expect(r.queryByTestId('sentence-hint-0')).toBeNull();
  });

  it('Spanish UI: the mark in the bubble', async () => {
    setLanguage('es');
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    tap(r, 1);
    expect(r.getByText('pista usada')).toBeTruthy();
  });
});
