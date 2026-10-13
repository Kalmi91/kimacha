import { PCIC_LEVELS, findPcicItem, pcicItemsForLevel, setPcicTarget, type PcicItem } from '@/data/pcic';
import type { Sm2Card } from '@/lib/sm2';
import {
  gapByLemma,
  gapByWord,
  gapTaskFor,
  openGapInfo,
  practiceCandidates,
  type GapSourceInfo,
} from '../gapFill';

const TODAY = '2026-10-12';

const item = (id: string, es: string, en: string, exampleEs?: string, exampleEn?: string): PcicItem => ({
  id,
  es,
  en,
  kind: 'word',
  section: '',
  order: 0,
  exampleEs,
  exampleEn,
});

const card = (itemId: string, state: Sm2Card['state'], due: string, over: Partial<Sm2Card> = {}): Sm2Card => ({
  itemId,
  state,
  step: 0,
  ease: 2.5,
  interval: state === 'review' ? 4 : 0,
  reps: state === 'new' ? 0 : 1,
  lapses: 0,
  due,
  lastReview: null,
  introducedAt: null,
  ...over,
});

// id -> item, and the lemma data that words-open carries (one lemma per word of the sentence).
const ITEMS: Record<string, PcicItem> = {
  ir: item('o1', 'ir', 'to go', 'Voy con ella.', 'I go with her.'),
  ser: item('o2', 'ser', 'to be', 'Hola, soy yo.', 'Hello, it is me.'),
  casa: item('o3', 'la casa', 'house', 'Mi casa es grande.', 'My house is big.'),
  tener: item('o4', 'tener', 'to have', '', ''),
  comer: item('o5', 'comer', 'to eat', 'Como pan.', 'I eat bread.'),
  nueva: item('o6', 'nuevo', 'new', 'Es una casa nueva.', 'It is a new house.'),
};
const INFO: Record<string, GapSourceInfo> = {
  o1: { lemma: 'ir', sentenceLemmas: ['ir', 'con', 'ella'] },
  o2: { lemma: 'ser', sentenceLemmas: ['hola', 'ser', 'yo'] },
  o3: { lemma: 'casa', sentenceLemmas: ['mi', 'casa', 'ser', 'grande'] },
  o5: { lemma: 'comer', sentenceLemmas: ['comer', 'pan'] },
  o6: { lemma: 'nuevo', sentenceLemmas: ['ser', 'uno', 'casa', 'nuevo'] },
};
const info = (id: string) => INFO[id];
describe('gapByLemma', () => {
  it('blanks the inflected form that stands in the sentence', () => {
    expect(gapByLemma('Voy con ella.', INFO.o1)).toEqual({ before: '', answer: 'Voy', after: ' con ella.' });
    expect(gapByLemma('Hola, soy yo.', INFO.o2)).toEqual({ before: 'Hola, ', answer: 'soy', after: ' yo.' });
    expect(gapByLemma('Es una casa nueva.', INFO.o6)).toEqual({ before: 'Es una casa ', answer: 'nueva', after: '.' });
  });

  it('null when the lemma list does not line up with the sentence or lacks the lemma', () => {
    expect(gapByLemma('Voy con ella.', { lemma: 'ir', sentenceLemmas: ['ir', 'con'] })).toBeNull();
    expect(gapByLemma('Voy con ella.', { lemma: 'comer', sentenceLemmas: ['ir', 'con', 'ella'] })).toBeNull();
  });
});

describe('gapByWord (no lemma data)', () => {
  it('finds the headword itself, any case, and not a longer word', () => {
    expect(gapByWord('Go home now.', 'go')).toEqual({ before: '', answer: 'Go', after: ' home now.' });
    expect(gapByWord('He goes home.', 'go')).toBeNull();
    expect(gapByWord('Nothing.', '')).toBeNull();
  });
});

describe('gapTaskFor', () => {
  it('builds the task: blank, translation under it, the word meaning as the tip', () => {
    expect(gapTaskFor(ITEMS.ir, 'es', info)).toEqual({
      itemId: 'o1',
      before: '',
      after: ' con ella.',
      answer: 'Voy',
      translation: 'I go with her.',
      meaning: 'to go',
    });
  });

  it('a word with no sentence, or no lemma data, is left out', () => {
    expect(gapTaskFor(ITEMS.tener, 'es', info)).toBeNull();
    expect(gapTaskFor(ITEMS.ir, 'es', () => undefined)).toBeNull();
  });

  it('English target: the sentence is English, the tip is the Spanish word, "to " is dropped from the headword', () => {
    const go = item('e1', 'ir', 'to go', 'Vamos a casa.', 'We go home.');
    expect(gapTaskFor(go, 'en', info)).toEqual({
      itemId: 'e1',
      before: 'We ',
      after: ' home.',
      answer: 'go',
      translation: 'Vamos a casa.',
      meaning: 'ir',
    });
    expect(gapTaskFor(item('e2', 'ir', 'to go', 'Ella va a casa.', 'She goes home.'), 'en', info)).toBeNull();
  });
});

describe('practiceCandidates', () => {
  const ids = (cards: Sm2Card[]) => cards.map((c) => c.itemId);

  it('due words first (longest overdue first), then the freshly learned ones (newest first)', () => {
    const cards = [
      card('o1', 'review', '2026-10-20', { introducedAt: '2026-10-08' }), // not due, learned 4 days ago
      card('o2', 'review', '2026-10-12', { introducedAt: '2026-09-01' }), // due today
      card('o3', 'learning', '2026-10-09', { introducedAt: '2026-09-01' }), // due, 3 days overdue
      card('o5', 'review', '2026-11-01', { introducedAt: '2026-10-11' }), // not due, learned yesterday
    ];
    expect(ids(practiceCandidates(cards, TODAY))).toEqual(['o3', 'o2', 'o5', 'o1']);
  });

  it('the word source is due + the last 7 days: 3 days ago is in, 7 days ago is in, 8 days ago and no date are out', () => {
    const cards = [
      card('o1', 'review', '2026-10-20', { introducedAt: '2026-10-09' }), // 3 days ago
      card('o2', 'review', '2026-10-20', { introducedAt: '2026-10-05' }), // 7 days ago
      card('o3', 'review', '2026-10-20', { introducedAt: '2026-10-04' }), // 8 days ago
      card('o5', 'review', '2026-10-20', { introducedAt: null }),
    ];
    expect(ids(practiceCandidates(cards, TODAY))).toEqual(['o1', 'o2']);
  });

  it('an old word that is due still comes, however long ago it was learned', () => {
    expect(ids(practiceCandidates([card('o3', 'review', '2026-10-11', { introducedAt: '2026-01-01' })], TODAY))).toEqual(['o3']);
  });

  it('a word marked known by hand is left out, whether it is due or was just marked', () => {
    const cards = [
      card('o1', 'review', '2026-10-01', { known: true, introducedAt: '2026-09-01' }), // due, known by hand
      card('o2', 'review', '2026-12-11', { known: true, introducedAt: '2026-10-11' }), // marked yesterday
      card('o3', 'review', '2026-10-20', { introducedAt: '2026-10-11' }), // really learned
    ];
    expect(ids(practiceCandidates(cards, TODAY))).toEqual(['o3']);
  });

  it('a new word is left out; nothing learned yet: empty', () => {
    expect(practiceCandidates([card('o1', 'new', '')], TODAY)).toEqual([]);
    expect(practiceCandidates([], TODAY)).toEqual([]);
  });
});

describe('the real words-open data', () => {
  beforeAll(() => setPcicTarget('es'));

  it('knows the lemma data of a card; the inflected form is the answer', () => {
    expect(openGapInfo('o33')).toMatchObject({ lemma: 'ir' });
    const task = gapTaskFor(findPcicItem('o33')!, 'es');
    expect(task).toMatchObject({ before: '', answer: 'Voy', after: ' con ella.', meaning: 'to go' });
  });

  it('almost every word with an example sentence yields a task (the lemma lists line up with the sentences)', () => {
    let withSentence = 0;
    let withTask = 0;
    for (const level of PCIC_LEVELS) {
      for (const it of pcicItemsForLevel(level)) {
        if (!it.exampleEs || !it.exampleEn) continue;
        withSentence++;
        if (gapTaskFor(it, 'es')) withTask++;
      }
    }
    expect(withSentence).toBeGreaterThan(4000);
    expect(withTask / withSentence).toBeGreaterThan(0.99);
  });
});
