import { PCIC_LEVELS, findPcicItem, pcicItemsForLevel, setPcicTarget, type PcicItem } from '@/data/pcic';
import type { Sm2Card } from '@/lib/sm2';
import {
  PRACTICE_SESSION_SIZE,
  buildGapQueue,
  checkGap,
  gapByLemma,
  gapByWord,
  gapTaskFor,
  openGapInfo,
  type GapSourceInfo,
  type GapTask,
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

const card = (itemId: string, state: Sm2Card['state'], due: string): Sm2Card => ({
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
const findItem = (id: string) => Object.values(ITEMS).find((i) => i.id === id);
const deps = (over: Partial<Parameters<typeof buildGapQueue>[1]> = {}) => ({
  target: 'es' as const,
  findItem,
  today: TODAY,
  seed: 1,
  info,
  ...over,
});

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

describe('buildGapQueue', () => {
  const ids = (q: GapTask[]) => q.map((t) => t.itemId);

  it('due words first (longest overdue first), then earlier words that are not due', () => {
    const cards = [
      card('o1', 'review', '2026-10-20'), // not due
      card('o2', 'review', '2026-10-12'), // due today
      card('o3', 'learning', '2026-10-09'), // due, 3 days overdue
      card('o5', 'review', '2026-11-01'), // not due
    ];
    const q = ids(buildGapQueue(cards, deps()));
    expect(q.slice(0, 2)).toEqual(['o3', 'o2']);
    expect(q.slice(2).sort()).toEqual(['o1', 'o5']);
  });

  it('a new word, a word without a sentence and an unknown id are left out', () => {
    const cards = [
      card('o1', 'new', ''),
      card('o2', 'review', '2026-10-12'),
      card('o4', 'review', '2026-10-12'), // no sentence
      card('o99', 'review', '2026-10-12'), // not in the corpus
    ];
    expect(ids(buildGapQueue(cards, deps()))).toEqual(['o2']);
  });

  it('the inflected form of the word stands in the task', () => {
    const q = buildGapQueue([card('o6', 'review', TODAY)], deps());
    expect(q[0]).toMatchObject({ before: 'Es una casa ', answer: 'nueva', after: '.' });
  });

  it('is capped at the round size, due words kept; the order of the rest follows the seed', () => {
    const many: Record<string, PcicItem> = {};
    const manyInfo: Record<string, GapSourceInfo> = {};
    const cards: Sm2Card[] = [];
    for (let n = 0; n < 30; n++) {
      many[`w${n}`] = item(`w${n}`, 'ir', 'to go', 'Voy ya.', 'I go now.');
      manyInfo[`w${n}`] = { lemma: 'ir', sentenceLemmas: ['ir', 'ya'] };
      cards.push(card(`w${n}`, 'review', n < 3 ? '2026-10-01' : '2026-12-01'));
    }
    const run = (seed: number) =>
      ids(buildGapQueue(cards, { target: 'es', findItem: (id) => many[id], today: TODAY, seed, info: (id) => manyInfo[id] }));
    const a = run(7);
    expect(a).toHaveLength(PRACTICE_SESSION_SIZE);
    expect(a.slice(0, 3).sort()).toEqual(['w0', 'w1', 'w2']);
    expect(run(7)).toEqual(a);
    expect(run(8)).not.toEqual(a);
  });

  it('nothing learned yet: empty', () => {
    expect(buildGapQueue([], deps())).toEqual([]);
    expect(buildGapQueue([card('o1', 'new', '')], deps())).toEqual([]);
  });
});

describe('checkGap', () => {
  const task: GapTask = { itemId: 'o9', before: 'Ella ', after: ' en casa.', answer: 'está', translation: 'She is at home.', meaning: 'to be' };

  it('accent off: the missing accent is forgiven; accent on: it is the answer', () => {
    expect(checkGap('esta', task, false)).toBe(true);
    expect(checkGap('esta', task, true)).toBe(false);
    expect(checkGap('está', task, true)).toBe(true);
  });

  it('case is forgiven, a wrong word is wrong', () => {
    expect(checkGap('ESTÁ', task, true)).toBe(true);
    expect(checkGap('estoy', task, false)).toBe(false);
    expect(checkGap('', task, false)).toBe(false);
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
