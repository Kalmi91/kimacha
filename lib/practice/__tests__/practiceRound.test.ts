import type { PcicItem } from '@/data/pcic';
import type { ReadingQuestion, ReadingSet, ReadingWord } from '../reading';
import { resolveSet } from '../reading';
import { newPracticeRound, parsePracticeRound, restorePracticeRound, type PracticeRound } from '../practiceRound';

const TODAY = '2026-10-12';

const item = (id: string, meaning: string): PcicItem => ({
  id, es: id, en: meaning, kind: 'word', section: '', order: 0, exampleEs: `Frase ${id}.`, exampleEn: `Sentence ${id}.`,
});
const ITEMS = ['a', 'b', 'c', 'd'].map((id) => item(id, `meaning ${id}`));
const findItem = (id: string) => ITEMS.find((i) => i.id === id);

const word = (itemId: string): ReadingWord => ({
  itemId, before: '', after: '.', answer: `Frase ${itemId}`, translation: `Sentence ${itemId}.`, meaning: `meaning ${itemId}`, sentence: `Frase ${itemId}.`,
});
const wordFor = (id: string) => (id === 'gone' ? null : word(id));

const QS: ReadingQuestion[] = [
  { kind: 'meaning', itemId: 'a', options: ['b', 'a', 'c'] },
  { kind: 'truefalse', sourceId: 'd' },
  { kind: 'truefalse', sourceId: 'c' },
];
const set = (): ReadingSet => resolveSet(['a', 'b', 'c'].map(word), QS, findItem, 'es')!;

const round = (over: Partial<PracticeRound> = {}): PracticeRound => ({
  v: 2,
  date: TODAY,
  target: 'es',
  ids: ['a', 'b', 'c'],
  qs: QS,
  step: 2,
  picks: [1, null, null],
  ...over,
});

describe('newPracticeRound', () => {
  it('the words and the questions as card ids, at the text (step 0), nothing answered', () => {
    expect(newPracticeRound(set(), 'es', TODAY)).toEqual({ v: 2, date: TODAY, target: 'es', ids: ['a', 'b', 'c'], qs: QS, step: 0, picks: [null, null, null] });
  });
});

describe('parsePracticeRound', () => {
  it('reads back what JSON.stringify wrote, at every step', () => {
    for (const step of [0, 1, 2, 3, 4]) {
      expect(parsePracticeRound(JSON.stringify(round({ step })))).toEqual(round({ step }));
    }
  });

  it('a missing or empty value, broken JSON or another shape gives null', () => {
    expect(parsePracticeRound(null)).toBeNull();
    expect(parsePracticeRound('')).toBeNull();
    expect(parsePracticeRound('{broken')).toBeNull();
    expect(parsePracticeRound('[]')).toBeNull();
    expect(parsePracticeRound(JSON.stringify({ ...round(), v: 3 }))).toBeNull();
    expect(parsePracticeRound(JSON.stringify({ ...round(), target: 'fr' }))).toBeNull();
    expect(parsePracticeRound(JSON.stringify({ ...round(), ids: [] }))).toBeNull();
    expect(parsePracticeRound(JSON.stringify({ ...round(), ids: ['a', 3] }))).toBeNull();
  });

  it('the old missing-word format (v1: index + results) gives null, so a new round starts', () => {
    const v1 = { v: 1, date: TODAY, target: 'es', ids: ['a', 'b'], index: 1, results: ['right', null] };
    expect(parsePracticeRound(JSON.stringify(v1))).toBeNull();
  });

  it('a step out of range, a picks list of the wrong length or a pick that is not an option gives null', () => {
    expect(parsePracticeRound(JSON.stringify(round({ step: 5 })))).toBeNull();
    expect(parsePracticeRound(JSON.stringify(round({ step: -1 })))).toBeNull();
    expect(parsePracticeRound(JSON.stringify(round({ picks: [null, null] })))).toBeNull();
    expect(parsePracticeRound(JSON.stringify(round({ picks: [3, null, null] })))).toBeNull(); // 3 options: 0..2
    expect(parsePracticeRound(JSON.stringify(round({ picks: [null, 2, null] })))).toBeNull(); // true/false: 0..1
    expect(parsePracticeRound(JSON.stringify(round({ picks: ['x', null, null] as never })))).toBeNull();
  });

  it('a malformed question gives null', () => {
    const bad = (q: unknown) => parsePracticeRound(JSON.stringify({ ...round(), qs: [q, QS[1], QS[2]] }));
    expect(bad({ kind: 'meaning', itemId: 'a', options: ['b', 'c'] })).toBeNull(); // the right one is not among the options
    expect(bad({ kind: 'meaning', itemId: 'a', options: ['a'] })).toBeNull();
    expect(bad({ kind: 'truefalse' })).toBeNull();
    expect(bad({ kind: 'other' })).toBeNull();
    expect(bad(null)).toBeNull();
  });
});

describe('restorePracticeRound', () => {
  it('the same day and direction: the words, the questions, the step and the picks as saved', () => {
    const resumed = restorePracticeRound(round(), TODAY, 'es', wordFor, findItem)!;
    expect(resumed.set.words.map((w) => w.itemId)).toEqual(['a', 'b', 'c']);
    expect(resumed.set.questions).toEqual(QS);
    expect(resumed.set.resolved[0]).toMatchObject({ kind: 'meaning', options: ['meaning b', 'meaning a', 'meaning c'], correct: 1 });
    expect(resumed.set.resolved[1]).toMatchObject({ kind: 'truefalse', statement: 'Sentence d.', truth: false, correct: 1 });
    expect(resumed.set.resolved[2]).toMatchObject({ kind: 'truefalse', statement: 'Sentence c.', truth: true, correct: 0 });
    expect(resumed.step).toBe(2);
    expect(resumed.picks).toEqual([1, null, null]);
  });

  it('every step is kept: text, a question, the last question, the sentences step', () => {
    for (const step of [0, 1, 3, 4]) {
      expect(restorePracticeRound(round({ step }), TODAY, 'es', wordFor, findItem)!.step).toBe(step);
    }
  });

  it('nothing saved, another day or another direction: null (a new round)', () => {
    expect(restorePracticeRound(null, TODAY, 'es', wordFor, findItem)).toBeNull();
    expect(restorePracticeRound(round({ date: '2026-10-11' }), TODAY, 'es', wordFor, findItem)).toBeNull();
    expect(restorePracticeRound(round({ target: 'en' }), TODAY, 'es', wordFor, findItem)).toBeNull();
  });

  it('a saved word that has no sentence any more, or a question card that is gone: null', () => {
    expect(restorePracticeRound(round({ ids: ['a', 'gone', 'c'] }), TODAY, 'es', wordFor, findItem)).toBeNull();
    expect(restorePracticeRound(round({ qs: [{ kind: 'truefalse', sourceId: 'zzz' }, QS[1], QS[2]] }), TODAY, 'es', wordFor, findItem)).toBeNull();
  });
});
