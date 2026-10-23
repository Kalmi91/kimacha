// The Sentences tab (beta): queue from learned words; a round is 5 sentences, each run through its steps one after the other:
// the parts of a split sentence, the listen-and-type step (beta sentenceListening), the whole sentence built, the whole
// sentence typed. Only the typing credits word by word (a right word gets its half even if the rest is wrong, a due word
// typed wrong is a wrong typed answer); a wrong step goes to the end of the round, the typing step is done either way, a
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
import { clearSentenceRound, loadSentenceRound, saveSentenceRound, startRound } from '@/lib/sentenceRound';
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
// With all six words learned the round is five sentences, in queue order (the short one first, then the corpus order) with
// variety (not three starting with "el"): the dog sentence is the one left out. Each runs build, then type (listening off,
// no parts in the mocked corpus): 10 steps.
const ROUND = ['The cat.', 'The book and the table.', 'The table and the book.', 'The house and the cat.', 'A bread and a house.'];
const ROUND_IDS = ROUND.map((en) => SENT[en].item);
const STEP_IDS = ROUND_IDS.flatMap((id) => [`${id}#build`, `${id}#type`]);
// The step label on screen: "Sentence 2 of 5 · Build the whole sentence".
const STEP = (n: number, total: number, label: string) => `Sentence ${n} of ${total} · ${label}`;
const BUILD = 'Build the whole sentence';
const TYPE = 'Type the whole sentence';

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
// One sentence of the round: its build, then its typing.
const playSentence = async (r: R, typeText?: string) => {
  const en = await buildCurrent(r);
  expect(await typeCurrent(r, typeText)).toBe(en);
  return en;
};
// Plays whatever is left of a round (listening off, no mistake sentence): builds and typings, all right.
const finishRound = async (r: R) => {
  for (let i = 0; i < 40 && !r.queryByTestId('sentences-round-done'); i++) {
    if (r.queryByPlaceholderText('Type the sentence')) await typeCurrent(r);
    else await buildCurrent(r);
  }
  expect(r.queryByTestId('sentences-round-done')).toBeTruthy();
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
  // the listen-and-type step (beta sentenceListening, on by default) has its own describe below; every other test runs with it off
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

  it('only sentences of learned words: 3 words -> 3 sentences, each built then typed, in the queue order', async () => {
    await learnWords([1, 2, 3]); // the dog is not learned, so "The dog and the table." stays out
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 6'); // 3 sentences x (build + typing)
    expect(r.queryByText('The dog and the table.')).toBeNull();
    expect(stepText(r)).toBe(STEP(1, 3, BUILD));
    expect(await playSentence(r)).toBe('The cat.');
    expect(stepText(r)).toBe(STEP(2, 3, BUILD));
    expect(await playSentence(r)).toBe('The book and the table.');
    expect(await playSentence(r)).toBe('The table and the book.');
    expect(r.getByText('Round done: 3 sentences')).toBeTruthy();
  });

  it('Spanish UI: the step labels and the progress label', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    setLanguage('es');
    const r = render(<SentencesScreen />);
    await flush();
    expect(stepText(r)).toBe('Frase 1 de 5 · Construye la frase entera');
    expect(r.getAllByLabelText('Pasos hechos: 0 de 10').length).toBeGreaterThan(0);
    r.unmount();
    // the typing step: build the first sentence in English, come back in Spanish (the saved round continues)
    setLanguage('en');
    const en = render(<SentencesScreen />);
    await flush();
    await buildCurrent(en);
    en.unmount();
    setLanguage('es');
    const typing = render(<SentencesScreen />);
    await flush();
    expect(stepText(typing)).toBe('Frase 1 de 5 · Escribe la frase entera');
    expect(typing.getAllByLabelText('Pasos hechos: 1 de 10').length).toBeGreaterThan(0);
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

  it('drops after the typing credits the due words (the build does not move it)', async () => {
    await learnWords([1, 2], [1, 2]); // book and table, both due
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByText('due 2')).toBeTruthy();
    await buildCurrent(r);
    await flush();
    expect(r.getByText('due 2')).toBeTruthy(); // a build credits nothing
    await typeCurrent(r); // the first sentence has both words: both get their half
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

describe('the steps of a round (FB524)', () => {
  it('5 sentences, each built whole and then typed whole, one after the other', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 10');
    const played: string[] = [];
    for (let i = 0; i < 5; i++) {
      expect(stepText(r)).toBe(STEP(i + 1, 5, BUILD));
      expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
      const en = await buildCurrent(r);
      expect(progress(r)).toBe(`${2 * i + 1} / 10`);
      expect(stepText(r)).toBe(STEP(i + 1, 5, TYPE));
      expect(r.getByPlaceholderText('Type the sentence')).toBeTruthy();
      expect(await typeCurrent(r)).toBe(en); // the same sentence
      expect(progress(r)).toBe(i < 4 ? `${2 * i + 2} / 10` : '10 / 10');
      played.push(en);
    }
    expect(played).toEqual(ROUND);
    expect(r.getByText('Round done: 5 sentences')).toBeTruthy();
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
  });

  it('a build credits nothing (no half, no XP); the typing of the same sentence does', async () => {
    await setBeta('xpV2', true);
    await learnWords([1, 2, 3, 4, 5, 6], [3]); // the cat is due (so its sentence comes first), a credited build would move the schedule
    const r = render(<SentencesScreen />);
    await flush();
    await buildCurrent(r);
    expect(mockRecord).not.toHaveBeenCalled();
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(0);
    expect((await card(3))?.halfSteps ?? 0).toBe(0);
    await typeCurrent(r);
    expect(calls()).toEqual([['a1-w3', 'correct']]);
    expect((await card(3))?.halfSteps).toBe(1);
  });

  it('a wrong build: no credit, the build goes to the end of the round (the typing of the sentence is not held back)', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(await buildCurrent(r, false)).toBe(ROUND[0]);
    expect(mockRecord).not.toHaveBeenCalled();
    expect(progress(r)).toBe('0 / 10');
    expect(stepText(r)).toBe(STEP(1, 5, TYPE)); // the next step in the queue is the typing of the same sentence
    expect(await typeCurrent(r)).toBe(ROUND[0]);
    expect(calls()).toEqual([['a1-w3', 'correct']]);
    // the other four sentences, then the cat build is back as the very last step
    for (let i = 1; i < 5; i++) expect(await playSentence(r)).toBe(ROUND[i]);
    expect(progress(r)).toBe('9 / 10');
    expect(stepText(r)).toBe(STEP(1, 5, BUILD));
    expect(await buildCurrent(r)).toBe(ROUND[0]);
    expect(r.getByText('Round done: 5 sentences')).toBeTruthy();
  });

  it('after the round the finished sentences are left out of the next one', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    await finishRound(r);
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    // only the dog sentence was left out of the first round: it is the whole next round
    expect(current(r)).toBe('The dog and the table.');
    expect(progress(r)).toBe('0 / 2');
    expect(stepText(r)).toBe(STEP(1, 1, BUILD));
  });
});

describe('the typing credits word by word (FB505/508, Kálmán 2026-10-12)', () => {
  // The book and the table learned; the table due. A pool of two sentences: "The book and the table." comes first, built here.
  const twoWords = async (dueNums: number[] = [2]) => {
    await learnWords([1, 2], dueNums);
    const r = render(<SentencesScreen />);
    await flush();
    expect(await buildCurrent(r)).toBe('The book and the table.');
    expect(stepText(r)).toBe(STEP(1, 2, TYPE));
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
    expect(stepText(r)).toBe(STEP(2, 2, BUILD)); // the round goes on with the next sentence
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

  it('the typing step is done right or wrong: the sentence is not typed again (no second credit for words just shown)', async () => {
    const r = await twoWords();
    await typeCurrent(r, 'xx');
    expect(stepText(r)).toBe(STEP(2, 2, BUILD));
    expect(calls()).toEqual([['a1-w2', 'wrongTyped']]);
    expect((await loadSentenceRound(getDb()))?.queue).not.toContain('a1-w1#type');
    await playSentence(r); // the second sentence: its build and its typing
    expect(r.getByText('Round done: 2 sentences')).toBeTruthy();
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
    expect(await loadSentenceRound(getDb())).toBeNull();
    expect(calls().filter((c) => c[1] === 'wrongTyped')).toEqual([['a1-w2', 'wrongTyped']]);
  });

  it('a single learned sentence: its build, then its typing', async () => {
    await learnWords([3]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 2');
    expect(stepText(r)).toBe(STEP(1, 1, BUILD));
    expect(await playSentence(r)).toBe('The cat.');
    expect(calls()).toEqual([['a1-w3', 'correct']]);
    expect(r.getByText('Round done: 1 sentence')).toBeTruthy();
  });
});

describe('the due words come first (FB505/508)', () => {
  it('a due word brings its sentence into the round, and the due sentence comes first', async () => {
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
    expect(progress(focused)).toBe('0 / 10');
    expect(current(focused)).toBe('The dog and the table.');
    await buildCurrent(focused);
    focused.unmount();

    // the same focus again: the round continues
    const back = render(<SentencesScreen />);
    await flush();
    expect(progress(back)).toBe('1 / 10');
  });
});

describe('the progress bar counts the same steps as the number (a block per step while the round is short)', () => {
  it('classic bar: max = the steps of the round, now = the steps done', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByTestId('sentences-progress').props.accessibilityValue).toEqual({ min: 0, max: 10, now: 0 });
    await playSentence(r);
    expect(progress(r)).toBe('2 / 10');
    expect(r.getByTestId('sentences-progress').props.accessibilityValue).toEqual({ min: 0, max: 10, now: 2 });
  });

  it('brand (segmented) bar: exactly 10 blocks for "x / 10"', async () => {
    await getDb().setGrammarPalette('brand');
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(
      <ThemeProvider>
        <SentencesScreen />
      </ThemeProvider>,
    );
    await flush();
    for (let i = 0; i < 10; i++) expect(r.queryByTestId(`sentences-progress-${i}`)).toBeTruthy();
    expect(r.queryByTestId('sentences-progress-10')).toBeNull();
    expect(progress(r)).toBe('0 / 10');
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
    expect(progress(small)).toBe('0 / 6');
    expect(small.queryByTestId('sentences-progress-5')).toBeTruthy();
    expect(small.queryByTestId('sentences-progress-6')).toBeNull();
  });

  it('brand bar, a long round (more than 12 steps): the usual 8 blocks, filled by the share done', async () => {
    await getDb().setBetaFlag('sentenceListening', true); // 5 sentences x 3 steps = 15
    __resetBetaForTest();
    await getDb().setGrammarPalette('brand');
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(
      <ThemeProvider>
        <SentencesScreen />
      </ThemeProvider>,
    );
    await flush();
    expect(progress(r)).toBe('0 / 15');
    for (let i = 0; i < 8; i++) expect(r.queryByTestId(`sentences-progress-${i}`)).toBeTruthy();
    expect(r.queryByTestId('sentences-progress-8')).toBeNull();
  });
});

describe('beta xpV2', () => {
  it('off (default): a typed word gets its half but no XP', async () => {
    await learnWords([3]);
    const r = render(<SentencesScreen />);
    await flush();
    await playSentence(r);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(0);
  });

  it('on: each typed word earns XP by its own reps (1 XP; 0.2 XP from the 3rd repetition); a wrong word earns none', async () => {
    await setBeta('xpV2', true);
    await learnWords([3]);
    const r = render(<SentencesScreen />);
    await flush();
    await playSentence(r);
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(10);
    r.unmount();

    await getDb().resetPcicCards();
    await getDb().upsertPcicCard({ ...learned(3), reps: 3 });
    const again = render(<SentencesScreen />);
    await flush();
    await playSentence(again);
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(12);

    await getDb().resetPcicCards();
    await getDb().upsertPcicCard(learned(3, '2000-01-01'));
    again.unmount();
    const wrong = render(<SentencesScreen />);
    await flush();
    await playSentence(wrong, 'el perro');
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(12);
  });
});

describe('a round that was left continues', () => {
  it('half way: another mount (other tab / app restart) is on the same step with the same progress', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const first = render(<SentencesScreen />);
    await flush();
    await playSentence(first);
    await buildCurrent(first);
    first.unmount();

    const back = render(<SentencesScreen />);
    await flush();
    expect(progress(back)).toBe('3 / 10');
    expect(stepText(back)).toBe(STEP(2, 5, TYPE));
    expect(current(back)).toBe(ROUND[1]);
    expect(calls()).toEqual([['a1-w3', 'correct']]); // only the first sentence was typed so far
    await typeCurrent(back);
    await finishRound(back);
    expect(back.getByText('Round done: 5 sentences')).toBeTruthy();
  });

  it('waiting for the typing: the same sentence to type after a mount; the credit comes once, at the typing', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const first = render(<SentencesScreen />);
    await flush();
    await buildCurrent(first);
    first.unmount();

    const back = render(<SentencesScreen />);
    await flush();
    expect(stepText(back)).toBe(STEP(1, 5, TYPE));
    expect(progress(back)).toBe('1 / 10');
    expect(current(back)).toBe(ROUND[0]);
    expect(mockRecord).not.toHaveBeenCalled();
    expect(await typeCurrent(back)).toBe(ROUND[0]);
    expect(calls()).toEqual([['a1-w3', 'correct']]);
  });

  it('the position is saved on every step (a wrong build too), and the saved round is dropped at the end of the round', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    const db = getDb();
    expect(await loadSentenceRound(db)).toMatchObject({ v: 2, queue: STEP_IDS, done: [], phase: 'steps' });
    await buildCurrent(r, false);
    expect(await loadSentenceRound(db)).toMatchObject({ queue: [...STEP_IDS.slice(1), STEP_IDS[0]], done: [] });
    await typeCurrent(r);
    expect(await loadSentenceRound(db)).toMatchObject({ queue: [...STEP_IDS.slice(2), STEP_IDS[0]], done: [STEP_IDS[1]] });
    await finishRound(r);
    expect(await loadSentenceRound(db)).toBeNull();
  });

  it('a new day starts a new round, a saved round of another day is not continued', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const first = render(<SentencesScreen />);
    await flush();
    await playSentence(first);
    first.unmount();
    const saved = await loadSentenceRound(getDb());
    expect(saved).not.toBeNull();
    await saveSentenceRound(getDb(), { ...saved!, day: '2000-01-01' });

    const next = render(<SentencesScreen />);
    await flush();
    expect(progress(next)).toBe('0 / 10');
    expect(stepText(next)).toBe(STEP(1, 5, BUILD));
    expect(current(next)).toBe(ROUND[0]);
    expect((await loadSentenceRound(getDb()))?.day).toBe(localDateString());
  });

  it('a broken saved value does not stop the tab: a fresh round starts', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await getDb().setGameProgress('app-resume', 'sentences', 'saved', { day: localDateString(), phase: 'steps' });
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 10');
    expect(current(r)).toBe(ROUND[0]);
  });

  it('a round saved by the previous version (builds, then a typed sentence of its own; no steps) starts again, no error', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const oldEntry = (id: string) => ({ itemId: id, source: `src ${id}`, target: `tgt ${id}`, wordCount: 2, wordIds: [`w-${id}`], due: false, dueIds: [], staleness: '', slots: [] });
    await getDb().setGameProgress('app-resume', 'sentences', 'saved', {
      day: localDateString(),
      target: 'es',
      focus: '',
      entries: ['a1-w1', 'a1-w2'].map(oldEntry),
      queue: ['a1-w2'],
      rated: ['a1-w1'],
      typed: oldEntry('a1-w3'),
      phase: 'build',
    });
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 10');
    expect(current(r)).toBe(ROUND[0]);
    expect(await loadSentenceRound(getDb())).toMatchObject({ v: 2, queue: STEP_IDS });
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
    expect(body.currentCard).toContain(`sentences:${ROUND_IDS[0]}`);
    expect(body.languagePair).toBe('en→es');

    await buildCurrent(r);
    expect(r.getByLabelText('Feedback')).toBeTruthy(); // the typing step
    await finishRound(r);
    expect(r.getByText('Round done: 5 sentences')).toBeTruthy();
    expect(r.getByLabelText('Feedback')).toBeTruthy();
  });
});

describe('the daily streak', () => {
  const YESTERDAY = addDays(localDateString(), -1);
  beforeEach(() => (getDb() as any).__setStreakForTest({ current_count: 4, last_date: YESTERDAY, longest_count: 4 }));

  it('a built sentence counts the day (opening the tab does not); the rest of the round and a second round the same day add nothing', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(await getDb().getStreak()).toEqual({ current_count: 4, last_date: YESTERDAY, longest_count: 4 });
    await buildCurrent(r);
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: localDateString(), longest_count: 5 });
    await finishRound(r);
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    await playSentence(r);
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: localDateString(), longest_count: 5 });
  });

  it('a typed sentence counts the day on its own (a saved round that only has the typing left)', async () => {
    await learnWords([3]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(current(r)).toBe('The cat.');
    await buildCurrent(r);
    expect(stepText(r)).toBe(STEP(1, 1, TYPE));
    (getDb() as any).__setStreakForTest({ current_count: 4, last_date: YESTERDAY, longest_count: 4 });
    await typeCurrent(r);
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: localDateString(), longest_count: 5 });
  });
});

describe('listen-and-type step (beta sentenceListening, FB523/FB524)', () => {
  beforeEach(async () => {
    await getDb().setBetaFlag('sentenceListening', true);
    __resetBetaForTest();
    mockSpeak.mockClear();
  });
  const play = (r: R) => r.queryByTestId('sentence-listen-play');
  const LISTEN = 'Listen and type what you hear';

  it('each sentence starts with it: the SPANISH sentence is read aloud, the English prompt is hidden until the check, nothing is credited', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 15'); // 5 sentences x (listen, build, typing)
    expect(stepText(r)).toBe(STEP(1, 5, LISTEN));
    expect(play(r)).not.toBeNull();
    expect(onScreen(r)).toEqual([]); // the prompt is hidden
    expect(r.getByText('Listen, then type the sentence')).toBeTruthy();
    expect(mockSpeak).toHaveBeenCalledWith('El gato.', expect.any(String)); // the target sentence, when the step opens
    expect(mockSpeak).not.toHaveBeenCalledWith('The cat.', expect.any(String));
    typeIt(r, 'el gato');
    expect(r.getByText('The cat.')).toBeTruthy(); // shown after the check
    expect(r.getByText('Correct!')).toBeTruthy();
    next(r);
    await flush(24);
    expect(mockRecord).not.toHaveBeenCalled();
    expect(progress(r)).toBe('1 / 15');
    expect(stepText(r)).toBe(STEP(1, 5, BUILD));
    expect(play(r)).toBeNull();
    expect(current(r)).toBe('The cat.'); // the prompt is shown again on the build
    await buildCurrent(r);
    expect(stepText(r)).toBe(STEP(1, 5, TYPE));
    expect(play(r)).toBeNull();
    expect(r.getByPlaceholderText('Type the sentence')).toBeTruthy();
    expect(mockRecord).not.toHaveBeenCalled();
    await typeCurrent(r);
    expect(calls()).toEqual([['a1-w3', 'correct']]); // only the typing step credits
    expect(stepText(r)).toBe(STEP(2, 5, LISTEN));
  });

  it('the 🔊 button reads the Spanish sentence again', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    mockSpeak.mockClear();
    fireEvent.press(play(r)!);
    expect(mockSpeak).toHaveBeenCalledWith('El gato.', expect.any(String));
  });

  it('a wrong answer here is credited to nothing and the step comes back at the end of the round', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    typeIt(r, 'el perro');
    expect(r.getByText('The cat.')).toBeTruthy(); // the prompt shows after a wrong check too
    next(r);
    await flush(24);
    expect(mockRecord).not.toHaveBeenCalled();
    expect(progress(r)).toBe('0 / 15');
    expect(stepText(r)).toBe(STEP(1, 5, BUILD));
    const queue = (await loadSentenceRound(getDb()))!.queue;
    expect(queue[queue.length - 1]).toBe('a1-w3#listen');
  });

  it('switch off: no listen step, no 🔊 button', async () => {
    await getDb().setBetaFlag('sentenceListening', false);
    __resetBetaForTest();
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 10');
    expect(stepText(r)).toBe(STEP(1, 5, BUILD));
    expect(play(r)).toBeNull();
  });

  it('Spanish UI: the step label, the hint and the button label', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    setLanguage('es');
    const es = render(<SentencesScreen />);
    await flush();
    expect(stepText(es)).toBe('Frase 1 de 5 · Escucha y escribe lo que oyes');
    expect(es.getByLabelText('Reproducir la frase')).toBeTruthy();
    expect(es.getByText('Escucha y escribe la frase')).toBeTruthy();
  });
});

describe('the parts of a split sentence (FB524)', () => {
  // The mocked corpus has no split sentences (the parts are data of the real ids), so the round is saved with one: the screen
  // continues a saved round of the same day, direction and focus.
  const BOOK = {
    itemId: 'a1-w1',
    source: 'The book and the table.',
    target: 'El libro y la mesa.',
    wordCount: 5,
    wordIds: ['a1-w1', 'a1-w2'],
    due: false,
    dueIds: [],
    staleness: '',
    slots: [{ id: 'a1-w1', words: ['libro'] }, { id: 'a1-w2', words: ['mesa'] }],
    chunks: [{ source: 'the book', target: 'El libro' }, { source: 'and the table', target: 'y la mesa.' }],
  };
  const seedRound = () => saveSentenceRound(getDb(), startRound([BOOK], localDateString(), 'es', '', { listening: false }));
  const PART = (n: number) => `Build part ${n} of 2`;

  beforeEach(async () => {
    await learnWords([1, 2]);
    await seedRound();
  });

  it('part 1, part 2 (each built from its own tiles, the English part is the prompt), then the whole sentence built, then typed; only the typing credits', async () => {
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 4');
    expect(stepText(r)).toBe(STEP(1, 1, PART(1)));
    expect(r.getByText('the book')).toBeTruthy();
    expect(onScreen(r)).toEqual([]); // not the whole sentence
    build(r, ['el', 'libro']);
    check(r);
    next(r);
    await flush();
    expect(progress(r)).toBe('1 / 4');
    expect(stepText(r)).toBe(STEP(1, 1, PART(2)));
    expect(r.getByText('and the table')).toBeTruthy();
    build(r, ['y', 'la', 'mesa']);
    check(r);
    next(r);
    await flush();
    expect(stepText(r)).toBe(STEP(1, 1, BUILD));
    expect(current(r)).toBe('The book and the table.');
    await buildCurrent(r);
    expect(stepText(r)).toBe(STEP(1, 1, TYPE));
    expect(mockRecord).not.toHaveBeenCalled();
    await typeCurrent(r);
    expect(calls()).toEqual([['a1-w1', 'correct'], ['a1-w2', 'correct']]);
    expect(r.getByText('Round done: 1 sentence')).toBeTruthy();
  });

  it('a wrong part comes back at the end of the round', async () => {
    const r = render(<SentencesScreen />);
    await flush();
    build(r, ['el']);
    check(r);
    next(r);
    await flush();
    expect(progress(r)).toBe('0 / 4');
    expect(stepText(r)).toBe(STEP(1, 1, PART(2)));
    build(r, ['y', 'la', 'mesa']);
    check(r);
    next(r);
    await flush();
    await buildCurrent(r);
    await typeCurrent(r);
    expect(progress(r)).toBe('3 / 4');
    expect(stepText(r)).toBe(STEP(1, 1, PART(1)));
    build(r, ['el', 'libro']);
    check(r);
    next(r);
    await flush();
    expect(r.getByText('Round done: 1 sentence')).toBeTruthy();
  });

  it('the position inside the parts is saved: another mount continues on part 2', async () => {
    const first = render(<SentencesScreen />);
    await flush();
    build(first, ['el', 'libro']);
    check(first);
    next(first);
    await flush();
    first.unmount();
    const back = render(<SentencesScreen />);
    await flush();
    expect(progress(back)).toBe('1 / 4');
    expect(stepText(back)).toBe(STEP(1, 1, PART(2)));
    expect((await loadSentenceRound(getDb()))?.entries[0].chunks).toHaveLength(2);
  });

  it('Spanish UI: the part label', async () => {
    setLanguage('es');
    const es = render(<SentencesScreen />);
    await flush();
    expect(stepText(es)).toBe('Frase 1 de 1 · Construye la parte 1 de 2');
  });

  it('a part has no tap-a-word hints; the whole sentence has', async () => {
    await getDb().setBetaFlag('sentenceHint', true);
    __resetBetaForTest();
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.queryByTestId('sentence-hint-0')).toBeNull();
    build(r, ['el', 'libro']);
    check(r);
    next(r);
    await flush();
    build(r, ['y', 'la', 'mesa']);
    check(r);
    next(r);
    await flush();
    expect(stepText(r)).toBe(STEP(1, 1, BUILD));
    expect(r.getByTestId('sentence-hint-0')).toBeTruthy();
    await getDb().setBetaFlag('sentenceHint', false);
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

  it('the 3rd sentence is one from the list (a single step: label, English prompt, the faulty words as decoys); a right build = "Knew it" in the mistake deck, nothing for the corpus cards', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await seedBatch();
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 11'); // the 5 corpus sentences x 2 steps + the one mistake step
    expect(label(r)).toBeNull();
    expect(await playSentence(r)).toBe(ROUND[0]);
    expect(await playSentence(r)).toBe(ROUND[1]);
    const credited = mockRecord.mock.calls.length;
    expect(stepText(r)).toBe(STEP(3, 6, BUILD));
    expect(r.getByTestId('sentences-mistake-label').props.children).toBe('From your mistakes');
    expect(r.getByText(MISTAKE_EN)).toBeTruthy();
    for (const en of Object.keys(SENT)) expect(r.queryByText(en)).toBeNull(); // not a corpus sentence
    for (const w of [...TILES_S1, 'pero', 'tienes']) expect(r.getAllByText(w).length).toBeGreaterThan(0);
    await buildTiles(r, TILES_S1);
    expect(await savedCard(S1)).toEqual(sm2Review(sm2NewCard(S1), 'good', localDateString()));
    expect(await savedCard(S2)).toEqual(sm2NewCard(S2));
    expect(mockRecord).toHaveBeenCalledTimes(credited); // nothing for the corpus cards
    expect(label(r)).toBeNull();
    expect(progress(r)).toBe('5 / 11');
    expect(stepText(r)).toBe(STEP(4, 6, BUILD)); // no typing after it: the next sentence
    expect(current(r)).toBe(ROUND[2]);
  });

  it('a wrong mistake build is "Didn\'t know" and the step goes to the end of the round, where it can be built right', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await seedBatch();
    const r = render(<SentencesScreen />);
    await flush();
    await playSentence(r);
    await playSentence(r);
    await buildTiles(r, TILES_S1, false);
    const again = sm2Review(sm2NewCard(S1), 'again', localDateString());
    expect(await savedCard(S1)).toEqual(again);
    expect(progress(r)).toBe('4 / 11');
    expect(stepText(r)).toBe(STEP(4, 6, BUILD)); // the next sentence is next, the mistake step waits at the end
    expect(label(r)).toBeNull();
    for (let i = 2; i < 5; i++) expect(await playSentence(r)).toBe(ROUND[i]);
    expect(progress(r)).toBe('10 / 11');
    expect(label(r)).not.toBeNull();
    expect(r.getByText(MISTAKE_EN)).toBeTruthy();
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
    await buildTiles(r, TILES_S1);
    expect(await savedCard(S1)).toEqual(sm2Review(again, 'good', localDateString()));
    expect(r.getByText('Round done: 6 sentences')).toBeTruthy();
  });

  it('a round that was left continues on the same mistake step (saved with the round)', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await seedBatch();
    const first = render(<SentencesScreen />);
    await flush();
    await playSentence(first);
    await playSentence(first);
    first.unmount();
    // the list changes in between: the saved round still holds the sentence
    await seedBatch({ ...BATCH, sentences: [] });
    const again = render(<SentencesScreen />);
    await flush();
    expect(stepText(again)).toBe(STEP(3, 6, BUILD));
    expect(again.getByTestId('sentences-mistake-label')).toBeTruthy();
    expect(again.getByText(MISTAKE_EN)).toBeTruthy();
    expect(again.getAllByText('tienes').length).toBeGreaterThan(0);
    expect((await loadSentenceRound(getDb()))?.entries[2].mistake).toEqual({ wrong: 'Pero no tienes tomate.' });
    await buildTiles(again, TILES_S1);
    expect(await savedCard(S1)).toEqual(sm2Review(sm2NewCard(S1), 'good', localDateString()));
  });

  it('the switch turned off while the saved round still holds the sentence: it is built, but nothing goes to the mistake deck', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await seedBatch();
    const first = render(<SentencesScreen />);
    await flush();
    await playSentence(first);
    await playSentence(first);
    first.unmount();
    await getDb().setBetaFlag('sentenceMistakes', false);
    __resetBetaForTest();
    const again = render(<SentencesScreen />);
    await flush();
    expect(stepText(again)).toBe(STEP(3, 6, BUILD));
    await buildTiles(again, TILES_S1);
    expect(await savedCard(S1)).toEqual(sm2NewCard(S1));
    expect(stepText(again)).toBe(STEP(4, 6, BUILD));
  });

  it('a due sentence is chosen before one not seen yet', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await seedBatch();
    await getDb().upsertMistakeCard({ ...sm2NewCard(S2), state: 'learning', due: '2026-10-01', introducedAt: '2026-10-01', lastReview: '2026-10-01' });
    const r = render(<SentencesScreen />);
    await flush();
    await playSentence(r);
    await playSentence(r);
    expect(r.getByText("That's fine.")).toBeTruthy();
    expect(r.queryByText(MISTAKE_EN)).toBeNull();
    expect(r.getAllByText('es').length).toBeGreaterThan(0); // the faulty "Eso es bien."
  });

  it('no list loaded, a list with only a doubtful sentence, or the switch off: the round is today\'s, nothing touches the mistake deck', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const playRound = async () => {
      const r = render(<SentencesScreen />);
      await flush();
      expect(progress(r)).toBe('0 / 10');
      for (let i = 0; i < 5; i++) {
        expect(stepText(r)).toBe(STEP(i + 1, 5, BUILD));
        expect(label(r)).toBeNull();
        expect(await playSentence(r)).toBe(ROUND[i]);
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
    await playSentence(first);
    await playSentence(first);
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
    await playSentence(r); // the cat
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
    expect(await buildCurrent(r)).toBe('The book and the table.');
    expect(stepText(r)).toBe(STEP(1, 2, TYPE));
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
    tap(r, 1); // build step "The book and the table.": "book" -> libro (card 1)
    expect(inBubble(r).getByText('libro')).toBeTruthy();
    await flush(); // the round is saved in the background
    expect((await loadSentenceRound(getDb()))?.hinted).toEqual(['a1-w1']);
    r.unmount();
    const again = render(<SentencesScreen />); // the round continues
    await flush();
    expect((await loadSentenceRound(getDb()))?.hinted).toEqual(['a1-w1']);
    await buildCurrent(again);
    await typeCurrent(again);
    expect((await card(1))?.halfSteps ?? 0).toBe(0);
    expect((await card(2))?.halfSteps).toBe(1);
  });

  it('a word looked at and typed wrong is not a wrong typed answer either; the other due word still is', async () => {
    await learnWords([1, 2], [1, 2]); // both due
    const r = render(<SentencesScreen />);
    await flush();
    await buildCurrent(r);
    expect(current(r)).toBe('The book and the table.');
    tap(r, 1); // "book" -> libro (card 1)
    await typeCurrent(r, 'el gato');
    expect(calls()).toEqual([['a1-w2', 'wrongTyped']]);
  });

  it('the listen-and-type step has no hints (its prompt only shows after the check, still plain); the build after it has', async () => {
    await getDb().setBetaFlag('sentenceListening', true);
    __resetBetaForTest();
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.queryByTestId('sentence-listen-play')).not.toBeNull();
    expect(r.queryByTestId('sentence-hint-0')).toBeNull(); // no English text yet
    typeIt(r, 'el gato');
    expect(r.getByText('The cat.')).toBeTruthy();
    expect(r.queryByTestId('sentence-hint-0')).toBeNull(); // plain text after the check
    next(r);
    await flush();
    expect(r.getByTestId('sentence-hint-0')).toBeTruthy(); // the build step
    await getDb().setBetaFlag('sentenceListening', false);
  });

  it('switch off: the prompt is plain text, nothing is underlined', async () => {
    await getDb().setBetaFlag('sentenceHint', false);
    __resetBetaForTest();
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByText('The cat.')).toBeTruthy();
    expect(r.queryByTestId('sentence-hint-0')).toBeNull();
  });

  it('Spanish UI: the mark in the bubble', async () => {
    setLanguage('es');
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    tap(r, 1); // "cat" -> gato
    expect(r.getByText('pista usada')).toBeTruthy();
  });
});
