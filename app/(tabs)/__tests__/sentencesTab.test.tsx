// The Sentences tab (beta): queue from learned words; a round is 5 sentences, each on ONE rung of the ladder (lib/sentenceLadder.ts,
// FB569/FB570): rung 1 = the parts of a split sentence and the whole sentence built, rung 2 = heard and typed, rung 3 = typed from
// the English; after rung 3 the sentence is learned and never returns. Only the typing credits word by word (a right word gets
// its half even if the rest is wrong, a due word typed wrong is a wrong typed answer); a wrong step goes to the end of the round,
// the typing step is done either way (and passes nothing), a round that was left continues where it stopped (saved; an older
// saved round starts again), the `focus` route parameter puts the sentences with those words first, the level counter on top
// drops as words are credited, and the feedback button is on the screen. Mock pattern: pcicSentenceCard.test.tsx.

jest.mock('@/lib/speech', () => ({ ...require('@/test-utils/mocks').speechMock(), stop: jest.fn() }));
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
// The day a test lives on: the real one unless a test moves it (a screen left open over midnight).
jest.mock('@/lib/usageStats', () => {
  const actual = jest.requireActual('@/lib/usageStats');
  return { ...actual, localDateString: jest.fn(actual.localDateString) };
});
// FB587: a new round is picked by a seed (random order, recent last); these tests pin the queue's own order, so they run unseeded.
jest.mock('@/lib/sentencePick', () => ({ ...jest.requireActual('@/lib/sentencePick'), roundSeed: jest.fn(() => undefined) }));
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
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { roundSeed } from '@/lib/sentencePick';
import { loadRecentSentences } from '@/lib/sentenceRecent';
import { pairOf } from '@/lib/languagePair';
import { clearSentenceRound, currentStep, loadSentenceRound, saveSentenceRound, startRound } from '@/lib/sentenceRound';
import { LADDER_KEY, loadLadder, saveStage } from '@/lib/sentenceLadder';
import { addDays, sm2NewCard, sm2Review, type Sm2Card } from '@/lib/sm2';
import sample from '@/lib/mistakes/__fixtures__/sample.json';
import { validateMistakesPayload, type MistakesBatch } from '@/lib/mistakes/format';
import { ThemeProvider } from '@/lib/ThemeContext';
import { DEFAULT_DAILY_NEW_LIMIT, localDateString } from '@/lib/usageStats';
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

// The sentences of the mocked corpus: the prompt on screen, the tiles to build it, the text to type it, the target as written.
const SENT: Record<string, { tiles: string[]; typed: string; item: string; target: string }> = {
  'The cat.': { tiles: ['el', 'gato'], typed: 'el gato', item: 'a1-w3', target: 'El gato.' },
  'The book and the table.': { tiles: ['el', 'libro', 'y', 'la', 'mesa'], typed: 'el libro y la mesa', item: 'a1-w1', target: 'El libro y la mesa.' },
  'The table and the book.': { tiles: ['la', 'mesa', 'y', 'el', 'libro'], typed: 'la mesa y el libro', item: 'a1-w2', target: 'La mesa y el libro.' },
  'The dog and the table.': { tiles: ['el', 'perro', 'y', 'la', 'mesa'], typed: 'el perro y la mesa', item: 'a1-w4', target: 'El perro y la mesa.' },
  'The house and the cat.': { tiles: ['la', 'casa', 'y', 'el', 'gato'], typed: 'la casa y el gato', item: 'a1-w5', target: 'La casa y el gato.' },
  'A bread and a house.': { tiles: ['un', 'pan', 'y', 'una', 'casa'], typed: 'un pan y una casa', item: 'a1-w6', target: 'Un pan y una casa.' },
};
const BY_ITEM = Object.fromEntries(Object.values(SENT).map((s) => [s.item, s]));
// With all six words learned (all fresh, on rung 1) the round is five sentences, in queue order (the short one first, then the
// corpus order) with variety (not three starting with "el"): the dog sentence is the one left out. Each is one build step.
const ROUND = ['The cat.', 'The book and the table.', 'The table and the book.', 'The house and the cat.', 'A bread and a house.'];
const ROUND_IDS = ROUND.map((en) => SENT[en].item);
const STEP_IDS = ROUND_IDS.map((id) => `${id}#build`);
// The step label on screen: "Sentence 2 of 5 · Step 1 of 3 · Build the whole sentence" (a mistake sentence has no rung).
const STEP = (n: number, total: number, label: string) => `Sentence ${n} of ${total} · ${label}`;
const RUNG1 = 'Step 1 of 3 · Build the whole sentence';
const RUNG2 = 'Step 2 of 3 · Listen and type what you hear';
const RUNG3 = 'Step 3 of 3 · Type the whole sentence';
const MISTAKE_BUILD = 'Build the whole sentence';

// Puts the sentences of these words (default: all six) on a rung of the ladder (the rung they play next) or learned.
const ladderAt = async (stage: 2 | 3 | 'learned', nums = [1, 2, 3, 4, 5, 6]) => {
  for (const n of nums) await saveStage(getDb(), BY_ITEM[`a1-w${n}`].target.toLowerCase(), stage);
};
const stageOf = async (n: number) => (await loadLadder(getDb())).get(BY_ITEM[`a1-w${n}`].target.toLowerCase());

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
// Types the current sentence: right, or `text` instead, and moves on (the prompt is on screen: rung 3).
const typeCurrent = async (r: R, text?: string) => {
  const en = current(r);
  typeIt(r, text ?? SENT[en].typed);
  next(r);
  await flush(24);
  return en;
};
// Plays the step on screen whatever it is (read from the saved round): a build right, or the typing (also the listening) right.
const autoStep = async (r: R) => {
  const saved = (await loadSentenceRound(getDb()))!;
  const st = currentStep(saved)!;
  const sentence = BY_ITEM[st.itemId];
  if (st.kind === 'build') {
    build(r, sentence.tiles);
    check(r);
    next(r);
    await flush();
  } else {
    typeIt(r, sentence.typed);
    next(r);
    await flush(24);
  }
};
// Plays whatever is left of a round (no mistake sentence, no parts): all right.
const finishRound = async (r: R) => {
  for (let i = 0; i < 40 && !r.queryByTestId('sentences-round-done'); i++) await autoStep(r);
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
  await getDb().resetGameProgress(LADDER_KEY);
  // the sentences of the last rounds (FB587) are kept in the resume store: a test starts without them
  await getDb().resetGameProgress(RESUME_GAME_ID);
  // the XP of a right sentence is counted once per sentence per day: a test starts with no count
  await getDb().resetGameProgress('xp-items');
  // the new words of an empty tab (FB564) have their own describe at the end: the day's budget is the default here
  await getDb().setDailyNewLimit(DEFAULT_DAILY_NEW_LIMIT);
  __resetBetaForTest();
  await getDb().setBetaFlag('xpV2', false);
  // the tap-a-word hints (beta sentenceHint, on by default) have their own describe at the end
  await getDb().setBetaFlag('sentenceHint', false);
  // the sentences taking turns (beta sentenceMix, on by default, FB536) have their own describe at the end
  await getDb().setBetaFlag('sentenceMix', false);
  resetDailyXp();
  await getDb().addDailyXpTenths(localDateString(), -100000);
  mockRecord.mockClear();
  mockSpeak.mockClear();
  delete mockParams.focus;
});
afterEach(() => {
  setLanguage('en');
  (localDateString as jest.Mock).mockImplementation(jest.requireActual('@/lib/usageStats').localDateString);
  // @ts-expect-error test-only cleanup of a global set per test
  delete global.fetch;
});

describe('Sentences tab', () => {
  it('everything learned: the empty state (EN and ES); one header only (the navigator\'s), no second "Sentences" title', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await ladderAt('learned');
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByText('Nothing to practise right now. Learn more words to unlock new sentences')).toBeTruthy();
    expect(r.queryByText('Sentences')).toBeNull();
    r.unmount();
    setLanguage('es');
    const es = render(<SentencesScreen />);
    await flush();
    expect(es.getByText('Nada que practicar por ahora. Aprende más palabras para desbloquear frases nuevas')).toBeTruthy();
    expect(es.queryByText('Frases')).toBeNull();
  });

  it('FB587: with a seed the round is still 5 different sentences, and they are remembered as the last round', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    (roundSeed as jest.Mock).mockReturnValue(12345);
    try {
      const r = render(<SentencesScreen />);
      await flush();
      expect(progress(r)).toBe('0 / 5');
      const saved = (await loadSentenceRound(getDb()))!;
      expect(new Set(saved.entries.map((e) => e.target)).size).toBe(5);
      const recent = await loadRecentSentences(getDb(), pairOf('es'));
      expect([...recent].sort()).toEqual(saved.entries.map((e) => e.target.trim().toLowerCase()).sort());
    } finally {
      (roundSeed as jest.Mock).mockReturnValue(undefined);
    }
  });

  it('a round has no title either (the progress is the only text on the header row)', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.queryByText('Sentences')).toBeNull();
    expect(r.queryAllByRole('header')).toHaveLength(0);
  });

  it('only sentences of learned words: 3 words -> 3 sentences, each built (rung 1), in the queue order', async () => {
    await learnWords([1, 2, 3]); // the dog is not learned, so "The dog and the table." stays out
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 3'); // 3 sentences x one build
    expect(r.queryByText('The dog and the table.')).toBeNull();
    expect(stepText(r)).toBe(STEP(1, 3, RUNG1));
    expect(await buildCurrent(r)).toBe('The cat.');
    expect(stepText(r)).toBe(STEP(2, 3, RUNG1));
    expect(await buildCurrent(r)).toBe('The book and the table.');
    expect(await buildCurrent(r)).toBe('The table and the book.');
    expect(r.getByText('Round done: 3 sentences')).toBeTruthy();
    expect(r.queryByTestId('sentences-learned')).toBeNull(); // rung 1 learns nothing yet
  });

  it('Spanish UI: the step labels (the rung in front of the step) and the progress label', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    setLanguage('es');
    const r = render(<SentencesScreen />);
    await flush();
    expect(stepText(r)).toBe('Frase 1 de 5 · Paso 1 de 3 · Construye la frase entera');
    expect(r.getAllByLabelText('Pasos hechos: 0 de 5').length).toBeGreaterThan(0);
    r.unmount();
    // rung 2 and rung 3: the sentences are further up the ladder, the saved round of the first render is dropped
    await clearSentenceRound(getDb());
    await ladderAt(2);
    const listen = render(<SentencesScreen />);
    await flush();
    expect(stepText(listen)).toBe('Frase 1 de 5 · Paso 2 de 3 · Escucha y escribe lo que oyes');
    listen.unmount();
    await clearSentenceRound(getDb());
    await ladderAt(3);
    const typing = render(<SentencesScreen />);
    await flush();
    expect(stepText(typing)).toBe('Frase 1 de 5 · Paso 3 de 3 · Escribe la frase entera');
  });

  it('Hungarian and German UI: the rung label', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    setLanguage('hu');
    const hu = render(<SentencesScreen />);
    await flush();
    expect(stepText(hu)).toBe('Mondat: 1 / 5 · 1. lépés / 3 · Építsd fel az egész mondatot');
    hu.unmount();
    setLanguage('de');
    const de = render(<SentencesScreen />);
    await flush();
    expect(stepText(de)).toBe('Satz 1 von 5 · Schritt 1 von 3 · Baue den ganzen Satz');
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

  it('a build (rung 1) does not move it; the typing (rung 3) credits the due words and drops it', async () => {
    await learnWords([1, 2], [1, 2]); // book and table, both due
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByText('due 2')).toBeTruthy();
    await buildCurrent(r);
    await flush();
    expect(r.getByText('due 2')).toBeTruthy(); // a build credits nothing
    r.unmount();
    await clearSentenceRound(getDb());
    await ladderAt(3, [1, 2]);
    const typing = render(<SentencesScreen />);
    await flush();
    await typeCurrent(typing); // the first sentence has both words: both get their half
    await flush(24);
    expect(typing.getByText('due 0')).toBeTruthy();
    expect(typing.getByLabelText('Level A1: 6 words, 0 due')).toBeTruthy();
  });

  it('a word typed wrong stays due', async () => {
    await learnWords([1, 2], [1, 2]);
    await ladderAt(3, [1, 2]);
    const r = render(<SentencesScreen />);
    await flush();
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
    r.unmount();
    await clearSentenceRound(getDb());
    await ladderAt(3, [1, 2]);
    const typing = render(<SentencesScreen />);
    await flush();
    typeIt(typing, SENT[current(typing)].typed);
    expect(typing.getByText('Correct!')).toBeTruthy();
    expect(typing.UNSAFE_getByType(ResultBadge).props.align).toBe('center');
  });
});

describe('the steps of a round (FB524)', () => {
  it('5 fresh sentences: each built whole (rung 1), one after the other', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 5');
    const played: string[] = [];
    for (let i = 0; i < 5; i++) {
      expect(stepText(r)).toBe(STEP(i + 1, 5, RUNG1));
      expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
      played.push(await buildCurrent(r));
      expect(progress(r)).toBe(`${i + 1} / 5`);
    }
    expect(played).toEqual(ROUND);
    expect(r.getByText('Round done: 5 sentences')).toBeTruthy();
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
  });

  it('a build credits no half (its right sentence pays the table XP); the typing of the sentence on rung 3 does', async () => {
    await setBeta('xpV2', true);
    await learnWords([1, 2, 3, 4, 5, 6], [3]); // the cat is due (so its sentence comes first), a credited build would move the schedule
    const r = render(<SentencesScreen />);
    await flush();
    await buildCurrent(r);
    expect(mockRecord).not.toHaveBeenCalled();
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(10);
    expect((await card(3))?.halfSteps ?? 0).toBe(0);
    r.unmount();
    await clearSentenceRound(getDb());
    await ladderAt(3);
    const typing = render(<SentencesScreen />);
    await flush();
    await typeCurrent(typing);
    expect(calls()).toEqual([['a1-w3', 'correct']]);
    expect((await card(3))?.halfSteps).toBe(1);
  });

  it('a wrong build: no credit, the sentence does not climb, and the build goes to the end of the round', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(await buildCurrent(r, false)).toBe(ROUND[0]);
    expect(mockRecord).not.toHaveBeenCalled();
    expect(progress(r)).toBe('0 / 5');
    expect(await stageOf(3)).toBeUndefined(); // not passed
    expect(stepText(r)).toBe(STEP(2, 5, RUNG1)); // the next sentence is next, the cat build waits at the end
    // the other four sentences, then the cat build is back as the very last step
    for (let i = 1; i < 5; i++) expect(await buildCurrent(r)).toBe(ROUND[i]);
    expect(progress(r)).toBe('4 / 5');
    expect(stepText(r)).toBe(STEP(1, 5, RUNG1));
    expect(await stageOf(3)).toBeUndefined(); // still not passed: the cat is not right yet
    expect(await buildCurrent(r)).toBe(ROUND[0]);
    expect(r.getByText('Round done: 5 sentences')).toBeTruthy();
    expect(await stageOf(3)).toBe(2); // right in the end: rung 1 passed
  });

  it('after the round the sentences come on their next rung; the sentence that was not in the round is the only fresh one', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    await finishRound(r);
    for (const n of [3, 1, 2, 5, 6]) expect(await stageOf(n)).toBe(2);
    expect(await stageOf(4)).toBeUndefined();
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    // the five played sentences are on rung 2 and may come again; the dog sentence (never played) is the fresh one
    const entries = (await loadSentenceRound(getDb()))!.entries;
    expect(entries).toHaveLength(5);
    expect(entries.map((e) => e.itemId)).toContain('a1-w4');
    expect(entries.filter((e) => e.rung === 2)).toHaveLength(4);
    expect(entries.find((e) => e.itemId === 'a1-w4')?.rung).toBeUndefined();
  });
});

describe('the typing credits word by word (FB505/508, Kálmán 2026-10-12)', () => {
  // The book and the table learned (both sentences on rung 3, typed); the table due. A pool of two sentences:
  // "The book and the table." comes first.
  const twoWords = async (dueNums: number[] = [2]) => {
    await learnWords([1, 2], dueNums);
    await ladderAt(3, [1, 2]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(current(r)).toBe('The book and the table.');
    expect(stepText(r)).toBe(STEP(1, 2, RUNG3));
    return r;
  };

  it('the whole sentence right: every learned word gets its half; the sentence is learned', async () => {
    const r = await twoWords();
    await typeCurrent(r);
    expect(calls()).toEqual([['a1-w1', 'correct'], ['a1-w2', 'correct']]);
    expect((await card(1))?.halfSteps).toBe(1);
    expect((await card(2))?.halfSteps).toBe(1);
    expect(await stageOf(1)).toBe('learned');
    expect(await stageOf(2)).toBe(3); // the second sentence is not typed yet
  });

  it('a partly right sentence: the right word gets its half, the due word that is wrong counts as a wrong typed answer; the sentence stays on rung 3', async () => {
    const r = await twoWords();
    await typeCurrent(r, 'el libro y la silla');
    expect(calls()).toEqual([['a1-w1', 'correct'], ['a1-w2', 'wrongTyped']]);
    expect((await card(1))?.halfSteps).toBe(1);
    expect((await card(2))).toMatchObject({ wrongStreak: 1, halfSteps: 0 });
    expect(stepText(r)).toBe(STEP(2, 2, RUNG3)); // the round goes on with the next sentence
    expect(await stageOf(1)).toBe(3); // not learned
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

  it('"Knew it" on a sentence the check marked wrong credits every word, and learns the sentence', async () => {
    const r = await twoWords();
    typeIt(r, 'el libro y la silla');
    fireEvent.press(r.getByTestId('sentence-grade-good'));
    next(r);
    await flush(24);
    expect(calls()).toEqual([['a1-w1', 'correct'], ['a1-w2', 'correct']]);
    expect(await stageOf(1)).toBe('learned');
  });

  it('the typing step is done right or wrong: the sentence is not typed again (no second credit for words just shown)', async () => {
    const r = await twoWords();
    await typeCurrent(r, 'xx');
    expect(stepText(r)).toBe(STEP(2, 2, RUNG3));
    expect(calls()).toEqual([['a1-w2', 'wrongTyped']]);
    expect((await loadSentenceRound(getDb()))?.queue).not.toContain('a1-w1#type');
    await typeCurrent(r); // the second sentence
    expect(r.getByText('Round done: 2 sentences')).toBeTruthy();
    expect(r.getByTestId('sentences-learned').props.children).toBe('1 sentence learned'); // only the second one was typed right
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
    expect(await loadSentenceRound(getDb())).toBeNull();
    expect(calls().filter((c) => c[1] === 'wrongTyped')).toEqual([['a1-w2', 'wrongTyped']]);
  });

  it('a single learned sentence on rung 3: its typing, then the round is over', async () => {
    await learnWords([3]);
    await ladderAt(3, [3]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 1');
    expect(stepText(r)).toBe(STEP(1, 1, RUNG3));
    expect(await typeCurrent(r)).toBe('The cat.');
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
    expect(progress(focused)).toBe('0 / 5');
    expect(current(focused)).toBe('The dog and the table.');
    await buildCurrent(focused);
    focused.unmount();

    // the same focus again: the round continues
    const back = render(<SentencesScreen />);
    await flush();
    expect(progress(back)).toBe('1 / 5');
  });

  it('a learned sentence stays out whatever the focus says', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await ladderAt('learned', [4]); // the dog sentence is learned
    mockParams.focus = 'a1-w4';
    render(<SentencesScreen />);
    await flush();
    expect((await loadSentenceRound(getDb()))?.entries.map((e) => e.itemId)).not.toContain('a1-w4');
  });
});

describe('the progress bar counts the same steps as the number (a block per step while the round is short)', () => {
  it('classic bar: max = the steps of the round, now = the steps done', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByTestId('sentences-progress').props.accessibilityValue).toEqual({ min: 0, max: 5, now: 0 });
    await buildCurrent(r);
    expect(progress(r)).toBe('1 / 5');
    expect(r.getByTestId('sentences-progress').props.accessibilityValue).toEqual({ min: 0, max: 5, now: 1 });
  });

  it('brand (segmented) bar: one block per step, "x / 5" has exactly 5', async () => {
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

  it('brand bar, a long round (more than 12 steps): the usual 8 blocks, filled by the share done', async () => {
    await getDb().setGrammarPalette('brand');
    await learnWords([1, 2, 3, 4, 5, 6]);
    // 5 split sentences x (2 parts + the whole build) = 15 steps; the parts are data of the real ids, so the round is saved
    const split = (n: number) => ({
      itemId: `a1-w${n}`, source: 'The book and the table.', target: 'El libro y la mesa.', wordCount: 5, wordIds: [`a1-w${n}`], due: false, dueIds: [], staleness: '',
      slots: [{ id: `a1-w${n}`, words: ['libro'] }], chunks: [{ source: 'the book', target: 'El libro' }, { source: 'and the table', target: 'y la mesa.' }],
    });
    await saveSentenceRound(getDb(), startRound([1, 2, 3, 4, 5].map(split), localDateString(), 'es', ''));
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
  it('off (default): a typed word gets its half, the sentence pays the table XP', async () => {
    await learnWords([3]);
    await ladderAt(3, [3]);
    const r = render(<SentencesScreen />);
    await flush();
    await typeCurrent(r);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect([10, 20]).toContain(await getDb().getDailyXpTenths(localDateString()));
  });

  it('on: the sentence table pays, the per-word halves do not stack on top (the same sentence again adds nothing)', async () => {
    await setBeta('xpV2', true);
    await learnWords([3]);
    await ladderAt(3, [3]);
    const r = render(<SentencesScreen />);
    await flush();
    await typeCurrent(r);
    await flush();
    const first = await getDb().getDailyXpTenths(localDateString());
    expect([10, 20]).toContain(first); // 1 XP, or 2 for a hard sentence: never the table plus a word half
    r.unmount();

    await getDb().resetPcicCards();
    await getDb().upsertPcicCard({ ...learned(3), reps: 3 });
    await ladderAt(3, [3]);
    const again = render(<SentencesScreen />);
    await flush();
    await typeCurrent(again);
    await flush();
    expect(await getDb().getDailyXpTenths(localDateString())).toBe(first);
  });
});

describe('a round that was left continues', () => {
  it('half way: another mount (other tab / app restart) is on the same step with the same progress', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const first = render(<SentencesScreen />);
    await flush();
    await buildCurrent(first);
    await buildCurrent(first);
    first.unmount();

    const back = render(<SentencesScreen />);
    await flush();
    expect(progress(back)).toBe('2 / 5');
    expect(stepText(back)).toBe(STEP(3, 5, RUNG1));
    expect(current(back)).toBe(ROUND[2]);
    expect(await stageOf(3)).toBe(2); // the two built sentences are already on rung 2
    expect(await stageOf(1)).toBe(2);
    expect(await stageOf(2)).toBeUndefined();
    await finishRound(back);
    expect(back.getByText('Round done: 5 sentences')).toBeTruthy();
  });

  it('waiting for the typing: the credit of a typed sentence comes once, a remount does not repeat it', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await ladderAt(3);
    const first = render(<SentencesScreen />);
    await flush();
    expect(await typeCurrent(first)).toBe(ROUND[0]);
    first.unmount();

    const back = render(<SentencesScreen />);
    await flush();
    expect(stepText(back)).toBe(STEP(2, 5, RUNG3));
    expect(progress(back)).toBe('1 / 5');
    expect(current(back)).toBe(ROUND[1]);
    expect(calls()).toEqual([['a1-w3', 'correct']]); // the first sentence only, once
    expect(await typeCurrent(back)).toBe(ROUND[1]);
  });

  it('the position is saved on every step (a wrong build too), and the saved round is dropped at the end of the round', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    const db = getDb();
    expect(await loadSentenceRound(db)).toMatchObject({ v: 3, queue: STEP_IDS, done: [], phase: 'steps' });
    await buildCurrent(r, false);
    expect(await loadSentenceRound(db)).toMatchObject({ queue: [...STEP_IDS.slice(1), STEP_IDS[0]], done: [] });
    await buildCurrent(r);
    expect(await loadSentenceRound(db)).toMatchObject({ queue: [...STEP_IDS.slice(2), STEP_IDS[0]], done: [STEP_IDS[1]], passed: [ROUND_IDS[1]] });
    await finishRound(r);
    expect(await loadSentenceRound(db)).toBeNull();
  });

  it('a new day starts a new round, a saved round of another day is not continued', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const first = render(<SentencesScreen />);
    await flush();
    await buildCurrent(first);
    first.unmount();
    const saved = await loadSentenceRound(getDb());
    expect(saved).not.toBeNull();
    await saveSentenceRound(getDb(), { ...saved!, day: '2000-01-01' });
    await getDb().resetGameProgress(RESUME_GAME_ID); // FB587: the first round's sentences would go last in the new one

    const next = render(<SentencesScreen />);
    await flush();
    expect(progress(next)).toBe('0 / 5');
    expect(stepText(next)).toBe(STEP(1, 5, RUNG2)); // the cat was built: it is on rung 2 now
    expect((await loadSentenceRound(getDb()))?.day).toBe(localDateString());
  });

  it('a broken saved value does not stop the tab: a fresh round starts', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await getDb().setGameProgress('app-resume', 'sentences', 'saved', { day: localDateString(), phase: 'steps' });
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 5');
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
    expect(progress(r)).toBe('0 / 5');
    expect(current(r)).toBe(ROUND[0]);
    expect(await loadSentenceRound(getDb())).toMatchObject({ v: 3, queue: STEP_IDS });
  });

  it('a round saved in the format before the ladder (v2: every sentence build, then typing) starts again as a fresh round (v3)', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    const v3 = startRound([{ ...BY_ITEM_ENTRY(3) }], localDateString(), 'es', '');
    await getDb().setGameProgress('app-resume', 'sentences', 'saved', {
      ...v3,
      v: 2,
      steps: [{ id: 'a1-w3#build', itemId: 'a1-w3', kind: 'build' }, { id: 'a1-w3#type', itemId: 'a1-w3', kind: 'type' }],
      queue: ['a1-w3#build', 'a1-w3#type'],
    });
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 5'); // not the one saved sentence
    expect(await loadSentenceRound(getDb())).toMatchObject({ v: 3, queue: STEP_IDS });
  });
});

// A saved-round entry of a corpus sentence (the screen continues a saved round of the same day, direction and focus).
function BY_ITEM_ENTRY(n: number) {
  const s = BY_ITEM[`a1-w${n}`];
  return { itemId: s.item, source: 'x', target: s.target, wordCount: s.tiles.length, wordIds: [s.item], due: false, dueIds: [], staleness: '', slots: [{ id: s.item, words: [s.tiles[1]] }] };
}

describe('the feedback button', () => {
  it('is on the screen with a round, with an empty round and after the round, with the sentences screen id in the message', async () => {
    await getDb().setDailyNewLimit(0); // no new word either: the empty tab
    const empty = render(<SentencesScreen />);
    await flush();
    expect(empty.getByLabelText('Feedback')).toBeTruthy();
    empty.unmount();
    await getDb().setDailyNewLimit(DEFAULT_DAILY_NEW_LIMIT);

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
    expect(r.getByLabelText('Feedback')).toBeTruthy(); // the next step
    await finishRound(r);
    expect(r.getByText('Round done: 5 sentences')).toBeTruthy();
    expect(r.getByLabelText('Feedback')).toBeTruthy();
  });

  it('is on the screen when there is nothing to practise, with the sentences tab id', async () => {
    await getDb().setDailyNewLimit(0); // the other words are new: no new word either
    await learnWords([3]);
    await ladderAt('learned', [3]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as never);
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByTestId('sentences-empty')).toBeTruthy();
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
    await autoStep(r);
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: localDateString(), longest_count: 5 });
  });

  it('a typed sentence counts the day on its own (a sentence on rung 3)', async () => {
    await learnWords([3]);
    await ladderAt(3, [3]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(current(r)).toBe('The cat.');
    expect(stepText(r)).toBe(STEP(1, 1, RUNG3));
    expect(await getDb().getStreak()).toEqual({ current_count: 4, last_date: YESTERDAY, longest_count: 4 });
    await typeCurrent(r);
    expect(await getDb().getStreak()).toEqual({ current_count: 5, last_date: localDateString(), longest_count: 5 });
  });
});

describe('rung 2: listen and type (FB523/FB524, always on since FB570)', () => {
  const play = (r: R) => r.queryByTestId('sentence-listen-play');

  it('the SPANISH sentence is read aloud, the English prompt is hidden until the check, nothing is credited; a right answer passes the rung', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await ladderAt(2);
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 5'); // 5 sentences x one listen step
    expect(stepText(r)).toBe(STEP(1, 5, RUNG2));
    expect(play(r)).not.toBeNull();
    expect(onScreen(r)).toEqual([]); // the prompt is hidden
    expect(r.getByText('Listen, then type the sentence')).toBeTruthy();
    expect(mockSpeak).toHaveBeenCalledWith('El gato.', expect.any(String), { gender: expect.stringMatching(/^[fm]$/) }); // the target sentence, when the step opens
    expect(mockSpeak).not.toHaveBeenCalledWith('The cat.', expect.any(String), expect.anything());
    typeIt(r, 'el gato');
    expect(r.getByText('The cat.')).toBeTruthy(); // shown after the check
    expect(r.getByText('Correct!')).toBeTruthy();
    next(r);
    await flush(24);
    expect(mockRecord).not.toHaveBeenCalled(); // nothing is credited
    expect(progress(r)).toBe('1 / 5');
    expect(stepText(r)).toBe(STEP(2, 5, RUNG2));
    expect(await stageOf(3)).toBe(3); // rung 2 passed: the cat is on rung 3
  });

  it('the 🔊 button reads the Spanish sentence again', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await ladderAt(2);
    const r = render(<SentencesScreen />);
    await flush();
    mockSpeak.mockClear();
    fireEvent.press(play(r)!);
    expect(mockSpeak).toHaveBeenCalledWith('El gato.', expect.any(String), { gender: expect.stringMatching(/^[fm]$/) });
  });

  it('a wrong answer here is credited to nothing, the step comes back at the end of the round, the sentence stays on rung 2', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await ladderAt(2);
    const r = render(<SentencesScreen />);
    await flush();
    typeIt(r, 'el perro');
    expect(r.getByText('The cat.')).toBeTruthy(); // the prompt shows after a wrong check too
    next(r);
    await flush(24);
    expect(mockRecord).not.toHaveBeenCalled();
    expect(progress(r)).toBe('0 / 5');
    expect(stepText(r)).toBe(STEP(2, 5, RUNG2));
    const queue = (await loadSentenceRound(getDb()))!.queue;
    expect(queue[queue.length - 1]).toBe('a1-w3#listen');
    expect(await stageOf(3)).toBe(2);
  });

  it('Spanish UI: the step label, the hint and the button label', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await ladderAt(2);
    setLanguage('es');
    const es = render(<SentencesScreen />);
    await flush();
    expect(stepText(es)).toBe('Frase 1 de 5 · Paso 2 de 3 · Escucha y escribe lo que oyes');
    expect(es.getByLabelText('Reproducir la frase')).toBeTruthy();
    expect(es.getByText('Escucha y escribe la frase')).toBeTruthy();
  });
});

describe('the ladder (FB569 + FB570)', () => {
  it('a sentence climbs one rung per round (build, listen, type) and is learned after the third; it never comes back', async () => {
    await getDb().setDailyNewLimit(0); // the other words are new: no new word once the sentence is learned
    await learnWords([3]);
    const r = render(<SentencesScreen />);
    await flush();
    // round 1: rung 1
    expect(progress(r)).toBe('0 / 1');
    expect(stepText(r)).toBe(STEP(1, 1, RUNG1));
    await buildCurrent(r);
    expect(r.getByText('Round done: 1 sentence')).toBeTruthy();
    expect(r.queryByTestId('sentences-learned')).toBeNull();
    expect(await stageOf(3)).toBe(2);
    // round 2: rung 2
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    expect(stepText(r)).toBe(STEP(1, 1, RUNG2));
    typeIt(r, 'el gato');
    next(r);
    await flush(24);
    expect(r.getByText('Round done: 1 sentence')).toBeTruthy();
    expect(await stageOf(3)).toBe(3);
    expect(mockRecord).not.toHaveBeenCalled();
    // round 3: rung 3, the only one that credits
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    expect(stepText(r)).toBe(STEP(1, 1, RUNG3));
    await typeCurrent(r);
    expect(calls()).toEqual([['a1-w3', 'correct']]);
    expect(r.getByText('Round done: 1 sentence')).toBeTruthy();
    expect(r.getByTestId('sentences-learned').props.children).toBe('1 sentence learned');
    expect(await stageOf(3)).toBe('learned');
    // learned: the next round has nothing to practise (not "Round done: 0")
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    expect(r.getByTestId('sentences-empty')).toBeTruthy();
    expect(r.queryByTestId('sentences-round-done')).toBeNull();
    expect(r.queryByText(/Round done/)).toBeNull();
    // ...also after a restart of the tab
    r.unmount();
    const again = render(<SentencesScreen />);
    await flush();
    expect(again.getByTestId('sentences-empty')).toBeTruthy();
  });

  it('the place on the ladder survives a restart: another mount plays the next rung', async () => {
    await learnWords([3]);
    const first = render(<SentencesScreen />);
    await flush();
    await buildCurrent(first);
    first.unmount();
    const back = render(<SentencesScreen />);
    await flush();
    expect(stepText(back)).toBe(STEP(1, 1, RUNG2));
    expect(await stageOf(3)).toBe(2);
  });

  it('a wrong typing on rung 3 passes nothing: the sentence stays on rung 3, the "more" button does not replay it, a restart does', async () => {
    await getDb().setDailyNewLimit(0); // the other words are new: no new word instead of the sentence
    await learnWords([3]);
    await ladderAt(3, [3]);
    const r = render(<SentencesScreen />);
    await flush();
    await typeCurrent(r, 'xx');
    expect(r.getByText('Round done: 1 sentence')).toBeTruthy();
    expect(r.queryByTestId('sentences-learned')).toBeNull();
    expect(await stageOf(3)).toBe(3);
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    expect(r.getByTestId('sentences-empty')).toBeTruthy(); // not the same rung again in this session
    r.unmount();
    const again = render(<SentencesScreen />);
    await flush();
    expect(stepText(again)).toBe(STEP(1, 1, RUNG3));
  });

  it('a sentence that failed rung 3 is kept out of that day’s next rounds only: a new day (the screen stayed open) brings it back', async () => {
    await getDb().setDailyNewLimit(0); // the other words are new: no new word instead of the sentence
    await learnWords([3]);
    await ladderAt(3, [3]);
    const r = render(<SentencesScreen />);
    await flush();
    await typeCurrent(r, 'xx');
    expect(r.getByText('Round done: 1 sentence')).toBeTruthy();
    expect(await stageOf(3)).toBe(3);
    const realDay = jest.requireActual('@/lib/usageStats').localDateString as () => string;
    (localDateString as jest.Mock).mockImplementation(() => addDays(realDay(), 1));
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    expect(r.queryByTestId('sentences-empty')).toBeNull();
    expect(stepText(r)).toBe(STEP(1, 1, RUNG3));
  });

  it('a round has at most 2 sentences of one rung while others are available; the rest is filled up', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await ladderAt(3, [1, 2, 3]);
    await ladderAt(2, [4, 5]); // the bread sentence is fresh (rung 1)
    const r = render(<SentencesScreen />);
    await flush();
    const entries = (await loadSentenceRound(getDb()))!.entries;
    expect(entries.map((e) => e.rung ?? 1).sort()).toEqual([1, 2, 2, 3, 3]);
    expect(new Set(entries.map((e) => e.itemId)).size).toBe(5); // never the same sentence twice
    // the steps are the steps of each rung: 1 build, 2 listens, 2 typings
    expect((await loadSentenceRound(getDb()))!.steps.map((s) => s.kind).sort()).toEqual(['build', 'listen', 'listen', 'type', 'type']);
    expect(progress(r)).toBe('0 / 5');
  });

  it('a started sentence (rung 3) comes into the round before the fresh ones, even one that variety would leave out', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await ladderAt(3, [4]); // the dog sentence is the one the round leaves out when everything is fresh
    render(<SentencesScreen />);
    await flush();
    const entries = (await loadSentenceRound(getDb()))!.entries;
    expect(entries.find((e) => e.itemId === 'a1-w4')?.rung).toBe(3);
  });

  it('learned sentences never return, in any level or focus; with all of them learned the tab says there is nothing to practise', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await ladderAt('learned');
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByTestId('sentences-empty')).toBeTruthy();
    expect(r.getByText('Nothing to practise right now. Learn more words to unlock new sentences')).toBeTruthy();
    expect(r.queryByText(/Round done/)).toBeNull();
    expect(r.queryByTestId('sentences-more')).toBeNull();
    r.unmount();
    mockParams.focus = 'a1-w4,a1-w1';
    const focused = render(<SentencesScreen />);
    await flush();
    expect(focused.getByTestId('sentences-empty')).toBeTruthy();
  });

  it('Spanish UI: the empty line and the learned line', async () => {
    setLanguage('es');
    await learnWords([1, 2, 3, 4, 5, 6]);
    await ladderAt('learned');
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByText('Nada que practicar por ahora. Aprende más palabras para desbloquear frases nuevas')).toBeTruthy();
    r.unmount();
    await ladderAt(3, [3]);
    const done = render(<SentencesScreen />);
    await flush();
    typeIt2(done);
    await flush(24);
    expect(done.getByTestId('sentences-learned').props.children).toBe('1 frase aprendida');
  });
});

// Types the cat sentence on a Spanish-UI screen (the placeholder and the buttons are Spanish there).
function typeIt2(r: R) {
  fireEvent.changeText(r.getByPlaceholderText('Escribe la oración'), 'el gato');
  fireEvent.press(r.getByText('✓ Comprobar'));
  fireEvent.press(r.getByText(/^Siguiente/));
}

describe('speech on the Sentences tab (FB569: it said the sentence too often)', () => {
  const spoken = (text: string) => mockSpeak.mock.calls.some((c) => c[0] === text);
  const GENDER = { gender: expect.stringMatching(/^[fm]$/) };

  it('rung 1 (build): nothing is spoken when the step opens or after the check; a tile still sounds; the 🔊 speaks the prompt, after the check the sentence', async () => {
    await learnWords([3]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(mockSpeak).not.toHaveBeenCalled(); // not the prompt, not the sentence
    fireEvent.press(r.getAllByText('el')[0]);
    expect(mockSpeak).toHaveBeenCalledWith('el', expect.any(String), expect.anything()); // the tile's own word sound stays
    fireEvent.press(r.getAllByText('gato')[0]);
    mockSpeak.mockClear();
    fireEvent.press(r.getByTestId('sentence-speak'));
    expect(mockSpeak).toHaveBeenCalledWith('The cat.', expect.any(String), GENDER); // before the check: the English prompt, never the answer
    expect(spoken('El gato.')).toBe(false);
    mockSpeak.mockClear();
    check(r);
    expect(spoken('El gato.')).toBe(false); // no read-aloud by itself after the check
    fireEvent.press(r.getByTestId('sentence-speak'));
    expect(mockSpeak).toHaveBeenCalledWith('El gato.', expect.any(String), GENDER);
  });

  it('rung 2 (listen): the Spanish sentence is read by itself when the step opens; there is no second button that would show the answer', async () => {
    await learnWords([3]);
    await ladderAt(2, [3]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(mockSpeak).toHaveBeenCalledWith('El gato.', expect.any(String), GENDER);
    expect(r.queryByTestId('sentence-listen-play')).not.toBeNull();
    expect(r.queryByTestId('sentence-speak')).toBeNull();
  });

  it('rung 3 (type): nothing is spoken by itself, not when it opens and not after the check; the 🔊 speaks the prompt, after the check the sentence', async () => {
    await learnWords([3]);
    await ladderAt(3, [3]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(mockSpeak).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('sentence-speak'));
    expect(mockSpeak).toHaveBeenCalledWith('The cat.', expect.any(String), GENDER); // the prompt before the check, not the answer
    expect(spoken('El gato.')).toBe(false);
    mockSpeak.mockClear();
    typeIt(r, 'el gato');
    expect(mockSpeak).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('sentence-speak'));
    expect(mockSpeak).toHaveBeenCalledWith('El gato.', expect.any(String), GENDER);
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
  const seedRound = () => saveSentenceRound(getDb(), startRound([BOOK], localDateString(), 'es', ''));
  const PART = (n: number) => `Step 1 of 3 · Build the short sentence ${n} of 2`;

  beforeEach(async () => {
    await learnWords([1, 2]);
    await seedRound();
  });

  it('part 1, part 2 (each built from its own tiles, the English part is the prompt), then the whole sentence built: that is rung 1, nothing is credited', async () => {
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 3');
    expect(stepText(r)).toBe(STEP(1, 1, PART(1)));
    expect(r.getByText('the book')).toBeTruthy();
    expect(onScreen(r)).toEqual([]); // not the whole sentence
    build(r, ['el', 'libro']);
    check(r);
    next(r);
    await flush();
    expect(progress(r)).toBe('1 / 3');
    expect(stepText(r)).toBe(STEP(1, 1, PART(2)));
    expect(r.getByText('and the table')).toBeTruthy();
    build(r, ['y', 'la', 'mesa']);
    check(r);
    next(r);
    await flush();
    expect(stepText(r)).toBe(STEP(1, 1, RUNG1));
    expect(current(r)).toBe('The book and the table.');
    expect(await stageOf(1)).toBeUndefined(); // the whole sentence is still to build
    await buildCurrent(r);
    expect(mockRecord).not.toHaveBeenCalled();
    expect(r.getByText('Round done: 1 sentence')).toBeTruthy();
    expect(r.queryByPlaceholderText('Type the sentence')).toBeNull();
    expect(await stageOf(1)).toBe(2); // rung 1 passed
  });

  it('a wrong part comes back at the end of the round', async () => {
    const r = render(<SentencesScreen />);
    await flush();
    build(r, ['el']);
    check(r);
    next(r);
    await flush();
    expect(progress(r)).toBe('0 / 3');
    expect(stepText(r)).toBe(STEP(1, 1, PART(2)));
    build(r, ['y', 'la', 'mesa']);
    check(r);
    next(r);
    await flush();
    await buildCurrent(r);
    expect(progress(r)).toBe('2 / 3');
    expect(await stageOf(1)).toBeUndefined(); // part 1 is still to do
    expect(stepText(r)).toBe(STEP(1, 1, PART(1)));
    build(r, ['el', 'libro']);
    check(r);
    next(r);
    await flush();
    expect(r.getByText('Round done: 1 sentence')).toBeTruthy();
    expect(await stageOf(1)).toBe(2);
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
    expect(progress(back)).toBe('1 / 3');
    expect(stepText(back)).toBe(STEP(1, 1, PART(2)));
    expect((await loadSentenceRound(getDb()))?.entries[0].chunks).toHaveLength(2);
  });

  it('Spanish UI: the part label', async () => {
    setLanguage('es');
    const es = render(<SentencesScreen />);
    await flush();
    expect(stepText(es)).toBe('Frase 1 de 1 · Paso 1 de 3 · Construye la frase corta 1 de 2');
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
    expect(stepText(r)).toBe(STEP(1, 1, RUNG1));
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

  it('the 3rd sentence is one from the list (a single step, outside the ladder: label, English prompt, the faulty words as decoys); a right build = "Knew it" in the mistake deck, nothing for the corpus cards', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await seedBatch();
    const r = render(<SentencesScreen />);
    await flush();
    expect(progress(r)).toBe('0 / 6'); // the 5 corpus sentences x one build + the one mistake step
    expect(label(r)).toBeNull();
    expect(await buildCurrent(r)).toBe(ROUND[0]);
    expect(await buildCurrent(r)).toBe(ROUND[1]);
    const credited = mockRecord.mock.calls.length;
    expect(stepText(r)).toBe(STEP(3, 6, MISTAKE_BUILD)); // no rung on a mistake sentence
    expect(r.getByTestId('sentences-mistake-label').props.children).toBe('From your mistakes');
    expect(r.getByText(MISTAKE_EN)).toBeTruthy();
    for (const en of Object.keys(SENT)) expect(r.queryByText(en)).toBeNull(); // not a corpus sentence
    for (const w of [...TILES_S1, 'pero', 'tienes']) expect(r.getAllByText(w).length).toBeGreaterThan(0);
    await buildTiles(r, TILES_S1);
    expect(await savedCard(S1)).toEqual(sm2Review(sm2NewCard(S1), 'good', localDateString()));
    expect(await savedCard(S2)).toEqual(sm2NewCard(S2));
    expect(mockRecord).toHaveBeenCalledTimes(credited); // nothing for the corpus cards
    expect(label(r)).toBeNull();
    expect(progress(r)).toBe('3 / 6');
    expect(stepText(r)).toBe(STEP(4, 6, RUNG1)); // the next sentence
    expect(current(r)).toBe(ROUND[2]);
    expect((await loadLadder(getDb())).has('no tengo tomate.')).toBe(false); // the mistake sentence is not on the ladder
  });

  it('a wrong mistake build is "Didn\'t know" and the step goes to the end of the round, where it can be built right', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await seedBatch();
    const r = render(<SentencesScreen />);
    await flush();
    await buildCurrent(r);
    await buildCurrent(r);
    await buildTiles(r, TILES_S1, false);
    const again = sm2Review(sm2NewCard(S1), 'again', localDateString());
    expect(await savedCard(S1)).toEqual(again);
    expect(progress(r)).toBe('2 / 6');
    expect(stepText(r)).toBe(STEP(4, 6, RUNG1)); // the next sentence is next, the mistake step waits at the end
    expect(label(r)).toBeNull();
    for (let i = 2; i < 5; i++) expect(await buildCurrent(r)).toBe(ROUND[i]);
    expect(progress(r)).toBe('5 / 6');
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
    await buildCurrent(first);
    await buildCurrent(first);
    first.unmount();
    // the list changes in between: the saved round still holds the sentence
    await seedBatch({ ...BATCH, sentences: [] });
    const again = render(<SentencesScreen />);
    await flush();
    expect(stepText(again)).toBe(STEP(3, 6, MISTAKE_BUILD));
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
    await buildCurrent(first);
    await buildCurrent(first);
    first.unmount();
    await getDb().setBetaFlag('sentenceMistakes', false);
    __resetBetaForTest();
    const again = render(<SentencesScreen />);
    await flush();
    expect(stepText(again)).toBe(STEP(3, 6, MISTAKE_BUILD));
    await buildTiles(again, TILES_S1);
    expect(await savedCard(S1)).toEqual(sm2NewCard(S1));
    expect(stepText(again)).toBe(STEP(4, 6, RUNG1));
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
      expect(progress(r)).toBe('0 / 5');
      for (let i = 0; i < 5; i++) {
        expect(stepText(r)).toBe(STEP(i + 1, 5, RUNG1));
        expect(label(r)).toBeNull();
        expect(await buildCurrent(r)).toBe(ROUND[i]);
      }
      r.unmount();
      await clearSentenceRound(getDb());
      await getDb().resetGameProgress(LADDER_KEY); // the next round starts on rung 1 again
      await getDb().resetGameProgress(RESUME_GAME_ID); // FB587: and with the same sentences (they would go last)
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
    await buildCurrent(r); // the cat
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

  it('the typing step (rung 3) has the hints too; the word that was looked at earns no half, the other words do', async () => {
    await learnWords([1, 2]);
    await ladderAt(3, [1, 2]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(current(r)).toBe('The book and the table.');
    expect(stepText(r)).toBe(STEP(1, 2, RUNG3));
    tap(r, 1); // "book" -> libro (card 1)
    expect(inBubble(r).getByText('libro')).toBeTruthy();
    await typeCurrent(r);
    expect((await card(1))?.halfSteps ?? 0).toBe(0);
    expect((await card(2))?.halfSteps).toBe(1);
    expect(calls()).toEqual([['a1-w2', 'correct']]); // card 1 was looked at: no credit at all
  });

  it('a word looked at in a build step earns nothing at the typing of the same round; the hint is kept with the saved round', async () => {
    await learnWords([1, 2]);
    await ladderAt(3, [2]); // the table sentence is typed, the book sentence is built
    const r = render(<SentencesScreen />);
    await flush();
    expect(current(r)).toBe('The book and the table.');
    expect(stepText(r)).toBe(STEP(1, 2, RUNG1));
    tap(r, 1); // build step "The book and the table.": "book" -> libro (card 1)
    expect(inBubble(r).getByText('libro')).toBeTruthy();
    await flush(); // the round is saved in the background
    expect((await loadSentenceRound(getDb()))?.hinted).toEqual(['a1-w1']);
    r.unmount();
    const again = render(<SentencesScreen />); // the round continues
    await flush();
    expect((await loadSentenceRound(getDb()))?.hinted).toEqual(['a1-w1']);
    await buildCurrent(again);
    expect(current(again)).toBe('The table and the book.');
    await typeCurrent(again);
    expect((await card(1))?.halfSteps ?? 0).toBe(0); // the book was looked at in this round
    expect((await card(2))?.halfSteps).toBe(1);
  });

  it('a word looked at and typed wrong is not a wrong typed answer either; the other due word still is', async () => {
    await learnWords([1, 2], [1, 2]); // both due
    await ladderAt(3, [1, 2]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(current(r)).toBe('The book and the table.');
    tap(r, 1); // "book" -> libro (card 1)
    await typeCurrent(r, 'el gato');
    expect(calls()).toEqual([['a1-w2', 'wrongTyped']]);
  });

  it('the listen-and-type step has no hints (its prompt only shows after the check, still plain)', async () => {
    await learnWords([1, 2, 3, 4, 5, 6]);
    await ladderAt(2);
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.queryByTestId('sentence-listen-play')).not.toBeNull();
    expect(r.queryByTestId('sentence-hint-0')).toBeNull(); // no English text yet
    typeIt(r, 'el gato');
    expect(r.getByText('The cat.')).toBeTruthy();
    expect(r.queryByTestId('sentence-hint-0')).toBeNull(); // plain text after the check
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

// FB536: "the same sentences come one after the other, shuffle them" (beta sentenceMix, lib/sentenceSteps.ts).
describe('Sentences tab: the sentences take turns (beta sentenceMix)', () => {
  it('a round of 5 on the ladder: every sentence plays its rung, never the same sentence twice in a row', async () => {
    await getDb().setBetaFlag('sentenceMix', true);
    __resetBetaForTest();
    await learnWords([1, 2, 3, 4, 5, 6]);
    const r = render(<SentencesScreen />);
    await flush();
    const seen: string[] = [];
    for (let i = 0; i < 40 && !r.queryByTestId('sentences-round-done'); i++) {
      seen.push(`build ${await buildCurrent(r)}`);
    }
    expect(seen).toEqual(ROUND.map((en) => `build ${en}`));
    expect(r.getByText('Round done: 5 sentences')).toBeTruthy();
  });

  it('a wrong build still goes to the end of the round', async () => {
    await getDb().setBetaFlag('sentenceMix', true);
    __resetBetaForTest();
    await learnWords([1, 2, 3]);
    const r = render(<SentencesScreen />);
    await flush();
    expect(await buildCurrent(r, false)).toBe('The cat.');
    expect(current(r)).toBe('The book and the table.');
    await finishRound(r);
  });
});
