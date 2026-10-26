import { findPcicItem, type PcicItem } from '@/data/pcic';
import type { ReadingQuestion, ReadingSet, ReadingWord } from '../reading';
import { resolveSet } from '../reading';
import { STORIES, storyWords } from '../stories';
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

describe('story rounds (FB526)', () => {
  const story = STORIES[0];
  const sWords = storyWords(story, findPcicItem)!;
  const sIds = sWords.map((w) => w.itemId);
  const sQs: ReadingQuestion[] = [
    { kind: 'meaning', itemId: sIds[0], options: [sIds[1], sIds[0], sIds[2]] },
    { kind: 'storyfalse', index: 0 },
    { kind: 'truefalse', sourceId: sIds[3] },
  ];
  const sSet = (): ReadingSet => resolveSet(sWords, sQs, findPcicItem, 'es', story)!;
  const sRound = (over: Partial<PracticeRound> = {}): PracticeRound => ({ ...newPracticeRound(sSet(), 'es', TODAY), step: 2, picks: [1, null, null], ...over });
  // the words of a story come from the story, not from the corpus sentences
  const noWord = () => null;

  it('the saved round of a story has the story id, a round of sentences has none', () => {
    expect(newPracticeRound(sSet(), 'es', TODAY)).toEqual({ v: 2, date: TODAY, target: 'es', ids: sIds, qs: sQs, step: 0, picks: [null, null, null], story: story.id });
    expect('story' in newPracticeRound(set(), 'es', TODAY)).toBe(false);
  });

  it('parse reads back what JSON.stringify wrote: the story id and the story false statement', () => {
    expect(parsePracticeRound(JSON.stringify(sRound()))).toEqual(sRound());
    expect('story' in parsePracticeRound(JSON.stringify(round()))!).toBe(false);
  });

  it('a story id that is not a text, or a story false statement without a whole index, gives null', () => {
    expect(parsePracticeRound(JSON.stringify(sRound({ story: '' })))).toBeNull();
    expect(parsePracticeRound(JSON.stringify({ ...sRound(), story: 3 }))).toBeNull();
    const bad = (q: unknown) => parsePracticeRound(JSON.stringify({ ...sRound(), qs: [sQs[0], q, sQs[2]] }));
    expect(bad({ kind: 'storyfalse', index: -1 })).toBeNull();
    expect(bad({ kind: 'storyfalse', index: 1.5 })).toBeNull();
    expect(bad({ kind: 'storyfalse' })).toBeNull();
    expect(bad({ kind: 'storyfalse', index: 1 })).not.toBeNull();
  });

  it('restore: the story text, the questions, the step and the picks come back, also through JSON', () => {
    const saved = parsePracticeRound(JSON.stringify(sRound()))!;
    const resumed = restorePracticeRound(saved, TODAY, 'es', noWord, findPcicItem)!;
    expect(resumed.set.storyId).toBe(story.id);
    expect(resumed.set.words).toEqual(sWords);
    expect(resumed.set.questions).toEqual(sQs);
    expect(resumed.set.resolved[1]).toEqual({ kind: 'truefalse', statement: story.false_en![0], truth: false, correct: 1 });
    expect(resumed.set.resolved[2]).toEqual({ kind: 'truefalse', statement: sWords[3].translation, truth: true, correct: 0 });
    expect(resumed.step).toBe(2);
    expect(resumed.picks).toEqual([1, null, null]);
  });

  it('a story that is gone from the data, or saved ids that are not its cards: null (a new round)', () => {
    expect(restorePracticeRound(sRound({ story: 'gone' }), TODAY, 'es', noWord, findPcicItem)).toBeNull();
    expect(restorePracticeRound(sRound({ ids: [...sIds].reverse() }), TODAY, 'es', noWord, findPcicItem)).toBeNull();
    expect(restorePracticeRound(sRound({ ids: sIds.slice(0, 4) }), TODAY, 'es', noWord, findPcicItem)).toBeNull();
    // a story false statement of a round that has no story
    expect(restorePracticeRound(round({ qs: [QS[0], { kind: 'storyfalse', index: 0 }, QS[2]] }), TODAY, 'es', wordFor, findItem)).toBeNull();
    // the story does not resolve in another day or direction either
    expect(restorePracticeRound(sRound({ date: '2026-10-11' }), TODAY, 'es', noWord, findPcicItem)).toBeNull();
  });
});
