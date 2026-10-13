// The Sentences tab round: 4 builds then exactly one typing (one of the built sentences, seeded pick), the half is paid at
// a sentence's first right build only, a wrong step sends the sentence to the end, the saved round round-trips and
// an unusable one reads as nothing.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { getDb } from '@/lib/database';
import {
  answerBuild,
  answerType,
  buildNumber,
  clearSentenceRound,
  currentEntry,
  isRoundFor,
  loadSentenceRound,
  parseSentenceRound,
  pickTypedId,
  roundProgress,
  saveSentenceRound,
  startRound,
  type SentenceRound,
} from '../sentenceRound';
import type { SentenceEntry } from '../sentenceTab';

const DAY = '2026-10-12';

const entry = (id: string): SentenceEntry => ({ itemId: id, source: `src ${id}`, target: `tgt ${id}`, wordCount: 2, wordIds: [`w-${id}`], due: false });
const ENTRIES = ['a', 'b', 'c', 'd'].map(entry);
const fresh = (entries = ENTRIES): SentenceRound => startRound(entries, DAY, 'es');

// Builds every current sentence right until the typing starts; returns the round and what was paid, in order.
const buildAllRight = (start: SentenceRound) => {
  let round = start;
  const paid: string[] = [];
  while (round.phase === 'build') {
    const r = answerBuild(round, true);
    if (r.pay) paid.push(r.pay.itemId);
    round = r.round;
  }
  return { round, paid };
};

describe('rhythm: all builds, then one typing', () => {
  it('a fresh round: every sentence still to build, in order, nothing paid, no typing picked', () => {
    const r = fresh();
    expect(r).toMatchObject({ day: DAY, target: 'es', queue: ['a', 'b', 'c', 'd'], rated: [], typeId: null, phase: 'build' });
    expect(currentEntry(r)?.itemId).toBe('a');
    expect(roundProgress(r)).toEqual({ done: 0, total: 5 });
  });

  it('4 right builds -> exactly one typing, and it is one of the 4; each sentence paid once, in build order', () => {
    let r = fresh();
    for (let i = 0; i < 3; i++) {
      r = answerBuild(r, true).round;
      expect(r.phase).toBe('build');
      expect(r.typeId).toBeNull();
    }
    const last = answerBuild(r, true);
    expect(last.round.phase).toBe('type');
    expect(last.round.queue).toEqual([]);
    expect(['a', 'b', 'c', 'd']).toContain(last.round.typeId);
    expect(currentEntry(last.round)?.itemId).toBe(last.round.typeId);
    expect(last.round.rated).toEqual(['a', 'b', 'c', 'd']);
    const typed = answerType(last.round, true);
    expect(typed.phase).toBe('done');
    expect(currentEntry(typed)).toBeUndefined();
    expect(roundProgress(typed)).toEqual({ done: 5, total: 5 });
  });

  it('the half is paid by the build only: the right typing pays nothing new', () => {
    const { round, paid } = buildAllRight(fresh());
    expect(paid).toEqual(['a', 'b', 'c', 'd']);
    // answerType returns a round only: no pay channel at all
    expect(answerType(round, true).rated).toEqual(['a', 'b', 'c', 'd']);
  });

  it('a round with fewer sentences: builds of what there is, then one typing', () => {
    const { round } = buildAllRight(fresh(ENTRIES.slice(0, 2)));
    expect(round.phase).toBe('type');
    expect(['a', 'b']).toContain(round.typeId);
    expect(roundProgress(round)).toEqual({ done: 2, total: 3 });
  });
});

describe('the seeded pick of the typed sentence', () => {
  it('the same day and sentences always pick the same one; it is one of them', () => {
    const ids = ['a', 'b', 'c', 'd'];
    expect(pickTypedId(DAY, ids)).toBe(pickTypedId(DAY, ids));
    expect(ids).toContain(pickTypedId(DAY, ids));
    expect(pickTypedId(DAY, [])).toBeNull();
    expect(pickTypedId(DAY, ['only'])).toBe('only');
  });

  it('the round picks with that seed, whatever the order the sentences were built in', () => {
    const wrongFirst = answerBuild(fresh(), false).round; // a goes to the end: b, c, d, a
    const { round } = buildAllRight(wrongFirst);
    expect(round.typeId).toBe(pickTypedId(DAY, ['a', 'b', 'c', 'd']));
  });

  it('it is spread: over many days every place of 4 comes up', () => {
    const places = new Set<number>();
    for (let d = 1; d <= 60; d++) {
      const day = `2026-11-${String(d % 28 + 1).padStart(2, '0')}-${d}`;
      places.add(['a', 'b', 'c', 'd'].indexOf(pickTypedId(day, ['a', 'b', 'c', 'd']) as string));
    }
    expect([...places].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe('wrong steps', () => {
  it('a wrong build: the sentence goes to the end, nothing is paid or rated, the number of the build stays', () => {
    const r = answerBuild(fresh(), false);
    expect(r.pay).toBeNull();
    expect(r.round.queue).toEqual(['b', 'c', 'd', 'a']);
    expect(r.round.rated).toEqual([]);
    expect(buildNumber(r.round)).toBe(1);
    expect(roundProgress(r.round).done).toBe(0);
  });

  it('a sentence built wrong first is paid once it is built right, at its place in the round', () => {
    const { round, paid } = buildAllRight(answerBuild(fresh(), false).round);
    expect(paid).toEqual(['b', 'c', 'd', 'a']);
    expect(round.phase).toBe('type');
  });

  it('a wrong typing: the typed sentence goes back to the end (built, then typed again), no new pay; the pick stays', () => {
    const { round } = buildAllRight(fresh());
    const typeId = round.typeId as string;
    const back = answerType(round, false);
    expect(back).toMatchObject({ phase: 'build', queue: [typeId], typeId });
    expect(back.rated).toEqual(['a', 'b', 'c', 'd']);
    const rebuilt = answerBuild(back, true);
    expect(rebuilt.pay).toBeNull();
    expect(rebuilt.round).toMatchObject({ phase: 'type', typeId });
    // a wrong rebuild in between changes nothing about the pay either
    const wrongAgain = answerBuild(back, false);
    expect(wrongAgain.pay).toBeNull();
    expect(wrongAgain.round.queue).toEqual([typeId]);
    expect(answerType(rebuilt.round, true).phase).toBe('done');
  });

  it('a result for the wrong phase changes nothing', () => {
    const r = fresh();
    expect(answerType(r, true)).toBe(r);
    const { round } = buildAllRight(r);
    expect(answerBuild(round, true)).toEqual({ round, pay: null });
    const done = answerType(round, true);
    expect(answerType(done, false)).toBe(done);
  });
});

describe('the number of the build', () => {
  it('counts the sentences built right plus the one on screen, never above the round size', () => {
    let r = fresh();
    expect(buildNumber(r)).toBe(1);
    r = answerBuild(r, true).round;
    expect(buildNumber(r)).toBe(2);
    const { round } = buildAllRight(r);
    expect(buildNumber(round)).toBe(4);
  });
});

describe('the saved round', () => {
  beforeEach(async () => {
    await clearSentenceRound(getDb());
  });

  it('save then load gives the same round, mid-build and while waiting for the typing', async () => {
    const db = getDb();
    const mid = answerBuild(answerBuild(fresh(), true).round, false).round;
    await saveSentenceRound(db, mid);
    expect(await loadSentenceRound(db)).toEqual(mid);
    const { round: typing } = buildAllRight(fresh());
    await saveSentenceRound(db, typing);
    expect(await loadSentenceRound(db)).toEqual(typing);
  });

  it('clear drops it; nothing saved reads as null', async () => {
    const db = getDb();
    expect(await loadSentenceRound(db)).toBeNull();
    await saveSentenceRound(db, fresh());
    await clearSentenceRound(db);
    expect(await loadSentenceRound(db)).toBeNull();
  });

  it('valid only for the same day and direction', () => {
    const r = fresh();
    expect(isRoundFor(r, DAY, 'es')).toBe(true);
    expect(isRoundFor(r, '2026-10-13', 'es')).toBe(false);
    expect(isRoundFor(r, DAY, 'en')).toBe(false);
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
      { ...ok, entries: [] },
      { ...ok, entries: [{ itemId: 'a' }] },
      { ...ok, queue: ['zzz'] },
      { ...ok, rated: ['zzz'] },
      { ...ok, queue: [], phase: 'build' }, // building with nothing left to build
      { ...ok, phase: 'type', queue: [], typeId: null }, // typing with no pick
      { ...ok, phase: 'type', typeId: 'a' }, // typing while sentences are still to build
      { ...ok, phase: 'done' }, // a round that ended is never kept
    ]) {
      expect(parseSentenceRound(bad)).toBeNull();
    }
  });
});
