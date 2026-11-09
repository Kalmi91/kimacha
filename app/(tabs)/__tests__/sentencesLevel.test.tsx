// The level picker on top of the Sentences tab (FB556): "All" is an explicit choice (FB631: the default is the learner's level), a level serves only the
// sentences of that level's items, going back restores, the choice is kept per pair across a restart, a level with nothing
// to offer says so and leaves the picker on screen, and a pair with sentences at one level only has no picker.
// Mock pattern: sentencesTab.test.tsx.

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

// A test sets `mockCorpus.b2Off` to take the B2 sentences out (a pair with sentences at one level only).
const mockCorpus = { b2Off: false };
jest.mock('@/data/pcic', () => {
  const mk = (id: string, es: string, en: string, exampleEs: string, exampleEn: string) => ({
    id, es, en, kind: 'word' as const, section: 'Test', order: 0, exampleEs, exampleEn,
  });
  const A1 = [mk('a1-w1', 'el gato', 'the cat', 'El gato.', 'The cat.'), mk('a1-w2', 'el perro', 'the dog', 'El perro.', 'The dog.')];
  const B2 = [mk('b2-w1', 'la casa', 'the house', 'La casa.', 'The house.'), mk('b2-w2', 'el pan', 'the bread', 'El pan.', 'The bread.')];
  const all = [...A1, ...B2];
  return {
    PCIC_LEVELS: ['A1', 'B2'],
    PCIC_VIEW_LEVELS: ['A1', 'B2'],
    pcicItemsForLevel: (level: string) => (level === 'A1' ? A1 : mockCorpus.b2Off ? [] : B2),
    findPcicItem: (id: string) => all.find((i) => i.id === id),
    levelOfItem: (id: string) => (id.startsWith('b2') ? 'B2' : 'A1'),
    setPcicTarget: () => {},
  };
});

import { fireEvent, render } from '@testing-library/react-native';

import { __resetBetaForTest } from '@/lib/beta';
import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { LADDER_KEY, saveStage } from '@/lib/sentenceLadder';
import { loadSentenceLevel, saveSentenceLevel } from '@/lib/sentenceLevel';
import { saveResumeValue } from '@/lib/resumeStore';
import { clearSentenceRound, loadSentenceRound } from '@/lib/sentenceRound';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { makeFlush } from '@/test-utils/flush';
import SentencesScreen from '../sentences';

jest.setTimeout(30000);

const flush = makeFlush(14);

const learned = (id: string): Sm2Card => ({
  ...sm2NewCard(id), state: 'review', interval: 3, reps: 2, due: '2099-01-01', lastReview: '2026-10-09', introducedAt: '2026-10-09',
});
const learn = async (ids: string[]) => {
  for (const id of ids) await getDb().upsertPcicCard(learned(id));
};
const ALL_WORDS = ['a1-w1', 'a1-w2', 'b2-w1', 'b2-w2'];

// The items of the round that is saved (the screen saves it as soon as it is built).
const roundItems = async () => ((await loadSentenceRound(getDb()))?.entries ?? []).map((e) => e.itemId).sort();
const selected = (r: ReturnType<typeof render>, id: string) => r.getByTestId(`sentences-level-${id}`).props.accessibilityState.selected;
const screen = () => <SentencesScreen />;

beforeEach(async () => {
  mockCorpus.b2Off = false;
  await getDb().resetPcicCards();
  await getDb().setOnboarding('en', 'es');
  await getDb().setPcicLevel('A1');
  await getDb().setGrammarPalette('classic');
  await clearSentenceRound(getDb());
  __resetBetaForTest();
  for (const flag of ['xpV2', 'sentenceHint', 'sentenceMix'] as const) await getDb().setBetaFlag(flag, false);
  await getDb().resetGameProgress(LADDER_KEY);
  // back to the default after a test that picked a level
  await saveSentenceLevel(getDb(), 'en→es', 'all');
});
afterEach(() => {
  setLanguage('en');
});

describe('Sentences tab: level picker (FB556)', () => {
  it('shows All plus the levels that have sentences, All picked by default, and serves every level\'s sentences', async () => {
    await learn(ALL_WORDS);
    const r = render(screen());
    await flush();
    expect(r.getByTestId('sentences-levels')).toBeTruthy();
    expect(['all', 'A1', 'B2'].map((id) => selected(r, id))).toEqual([true, false, false]);
    expect(r.getByText('All')).toBeTruthy();
    expect(await roundItems()).toEqual(['a1-w1', 'a1-w2', 'b2-w1', 'b2-w2']);
    expect(String(r.getByTestId('sentences-progress-text').props.children)).toBe('0 / 4');
    // the feedback button stays on the screen
    expect(r.getByLabelText('Feedback')).toBeTruthy();
  });

  it('FB631: with nothing chosen the tab opens on the learner level and serves only its sentences', async () => {
    await learn(ALL_WORDS);
    await saveResumeValue(getDb(), 'sentences-level:en→es', null);
    await getDb().setPcicLevel('B2');
    const r = render(screen());
    await flush();
    expect(['all', 'A1', 'B2'].map((id) => selected(r, id))).toEqual([false, false, true]);
    expect(await roundItems()).toEqual(['b2-w1', 'b2-w2']);
  });

  it('B2 serves only the B2 sentences, All brings every level back', async () => {
    await learn(ALL_WORDS);
    const r = render(screen());
    await flush();

    fireEvent.press(r.getByTestId('sentences-level-B2'));
    await flush();
    expect(selected(r, 'B2')).toBe(true);
    expect(selected(r, 'all')).toBe(false);
    expect(await roundItems()).toEqual(['b2-w1', 'b2-w2']);
    expect(String(r.getByTestId('sentences-progress-text').props.children)).toBe('0 / 2');
    expect(r.queryByText('The cat.')).toBeNull();
    expect(r.queryByText('The dog.')).toBeNull();

    fireEvent.press(r.getByTestId('sentences-level-A1'));
    await flush();
    expect(await roundItems()).toEqual(['a1-w1', 'a1-w2']);

    fireEvent.press(r.getByTestId('sentences-level-all'));
    await flush();
    expect(selected(r, 'all')).toBe(true);
    expect(await roundItems()).toEqual(['a1-w1', 'a1-w2', 'b2-w1', 'b2-w2']);
  });

  it('the choice is kept per pair and survives a restart of the tab', async () => {
    await learn(ALL_WORDS);
    const first = render(screen());
    await flush();
    fireEvent.press(first.getByTestId('sentences-level-B2'));
    await flush();
    expect(await loadSentenceLevel(getDb(), 'en→es')).toBe('B2');
    expect(await loadSentenceLevel(getDb(), 'es→en')).toBeNull();
    first.unmount();

    const again = render(screen());
    await flush();
    expect(selected(again, 'B2')).toBe(true);
    expect(await roundItems()).toEqual(['b2-w1', 'b2-w2']);

    // back to All: the saved value is gone, a restart opens on All again
    fireEvent.press(again.getByTestId('sentences-level-all'));
    await flush();
    expect(await loadSentenceLevel(getDb(), 'en→es')).toBe('all');
    again.unmount();
    const last = render(screen());
    await flush();
    expect(selected(last, 'all')).toBe(true);
  });

  it('a level with nothing to offer for the words known says so and keeps the picker on screen', async () => {
    // every B2 word is known and its sentence learned: nothing to practise and no new word at that level either (FB564)
    await learn(ALL_WORDS);
    await saveStage(getDb(), 'la casa.', 'learned');
    await saveStage(getDb(), 'el pan.', 'learned');
    const r = render(screen());
    await flush();
    expect(r.queryByTestId('sentences-empty')).toBeNull();

    fireEvent.press(r.getByTestId('sentences-level-B2'));
    await flush();
    expect(r.getByTestId('sentences-empty')).toBeTruthy();
    expect(r.getByText('Nothing to practise at this level right now. Pick another level')).toBeTruthy();
    expect(selected(r, 'B2')).toBe(true);
    expect(r.getByLabelText('Feedback')).toBeTruthy();

    fireEvent.press(r.getByTestId('sentences-level-all'));
    await flush();
    expect(r.queryByTestId('sentences-empty')).toBeNull();
    expect(await roundItems()).toEqual(['a1-w1', 'a1-w2']);
  });

  it('a level with words not learned yet brings them as new words instead of an empty screen (FB564)', async () => {
    await learn(['a1-w1', 'a1-w2']);
    const r = render(screen());
    await flush();
    fireEvent.press(r.getByTestId('sentences-level-B2'));
    await flush();
    expect(r.queryByTestId('sentences-empty')).toBeNull();
        expect(r.getByTestId('new-word-word').props.children).toBe('la casa'); // the picked level's words, not the Learn tab's A1
    expect(selected(r, 'B2')).toBe(true);
  });

  it('no learned words at all and the day\'s new words used up: the budget line, with All picked (FB564)', async () => {
    await getDb().setDailyNewLimit(0);
    const r = render(screen());
    await flush();
    expect(r.getByTestId('sentences-empty')).toBeTruthy();
    expect(r.getByText(/today's new words are used up/)).toBeTruthy();
    expect(selected(r, 'all')).toBe(true);
    await getDb().setDailyNewLimit(20);
  });

  it('everything learned and every sentence learned: the old empty text with All picked', async () => {
    await learn(ALL_WORDS);
    for (const key of ['el gato.', 'el perro.', 'la casa.', 'el pan.']) await saveStage(getDb(), key, 'learned');
    const r = render(screen());
    await flush();
    expect(r.getByText('Nothing to practise right now. Learn more words to unlock new sentences')).toBeTruthy();
    expect(selected(r, 'all')).toBe(true);
  });

  it('a learned sentence never returns, in any level: a level whose sentences are all learned has nothing to practise, the others still serve theirs', async () => {
    await learn(ALL_WORDS);
    await saveStage(getDb(), 'la casa.', 'learned');
    await saveStage(getDb(), 'el pan.', 'learned');
    const r = render(screen());
    await flush();
    expect(await roundItems()).toEqual(['a1-w1', 'a1-w2']); // All: the B2 sentences are learned
    fireEvent.press(r.getByTestId('sentences-level-B2'));
    await flush();
    expect(r.getByTestId('sentences-empty')).toBeTruthy();
    expect(r.getByText('Nothing to practise at this level right now. Pick another level')).toBeTruthy();
    expect(r.queryByText(/Round done/)).toBeNull();
    fireEvent.press(r.getByTestId('sentences-level-A1'));
    await flush();
    expect(await roundItems()).toEqual(['a1-w1', 'a1-w2']);
  });

  it('the rung a sentence is on follows it across the levels: a B2 sentence on rung 3 is typed under B2 and under All', async () => {
    await learn(ALL_WORDS);
    await saveStage(getDb(), 'la casa.', 3);
    const r = render(screen());
    await flush();
    expect(((await loadSentenceRound(getDb()))?.entries ?? []).find((e) => e.itemId === 'b2-w1')?.rung).toBe(3);
    fireEvent.press(r.getByTestId('sentences-level-B2'));
    await flush();
    expect(((await loadSentenceRound(getDb()))?.entries ?? []).find((e) => e.itemId === 'b2-w1')?.rung).toBe(3);
  });

  it('a saved level that no longer has sentences opens on All', async () => {
    await learn(ALL_WORDS);
      await saveSentenceLevel(getDb(), 'en→es', 'B2');
    mockCorpus.b2Off = true;
    const r = render(screen());
    await flush();
    // only A1 has sentences: nothing to pick between, no picker
    expect(r.queryByTestId('sentences-levels')).toBeNull();
    expect(await roundItems()).toEqual(['a1-w1', 'a1-w2']);
  });

  it('Spanish UI: the labels of the picker', async () => {
    await learn(ALL_WORDS);
    setLanguage('es');
    const r = render(screen());
    await flush();
    expect(r.getByText('Todos')).toBeTruthy();
    expect(r.getByLabelText('Nivel de las frases')).toBeTruthy();
    expect(r.getByLabelText('Todos los niveles')).toBeTruthy();
    expect(r.getByLabelText('Nivel B2')).toBeTruthy();
  });
});
