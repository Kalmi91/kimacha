// The Sentences tab round: the builds (no credit), then exactly one typing of a separate sentence that ends the round,
// a wrong build sends the sentence to the end, the saved round round-trips (with its focus) and an unusable one, or one
// saved by the older version (typed sentence picked from the builds), reads as nothing and so starts a fresh round.


import { getDb } from '@/lib/database';
import {
  addHinted,
  answerBuild,
  answerType,
  buildNumber,
  clearSentenceRound,
  currentEntry,
  isRoundFor,
  loadSentenceRound,
  parseSentenceRound,
  roundProgress,
  roundSentences,
  saveSentenceRound,
  startRound,
  type SentenceRound,
} from '../sentenceRound';
import type { SentenceEntry } from '../sentenceTab';

const DAY = '2026-10-12';

const entry = (id: string): SentenceEntry => ({
  itemId: id,
  source: `src ${id}`,
  target: `tgt ${id}`,
  wordCount: 2,
  wordIds: [`w-${id}`],
  due: true,
  dueIds: [`w-${id}`],
  staleness: '2026-10-01',
  slots: [{ id: `w-${id}`, words: [id] }],
});
const ENTRIES = ['a', 'b', 'c', 'd'].map(entry);
const TYPED = entry('t');
const fresh = (entries = ENTRIES, focus = ''): SentenceRound => startRound(entries, TYPED, DAY, 'es', focus);

const buildAllRight = (start: SentenceRound): SentenceRound => {
  let round = start;
  while (round.phase === 'build') round = answerBuild(round, true);
  return round;
};

describe('rhythm: all builds, then one typing of another sentence', () => {
  it('a fresh round: every sentence still to build, in order, the typed one waiting', () => {
    const r = fresh();
    expect(r).toMatchObject({ day: DAY, target: 'es', focus: '', queue: ['a', 'b', 'c', 'd'], rated: [], phase: 'build' });
    expect(r.typed.itemId).toBe('t');
    expect(currentEntry(r)?.itemId).toBe('a');
    expect(roundProgress(r)).toEqual({ done: 0, total: 5 });
  });

  it('4 right builds -> the typing starts, and the sentence to type is the separate one, not a built one', () => {
    let r = fresh();
    for (let i = 0; i < 3; i++) {
      r = answerBuild(r, true);
      expect(r.phase).toBe('build');
    }
    const last = answerBuild(r, true);
    expect(last.phase).toBe('type');
    expect(last.queue).toEqual([]);
    expect(last.rated).toEqual(['a', 'b', 'c', 'd']);
    expect(currentEntry(last)?.itemId).toBe('t');
    expect(ENTRIES.map((e) => e.itemId)).not.toContain(currentEntry(last)?.itemId);
    expect(roundProgress(last)).toEqual({ done: 4, total: 5 });
  });

  it('the typing ends the round, right or wrong: no second typing, no rebuild', () => {
    const typing = buildAllRight(fresh());
    const done = answerType(typing);
    expect(done.phase).toBe('done');
    expect(currentEntry(done)).toBeUndefined();
    expect(roundProgress(done)).toEqual({ done: 5, total: 5 });
    expect(done.queue).toEqual([]);
  });

  it('nothing to build (a single sentence in all): the round is the typing only', () => {
    const r = fresh([]);
    expect(r.phase).toBe('type');
    expect(currentEntry(r)?.itemId).toBe('t');
    expect(roundProgress(r)).toEqual({ done: 0, total: 1 });
    expect(answerType(r).phase).toBe('done');
  });

  it('a round with fewer sentences: builds of what there is, then the typing', () => {
    const round = buildAllRight(fresh(ENTRIES.slice(0, 2)));
    expect(round.phase).toBe('type');
    expect(roundProgress(round)).toEqual({ done: 2, total: 3 });
  });

  it('roundSentences: the builds and the typed one', () => {
    expect(roundSentences(fresh()).map((e) => e.itemId)).toEqual(['a', 'b', 'c', 'd', 't']);
  });
});

describe('wrong steps', () => {
  it('a wrong build: the sentence goes to the end, nothing is rated, the number of the build stays', () => {
    const r = answerBuild(fresh(), false);
    expect(r.queue).toEqual(['b', 'c', 'd', 'a']);
    expect(r.rated).toEqual([]);
    expect(buildNumber(r)).toBe(1);
    expect(roundProgress(r).done).toBe(0);
  });

  it('a sentence built wrong first is rated once it is built right, at its place in the round', () => {
    const round = buildAllRight(answerBuild(fresh(), false));
    expect(round.rated).toEqual(['b', 'c', 'd', 'a']);
    expect(round.phase).toBe('type');
  });

  it('a result for the wrong phase changes nothing', () => {
    const r = fresh();
    expect(answerType(r)).toBe(r);
    const typing = buildAllRight(r);
    expect(answerBuild(typing, true)).toBe(typing);
    const done = answerType(typing);
    expect(answerType(done)).toBe(done);
    expect(answerBuild(done, false)).toBe(done);
  });
});

describe('the number of the build', () => {
  it('counts the sentences built right plus the one on screen, never above the round size', () => {
    let r = fresh();
    expect(buildNumber(r)).toBe(1);
    r = answerBuild(r, true);
    expect(buildNumber(r)).toBe(2);
    expect(buildNumber(buildAllRight(r))).toBe(4);
  });
});

describe('the saved round', () => {
  beforeEach(async () => {
    await clearSentenceRound(getDb());
  });

  it('save then load gives the same round, mid-build and while waiting for the typing', async () => {
    const db = getDb();
    const mid = answerBuild(answerBuild(fresh(), true), false);
    await saveSentenceRound(db, mid);
    expect(await loadSentenceRound(db)).toEqual(mid);
    const typing = buildAllRight(fresh());
    await saveSentenceRound(db, typing);
    expect(await loadSentenceRound(db)).toEqual(typing);
    const typingOnly = fresh([], 'w-1,w-2');
    await saveSentenceRound(db, typingOnly);
    expect(await loadSentenceRound(db)).toEqual(typingOnly);
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
      { ...ok, day: 5 },
      { ...ok, target: 'fr' },
      { ...ok, entries: [{ itemId: 'a' }] },
      { ...ok, entries: [{ ...ENTRIES[0], slots: [{ id: 'x' }] }] },
      { ...ok, typed: undefined },
      { ...ok, typed: { itemId: 't' } },
      { ...ok, queue: ['zzz'] },
      { ...ok, rated: ['zzz'] },
      { ...ok, queue: [], phase: 'build' }, // building with nothing left to build
      { ...ok, phase: 'type' }, // typing while sentences are still to build
      { ...ok, phase: 'done' }, // a round that ended is never kept
    ]) {
      expect(parseSentenceRound(bad)).toBeNull();
    }
  });

  it('a mistake sentence (BRIEF-B2) stays a mistake sentence through save and load; a malformed one makes the round unusable', async () => {
    const mistake = { ...entry('m'), wordIds: [], dueIds: [], slots: [], mistake: { wrong: 'frase mal' } };
    const withMistake = fresh([ENTRIES[0], ENTRIES[1], mistake, ENTRIES[3]]);
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
    expect(answerBuild(two, true).hinted).toEqual(['w-a', 'w-b']); // the hints stay while the round goes on
    // a round saved without them, or with something that is not a list of ids, has none
    expect(parseSentenceRound(JSON.parse(JSON.stringify(r)))?.hinted).toBeUndefined();
    expect(parseSentenceRound(JSON.parse(JSON.stringify({ ...r, hinted: [1, 2] })))?.hinted).toBeUndefined();
  });

  it('a round saved by the older version (the typed sentence was one of the built ones) starts again without an error', async () => {
    const { typed: _typed, focus: _focus, ...rest } = fresh();
    const old = { ...rest, typeId: 'b', entries: ENTRIES.map(({ dueIds: _d, staleness: _s, slots: _sl, ...e }) => e) };
    expect(parseSentenceRound(old)).toBeNull();
    await getDb().setGameProgress('app-resume', 'sentences', 'saved', old);
    expect(await loadSentenceRound(getDb())).toBeNull();
  });
});
