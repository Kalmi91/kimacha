// The Sentences tab round (FB524): every sentence runs through its steps, a wrong step goes to the end, the typing step is
// done either way, the saved round (v2) round-trips (with its focus) and an unusable one, or one saved by the older version
// (no steps), reads as nothing and so starts a fresh round.


import { getDb } from '@/lib/database';
import {
  addHinted,
  answerStep,
  clearSentenceRound,
  currentEntry,
  currentStep,
  isRoundFor,
  loadSentenceRound,
  parseSentenceRound,
  roundProgress,
  roundSentences,
  saveSentenceRound,
  sentenceNumber,
  startRound,
  type SentenceRound,
} from '../sentenceRound';
import type { SentenceEntry } from '../sentenceTab';

const DAY = '2026-10-12';

const entry = (id: string, chunks?: { source: string; target: string }[]): SentenceEntry => ({
  itemId: id,
  source: `src ${id}`,
  target: `tgt ${id}`,
  wordCount: 2,
  wordIds: [`w-${id}`],
  due: true,
  dueIds: [`w-${id}`],
  staleness: '2026-10-01',
  slots: [{ id: `w-${id}`, words: [id] }],
  ...(chunks ? { chunks } : {}),
});
const PARTS = [{ source: 'part one', target: 'parte uno' }, { source: 'part two', target: 'parte dos' }];
// a: split in two (chunk0, chunk1, build, type); b, c: not split (build, type)
const ENTRIES = [entry('a', PARTS), entry('b'), entry('c')];
const fresh = (entries = ENTRIES, focus = '', listening = false): SentenceRound => startRound(entries, DAY, 'es', focus, { listening });

const allRight = (start: SentenceRound): SentenceRound => {
  let round = start;
  while (round.phase === 'steps') round = answerStep(round, true);
  return round;
};

describe('the steps run sentence by sentence', () => {
  it('a fresh round: every step still to do, in order, the first one on screen', () => {
    const r = fresh();
    expect(r).toMatchObject({ v: 2, day: DAY, target: 'es', focus: '', done: [], phase: 'steps' });
    expect(r.queue).toEqual(['a#chunk0', 'a#chunk1', 'a#build', 'a#type', 'b#build', 'b#type', 'c#build', 'c#type']);
    expect(r.steps.map((s) => s.id)).toEqual(r.queue);
    expect(currentStep(r)).toEqual({ id: 'a#chunk0', itemId: 'a', kind: 'chunk', chunk: 0 });
    expect(currentEntry(r)?.itemId).toBe('a');
    expect(roundProgress(r)).toEqual({ done: 0, total: 8 });
  });

  it('with the listening switch each sentence has its listen step before the build', () => {
    expect(fresh(ENTRIES, '', true).queue).toEqual([
      'a#chunk0', 'a#chunk1', 'a#listen', 'a#build', 'a#type', 'b#listen', 'b#build', 'b#type', 'c#listen', 'c#build', 'c#type',
    ]);
  });

  it('right answers move on step by step; the last one ends the round', () => {
    let r = fresh();
    r = answerStep(r, true);
    expect(r.done).toEqual(['a#chunk0']);
    expect(currentStep(r)?.id).toBe('a#chunk1');
    expect(roundProgress(r)).toEqual({ done: 1, total: 8 });
    const end = allRight(r);
    expect(end.phase).toBe('done');
    expect(end.queue).toEqual([]);
    expect(end.done).toHaveLength(8);
    expect(currentStep(end)).toBeUndefined();
    expect(currentEntry(end)).toBeUndefined();
    expect(roundProgress(end)).toEqual({ done: 8, total: 8 });
  });

  it('nothing to play: the round is over at once', () => {
    const r = fresh([]);
    expect(r.phase).toBe('done');
    expect(roundProgress(r)).toEqual({ done: 0, total: 0 });
  });

  it('roundSentences: the sentences of the round', () => {
    expect(roundSentences(fresh()).map((e) => e.itemId)).toEqual(['a', 'b', 'c']);
  });

  it('the place of the sentence on screen: 1-based, moves with the steps, the last one when the round is over', () => {
    let r = fresh();
    expect(sentenceNumber(r)).toBe(1);
    for (let i = 0; i < 4; i++) r = answerStep(r, true); // the 4 steps of sentence a
    expect(currentEntry(r)?.itemId).toBe('b');
    expect(sentenceNumber(r)).toBe(2);
    expect(sentenceNumber(allRight(r))).toBe(3);
    expect(sentenceNumber(fresh([]))).toBe(1);
  });
});

describe('wrong steps', () => {
  it('a wrong step goes to the end of the queue, nothing is done, the sentence stays the same', () => {
    const r = answerStep(fresh(), false);
    expect(r.queue).toEqual(['a#chunk1', 'a#build', 'a#type', 'b#build', 'b#type', 'c#build', 'c#type', 'a#chunk0']);
    expect(r.done).toEqual([]);
    expect(sentenceNumber(r)).toBe(1);
    expect(roundProgress(r).done).toBe(0);
  });

  it('a step done wrong first counts once it is right, at the end of the round', () => {
    const round = allRight(answerStep(fresh(), false));
    expect(round.done).toEqual(['a#chunk1', 'a#build', 'a#type', 'b#build', 'b#type', 'c#build', 'c#type', 'a#chunk0']);
    expect(round.phase).toBe('done');
  });

  it('the typing step is done either way: a wrong typing is not repeated', () => {
    let r = fresh();
    for (let i = 0; i < 3; i++) r = answerStep(r, true);
    expect(currentStep(r)?.kind).toBe('type');
    const next = answerStep(r, false);
    expect(next.done).toEqual(['a#chunk0', 'a#chunk1', 'a#build', 'a#type']);
    expect(next.queue).not.toContain('a#type');
    expect(currentStep(next)?.id).toBe('b#build');
  });

  it('the listening step, like a build, comes back when wrong', () => {
    let r = fresh([entry('b')], '', true);
    expect(currentStep(r)?.kind).toBe('listen');
    r = answerStep(r, false);
    expect(r.queue).toEqual(['b#build', 'b#type', 'b#listen']);
  });

  it('an answer once the round is over changes nothing', () => {
    const end = allRight(fresh());
    expect(answerStep(end, true)).toBe(end);
    expect(answerStep(end, false)).toBe(end);
  });
});

describe('the saved round', () => {
  beforeEach(async () => {
    await clearSentenceRound(getDb());
  });

  it('save then load gives the same round, at the start and mid-way', async () => {
    const db = getDb();
    const start = fresh(ENTRIES, 'w-1,w-2', true);
    await saveSentenceRound(db, start);
    expect(await loadSentenceRound(db)).toEqual(start);
    const mid = answerStep(answerStep(fresh(), true), false);
    await saveSentenceRound(db, mid);
    expect(await loadSentenceRound(db)).toEqual(mid);
  });

  it('clear drops it; nothing saved reads as null', async () => {
    const db = getDb();
    expect(await loadSentenceRound(db)).toBeNull();
    await saveSentenceRound(db, fresh());
    await clearSentenceRound(db);
    expect(await loadSentenceRound(db)).toBeNull();
  });

  it('valid only for the same day, direction and focus', () => {
    const r = fresh(ENTRIES, 'w-1');
    expect(isRoundFor(r, DAY, 'es', 'w-1')).toBe(true);
    expect(isRoundFor(r, '2026-10-13', 'es', 'w-1')).toBe(false);
    expect(isRoundFor(r, DAY, 'en', 'w-1')).toBe(false);
    expect(isRoundFor(r, DAY, 'es', 'w-2')).toBe(false);
    expect(isRoundFor(r, DAY, 'es')).toBe(false);
    expect(isRoundFor(fresh(), DAY, 'es')).toBe(true);
    expect(isRoundFor(null, DAY, 'es')).toBe(false);
  });

  it('broken or unusable values read as null', () => {
    const ok = fresh();
    expect(parseSentenceRound(JSON.parse(JSON.stringify(ok)))).toEqual(ok);
    for (const bad of [
      null,
      'x',
      {},
      { ...ok, v: 1 },
      { ...ok, v: undefined },
      { ...ok, day: 5 },
      { ...ok, target: 'fr' },
      { ...ok, entries: [{ itemId: 'a' }] },
      { ...ok, entries: [{ ...ENTRIES[0], slots: [{ id: 'x' }] }] },
      { ...ok, entries: [{ ...ENTRIES[0], chunks: [{ source: 'x' }] }] },
      { ...ok, entries: [{ ...ENTRIES[0], chunks: 'x' }] },
      { ...ok, steps: undefined },
      { ...ok, steps: [{ id: 'a#build', itemId: 'a', kind: 'dance' }] },
      { ...ok, steps: [{ id: 'a#build', itemId: 'zzz', kind: 'build' }] }, // a step of a sentence that is not in the round
      { ...ok, steps: [{ id: 'a#chunk0', itemId: 'a', kind: 'chunk', chunk: 0.5 }] },
      { ...ok, steps: [{ id: 5, itemId: 'a', kind: 'build' }] },
      { ...ok, queue: ['zzz'] },
      { ...ok, done: ['zzz'] },
      { ...ok, queue: [] }, // still in the steps phase with nothing left
      { ...ok, phase: 'done' }, // a round that ended is never kept
      { ...ok, phase: 'build' },
    ]) {
      expect(parseSentenceRound(bad)).toBeNull();
    }
  });

  it('the parts of a split sentence stay through save and load', async () => {
    await saveSentenceRound(getDb(), fresh());
    const loaded = await loadSentenceRound(getDb());
    expect(loaded?.entries[0].chunks).toEqual(PARTS);
    expect(loaded?.entries[1].chunks).toBeUndefined(); // an unsplit sentence has none
  });

  it('a mistake sentence (BRIEF-B2) stays a mistake sentence through save and load, as one step; a malformed one makes the round unusable', async () => {
    const mistake = { ...entry('m'), wordIds: [], dueIds: [], slots: [], mistake: { wrong: 'frase mal' } };
    const withMistake = fresh([ENTRIES[0], ENTRIES[1], mistake]);
    expect(withMistake.steps.filter((s) => s.itemId === 'm').map((s) => s.kind)).toEqual(['mistake']);
    await saveSentenceRound(getDb(), withMistake);
    const loaded = await loadSentenceRound(getDb());
    expect(loaded).toEqual(withMistake);
    expect(loaded?.entries[2].mistake).toEqual({ wrong: 'frase mal' });
    expect(loaded?.entries[0].mistake).toBeUndefined(); // a corpus sentence has none
    for (const bad of [{ wrong: 5 }, 'frase mal', null]) {
      expect(parseSentenceRound(JSON.parse(JSON.stringify({ ...withMistake, entries: [ENTRIES[0], { ...mistake, mistake: bad }] })))).toBeNull();
    }
  });

  it('the cards whose word was looked at with a hint (BRIEF-B3) are added once, kept in the saved round, and a broken value is ignored', async () => {
    const r = fresh();
    expect(r.hinted).toBeUndefined();
    expect(addHinted(r, [])).toBe(r); // nothing to add: the same round back
    const one = addHinted(r, ['w-a', 'w-a']);
    expect(one.hinted).toEqual(['w-a']);
    expect(addHinted(one, ['w-a'])).toBe(one);
    const two = addHinted(one, ['w-b', 'w-a']);
    expect(two.hinted).toEqual(['w-a', 'w-b']);
    expect(r.hinted).toBeUndefined(); // the first round was not changed
    await saveSentenceRound(getDb(), two);
    expect((await loadSentenceRound(getDb()))?.hinted).toEqual(['w-a', 'w-b']);
    expect(answerStep(two, true).hinted).toEqual(['w-a', 'w-b']); // the hints stay while the round goes on
    // a round saved without them, or with something that is not a list of ids, has none
    expect(parseSentenceRound(JSON.parse(JSON.stringify(r)))?.hinted).toBeUndefined();
    expect(parseSentenceRound(JSON.parse(JSON.stringify({ ...r, hinted: [1, 2] })))?.hinted).toBeUndefined();
  });

  it('a round saved by the older version (builds, then a typed sentence; no v, no steps) starts again without an error', async () => {
    const old = {
      day: DAY,
      target: 'es',
      focus: '',
      entries: ENTRIES.map(({ chunks: _c, ...e }) => e),
      queue: ['a', 'b', 'c'],
      rated: [],
      typed: entry('t'),
      phase: 'build',
    };
    expect(parseSentenceRound(old)).toBeNull();
    await getDb().setGameProgress('app-resume', 'sentences', 'saved', old);
    expect(await loadSentenceRound(getDb())).toBeNull();
  });
});
