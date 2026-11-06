// New words on the Sentences tab (FB564, Kálmán 2026-11-03): with nothing to practise the tab brings a word card (the word,
// its meaning, read aloud once by itself, a Next button) and then the word's own sentence on rung 1 when every other word of it
// is known; a beginner gets the card alone. At most 3 words per round, from the Learn tab's daily budget (a word introduced here
// is not new there and counts there); with the budget used up the empty line says so; leaving and coming back keeps the word.
// Every pair (es, en, hu, de). Mock pattern: sentencesLevel.test.tsx.

jest.mock('@/lib/speech', () => ({ ...require('@/test-utils/mocks').speechMock(), stop: jest.fn() }));
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));

// A corpus with the words in all four languages. 1: a sentence made of the word alone. 2: its sentence needs word 1.
// 3: its sentence has words nobody knows (a beginner gets the card alone). 4, 6, 7: no sentence. 5: a sentence-kind item.
jest.mock('@/data/pcic', () => {
  const mk = (n: number, w: string[], ex: string[] | null, kind: 'word' | 'sentence' = 'word') => ({
    id: `a1-n${n}`, es: w[0], en: w[1], hu: w[2], de: w[3], kind, section: 'Test', order: n,
    ...(ex ? { exampleEs: ex[0], exampleEn: ex[1], exampleHu: ex[2], exampleDe: ex[3] } : {}),
  });
  const ITEMS = [
    mk(1, ['libro', 'book', 'könyv', 'Buch'], ['Libro.', 'Book.', 'Könyv.', 'Buch.']),
    mk(2, ['mesa', 'table', 'asztal', 'Tisch'], ['Libro y mesa.', 'Book and table.', 'Könyv és asztal.', 'Buch und Tisch.']),
    mk(3, ['gato', 'cat', 'macska', 'Katze'], ['El perro come.', 'The dog eats.', 'A kutya eszik.', 'Der Hund isst.']),
    mk(4, ['casa', 'house', 'ház', 'Haus'], null),
    mk(5, ['Hola.', 'Hello.', 'Szia.', 'Hallo.'], ['Hola.', 'Hello.', 'Szia.', 'Hallo.'], 'sentence'),
    mk(6, ['pan', 'bread', 'kenyér', 'Brot'], null),
    mk(7, ['sol', 'sun', 'nap', 'Sonne'], null),
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

import { fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { LADDER_KEY, loadLadder, saveStage } from '@/lib/sentenceLadder';
import { introduceNewWord } from '@/lib/sentenceNewWord';
import { clearSentenceRound, loadSentenceRound, saveSentenceRound, startRound } from '@/lib/sentenceRound';
import type { SentenceEntry } from '@/lib/sentenceTab';
import { pickSm2Session, sm2NewCard, sm2Review } from '@/lib/sm2';
import { DEFAULT_DAILY_NEW_LIMIT, localDateString } from '@/lib/usageStats';
import { speak } from '@/lib/speech';
import { makeFlush } from '@/test-utils/flush';
import SentencesScreen from '../sentences';

jest.setTimeout(30000);

const flush = makeFlush(14);
const mockSpeak = speak as jest.Mock;

type R = ReturnType<typeof render>;
const stepText = (r: R) => String(r.getByTestId('sentences-step').props.children);
const word = (r: R) => r.getByTestId('new-word-word').props.children as string;
const meaning = (r: R) => r.getByTestId('new-word-meaning').props.children as string;
const nextWord = async (r: R) => {
  fireEvent.press(r.getByTestId('new-word-next'));
  await flush();
};
// The sentence step of a new word: build the tiles, Check, Next.
const buildIt = async (r: R, tiles: string[]) => {
  for (const t of tiles) fireEvent.press(r.getAllByText(t)[0]);
  fireEvent.press(r.getByText('Check'));
  fireEvent.press(r.getByText(/^Next/));
  await flush();
};
const cardOf = async (n: number) => getDb().getPcicCard(`a1-n${n}`);

beforeEach(async () => {
  await getDb().resetPcicCards();
  await getDb().setOnboarding('en', 'es');
  await getDb().setPcicLevel('A1');
  await getDb().setGrammarPalette('classic');
  await getDb().setDailyNewLimit(DEFAULT_DAILY_NEW_LIMIT);
  await getDb().setPcicNewBonus(0, localDateString());
  await clearSentenceRound(getDb());
  await getDb().resetGameProgress(LADDER_KEY);
  mockSpeak.mockClear();
});
afterEach(() => {
  setLanguage('en');
});

// [source, target, the word, its meaning, the sentence prompt, the tiles of the sentence]
const PAIRS: [string, string, string, string, string, string[]][] = [
  ['en', 'es', 'libro', 'book', 'Book.', ['libro']],
  ['es', 'en', 'book', 'libro', 'Libro.', ['book']],
  ['es', 'hu', 'könyv', 'libro', 'Libro.', ['könyv']],
  ['en', 'de', 'Buch', 'book', 'Book.', ['buch']],
];

describe.each(PAIRS)('an empty tab, pair %s to %s', (source, target, w, m, prompt, tiles) => {
  beforeEach(async () => {
    await getDb().setOnboarding(source as 'en', target as 'es');
  });

  it('opens on a word card (the word, its meaning, read aloud once by itself), then the word\'s own sentence on rung 1, then the next word', async () => {
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.queryByTestId('sentences-empty')).toBeNull();
    expect(stepText(r)).toBe('New word 1 of 3');
    expect(word(r)).toBe(w);
    expect(meaning(r)).toBe(m);
    expect(mockSpeak.mock.calls.filter((c) => c[0] === w)).toHaveLength(1); // by itself, once
    fireEvent.press(r.getByTestId('new-word-speak'));
    expect(mockSpeak.mock.calls.filter((c) => c[0] === w)).toHaveLength(2); // and again on the button
    expect(r.getByLabelText('Feedback')).toBeTruthy();

    await nextWord(r);
    expect((await cardOf(1))?.state).toBe('review'); // introduced
    expect((await cardOf(1))?.introducedAt).toBe(localDateString());
    expect(stepText(r)).toBe('New word 1 of 3 · Step 1 of 3 · Build the whole sentence');
    expect(r.getByText(prompt)).toBeTruthy();
    await buildIt(r, tiles);
    expect([...(await loadLadder(getDb()))]).toEqual([[`${w.toLowerCase()}.`, 2]]); // rung 1 passed: it plays rung 2 next
    expect(stepText(r)).toBe('New word 2 of 3');
  });
});

describe('the new-word round (es)', () => {
  it('3 words at most; a word with its sentence, the next one whose sentence uses the first, a beginner\'s card alone; then the end screen', async () => {
    const r = render(<SentencesScreen />);
    await flush();
    expect(word(r)).toBe('libro');
    await nextWord(r);
    await buildIt(r, ['libro']);
    expect(stepText(r)).toBe('New word 2 of 3');
    expect(word(r)).toBe('mesa');
    await nextWord(r);
    expect(stepText(r)).toBe('New word 2 of 3 · Step 1 of 3 · Build the whole sentence');
    await buildIt(r, ['libro', 'y', 'mesa']);
    expect(stepText(r)).toBe('New word 3 of 3');
    expect(word(r)).toBe('gato'); // its sentence has words nobody knows: the card alone, no sentence
    await nextWord(r);
    expect(r.queryByTestId('sentences-step')).toBeNull();
    expect(r.getByTestId('sentences-new-words').props.children).toBe('3 new words');
    expect(r.getByText('Round done: 2 sentences')).toBeTruthy();
    const saved = await getDb().getPcicCards();
    expect(saved.map((c) => c.itemId).sort()).toEqual(['a1-n1', 'a1-n2', 'a1-n3']);
    expect(saved.every((c) => c.state === 'review' && c.introducedAt === localDateString())).toBe(true);
    expect([...(await loadLadder(getDb())).keys()].sort()).toEqual(['libro y mesa.', 'libro.']); // no key for the word with no sentence
    // More: the next words, the three just learned are not new any more
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    // sentences made of the words known now come first (rung 2 of the two just played, and "el perro come" is still not known)
    expect(r.queryByTestId('new-word-word')).toBeNull();
    expect(stepText(r)).toMatch(/Step 2 of 3/);
  });

  it('the word cards alone: where no word has a sentence yet, the cards come one after the other and the round ends on them (no "Round done: 0")', async () => {
    // words 1 and 2 are known and their sentences learned: the next words (3, 4, 6) have no sentence made of known words
    for (const n of [1, 2]) await introduceNewWord(getDb(), `a1-n${n}`, '2026-10-09');
    await saveStage(getDb(), 'libro.', 'learned');
    await saveStage(getDb(), 'libro y mesa.', 'learned');
    await getDb().setPcicNewBonus(0, localDateString());
    const r = render(<SentencesScreen />);
    await flush();
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      seen.push(word(r));
      expect(stepText(r)).toBe(`New word ${i + 1} of 3`);
      await nextWord(r);
    }
    expect(seen).toEqual(['gato', 'casa', 'pan']);
    expect(r.getByTestId('sentences-new-words').props.children).toBe('3 new words');
    expect(r.queryByTestId('sentences-round-done')).toBeNull();
    expect((await loadLadder(getDb())).has('')).toBe(false);
    expect((await getDb().getPcicCards()).filter((c) => c.introducedAt === localDateString()).map((c) => c.itemId).sort()).toEqual(['a1-n3', 'a1-n4', 'a1-n6']);
    // More: the next word is the last one (sol); a sentence-kind item (Hola.) never comes as a card
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    expect(word(r)).toBe('sol');
    expect(stepText(r)).toBe('New word 1 of 1');
  });

  it('the Learn tab\'s budget: the word is not new there and it counts (limit 2: two words, then the line)', async () => {
    await getDb().setDailyNewLimit(2);
    const r = render(<SentencesScreen />);
    await flush();
    expect(stepText(r)).toBe('New word 1 of 2');
    await nextWord(r);
    await buildIt(r, ['libro']);
    await nextWord(r);
    await buildIt(r, ['libro', 'y', 'mesa']);
    expect(r.getByTestId('sentences-new-words').props.children).toBe('2 new words');
    // in the Learn tab's picking the two are not new and use the day's limit
    const cards = await getDb().getPcicCards();
    const inLearn = pickSm2Session(cards, ['a1-n1', 'a1-n2', 'a1-n3', 'a1-n4'], localDateString(), 3).filter((c) => c.state === 'new');
    expect(inLearn.map((c) => c.itemId)).toEqual(['a1-n3']);
    expect(cards.filter((c) => c.introducedAt === localDateString())).toHaveLength(2);
    // More: the budget is used up (and the sentences of the two words are on rung 2, which is not "nothing to practise")
    fireEvent.press(r.getByTestId('sentences-more'));
    await flush();
    expect(r.queryByTestId('new-word-word')).toBeNull();
  });

  it('with the budget used up and nothing to practise the empty line says so (EN, ES, HU, DE)', async () => {
    await getDb().setDailyNewLimit(0);
    const r = render(<SentencesScreen />);
    await flush();
    expect(r.getByTestId('sentences-empty')).toBeTruthy();
    expect(r.getByText('Nothing to practise right now, and today\'s new words are used up. Come back tomorrow, or raise "New words a day" in Settings')).toBeTruthy();
    expect(r.queryByTestId('new-word-word')).toBeNull();
    expect(r.getByLabelText('Feedback')).toBeTruthy();
    r.unmount();
    for (const [lang, text] of [
      ['es', 'Nada que practicar por ahora y las palabras nuevas de hoy se acabaron. Vuelve mañana o sube "Palabras nuevas al día" en Ajustes'],
      ['hu', 'Most nincs mit gyakorolni, és a mai új szavak elfogytak. Gyere vissza holnap, vagy emeld meg a „Napi új szavak” értékét a Beállításokban'],
      ['de', 'Gerade gibt es nichts zu üben, und die neuen Wörter für heute sind aufgebraucht. Komm morgen wieder oder erhöhe „Neue Wörter pro Tag“ in den Einstellungen'],
    ] as const) {
      setLanguage(lang);
      const again = render(<SentencesScreen />);
      await flush();
      expect(again.getByText(text)).toBeTruthy();
      again.unmount();
    }
  });

  it('the day\'s bonus (the Learn tab\'s "+N") opens the budget again', async () => {
    await getDb().setDailyNewLimit(0);
    await getDb().setPcicNewBonus(1, localDateString());
    const r = render(<SentencesScreen />);
    await flush();
    expect(stepText(r)).toBe('New word 1 of 1');
  });

  it('leaving and coming back keeps the word: the card is not shown again, the round continues on its sentence', async () => {
    const first = render(<SentencesScreen />);
    await flush();
    await nextWord(first);
    first.unmount();
    expect((await cardOf(1))?.state).toBe('review');
    const back = render(<SentencesScreen />);
    await flush();
    expect(back.queryByTestId('new-word-word')).toBeNull();
    expect(stepText(back)).toBe('New word 1 of 3 · Step 1 of 3 · Build the whole sentence');
    // a round left on the card itself continues on the card, the word is introduced only when Next is pressed
    await buildIt(back, ['libro']);
    back.unmount();
    const onCard = render(<SentencesScreen />);
    await flush();
    expect(word(onCard)).toBe('mesa');
    expect(await cardOf(2)).toBeNull();
    onCard.unmount();
    expect((await loadSentenceRound(getDb()))?.steps.map((s) => s.kind)).toContain('newword');
  });

  // The round is planned when it starts: the Learn tab (or a saved round resumed later) may have used the day's words since.
  it('the budget is rechecked when a word card is passed: with none left the word and the new words after it drop out, no stuck screen', async () => {
    await getDb().setDailyNewLimit(2);
    const r = render(<SentencesScreen />);
    await flush();
    expect(stepText(r)).toBe('New word 1 of 2');
    // the Learn tab introduced a word meanwhile: one of the two words of the day is gone
    await getDb().upsertPcicCard(sm2Review(sm2NewCard('a1-n6'), 'good', localDateString()));
    await nextWord(r); // word 1 still fits
    expect((await cardOf(1))?.state).toBe('review');
    await buildIt(r, ['libro']);
    expect(word(r)).toBe('mesa');
    await nextWord(r); // word 2 does not: nothing is written, the round ends here
    expect(await cardOf(2)).toBeNull();
    expect(r.queryByTestId('new-word-word')).toBeNull();
    expect(r.getByTestId('sentences-new-words').props.children).toBe('1 new word');
    expect(r.getByText('Round done: 1 sentence')).toBeTruthy();
    expect((await getDb().getPcicCards()).filter((c) => c.introducedAt === localDateString())).toHaveLength(2); // never over the limit
    expect(await loadSentenceRound(getDb())).toBeNull();
  });

  it('with the budget gone before the first card is passed the round is no round: the empty line says so, nothing is introduced', async () => {
    await getDb().setDailyNewLimit(1);
    const r = render(<SentencesScreen />);
    await flush();
    expect(stepText(r)).toBe('New word 1 of 1');
    await getDb().upsertPcicCard(sm2Review(sm2NewCard('a1-n6'), 'good', localDateString()));
    await nextWord(r);
    expect(await cardOf(1)).toBeNull();
    expect(r.getByTestId('sentences-empty')).toBeTruthy();
    expect(r.getByText(/today's new words are used up/)).toBeTruthy();
    expect(await loadSentenceRound(getDb())).toBeNull();
  });

  // A saved round of the same day whose new word is no longer in the corpus (an update in between): no blank card.
  describe('a saved round whose word left the corpus', () => {
    const cardEntry = (id: string): SentenceEntry => ({ itemId: id, source: '', target: '', wordCount: 0, wordIds: [], due: false, dueIds: [], staleness: '', slots: [], newWord: true });
    const saveRound = (ids: string[]) => saveSentenceRound(getDb(), startRound(ids.map(cardEntry), localDateString(), 'es', '', {}));

    it('the word is dropped with its steps and the round goes on with the next word card', async () => {
      await saveRound(['a1-gone', 'a1-n2']);
      const r = render(<SentencesScreen />);
      await flush();
      expect(word(r)).toBe('mesa');
      expect(stepText(r)).toBe('New word 1 of 1');
      expect(r.getByTestId('new-word-next')).toBeTruthy();
      expect((await loadSentenceRound(getDb()))?.entries.map((e) => e.itemId)).toEqual(['a1-n2']); // saved without the gone word
      expect(await getDb().getPcicCard('a1-gone')).toBeNull();
    });

    it('a round with nothing left is not resumed: a fresh round is built', async () => {
      await saveRound(['a1-gone']);
      const r = render(<SentencesScreen />);
      await flush();
      expect(word(r)).toBe('libro');
      expect(stepText(r)).toBe('New word 1 of 3');
      expect((await loadSentenceRound(getDb()))?.entries.map((e) => e.itemId)).toEqual(['a1-n1', 'a1-n2', 'a1-n3']);
    });
  });
});
