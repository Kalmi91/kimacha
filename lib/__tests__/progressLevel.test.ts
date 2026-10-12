// Level A1-C1 of the learner (lib/progressLevel.ts, reader: lib/progressLevelDb.ts):
// a level is cleared by 80% of its words learned + every grammar topic of the level done;
// the levels build on each other, C1 is the ceiling.

import { pcicItemsForLevel, setPcicTarget, type PcicLevel } from '@/data/pcic';
import { GRAMMAR_PROGRESS_KEY, syllabusForLevel } from '@/lib/grammar/syllabus';
import {
  computeProgressLevel,
  isLevelCleared,
  LEVEL_WORDS_PCT,
  PROGRESS_LEVELS,
  wordsNeededFor,
  type LevelCounts,
} from '@/lib/progressLevel';
import { readProgressLevel } from '@/lib/progressLevelDb';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';

const LEVELS: PcicLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

/** A level with 100 words and 10 grammar topics; override per test. */
const counts = (level: PcicLevel, over: Partial<LevelCounts> = {}): LevelCounts => ({
  level,
  wordsKnown: 100,
  wordsTotal: 100,
  grammarDone: 10,
  grammarTotal: 10,
  ...over,
});
/** A level that is not cleared (no words learned, no topic done). */
const open = (level: PcicLevel) => counts(level, { wordsKnown: 0, grammarDone: 0 });

describe('wordsNeededFor / isLevelCleared: the 80% rule', () => {
  it('the goal is 80%, rounded up', () => {
    expect(LEVEL_WORDS_PCT).toBe(80);
    expect(wordsNeededFor(100)).toBe(80);
    expect(wordsNeededFor(7)).toBe(6); // 5.6 -> 6
    expect(wordsNeededFor(10)).toBe(8);
    expect(wordsNeededFor(0)).toBe(0);
  });

  it('79 of 100 words is not enough, 80 of 100 is', () => {
    expect(isLevelCleared(counts('A1', { wordsKnown: 79 }))).toBe(false);
    expect(isLevelCleared(counts('A1', { wordsKnown: 80 }))).toBe(true);
  });

  it('rounding up: 5 of 7 words (71%) is not enough, 6 of 7 (86%) is', () => {
    expect(isLevelCleared(counts('A1', { wordsTotal: 7, wordsKnown: 5 }))).toBe(false);
    expect(isLevelCleared(counts('A1', { wordsTotal: 7, wordsKnown: 6 }))).toBe(true);
  });

  it('all words learned but one grammar topic missing: not cleared', () => {
    expect(isLevelCleared(counts('A1', { grammarDone: 9 }))).toBe(false);
  });

  it('enough words and every topic done: cleared, more words than the total do no harm', () => {
    expect(isLevelCleared(counts('A1'))).toBe(true);
    expect(isLevelCleared(counts('A1', { wordsKnown: 120 }))).toBe(true);
  });

  it('a side with no content cannot be satisfied: 0 words or 0 grammar topics is never cleared', () => {
    expect(isLevelCleared(counts('A1', { wordsTotal: 0, wordsKnown: 0 }))).toBe(false);
    expect(isLevelCleared(counts('A1', { grammarTotal: 0, grammarDone: 0 }))).toBe(false);
  });
});

describe('computeProgressLevel', () => {
  it('empty data: no level, next is A1 with nothing counted', () => {
    expect(computeProgressLevel([])).toEqual({
      level: null,
      next: { level: 'A1', wordsKnown: 0, wordsTotal: 0, grammarDone: 0, grammarTotal: 0, wordsNeeded: 0 },
    });
  });

  it('nothing learned yet: level null ("heading for A1"), next A1 with the 80% goal', () => {
    const r = computeProgressLevel(LEVELS.map(open));
    expect(r.level).toBeNull();
    expect(r.next).toEqual({ level: 'A1', wordsKnown: 0, wordsTotal: 100, wordsNeeded: 80, grammarDone: 0, grammarTotal: 10 });
  });

  it('79 of 100 words (all topics done): still no level; 80 of 100: A1', () => {
    const below = computeProgressLevel([counts('A1', { wordsKnown: 79 }), ...LEVELS.slice(1).map(open)]);
    expect(below.level).toBeNull();
    expect(below.next).toMatchObject({ level: 'A1', wordsKnown: 79, wordsNeeded: 80 });
    const at = computeProgressLevel([counts('A1', { wordsKnown: 80 }), ...LEVELS.slice(1).map(open)]);
    expect(at.level).toBe('A1');
    expect(at.next).toMatchObject({ level: 'A2' });
  });

  it('a missing grammar topic holds the level back although the words are there', () => {
    const r = computeProgressLevel([counts('A1', { grammarDone: 9 }), ...LEVELS.slice(1).map(open)]);
    expect(r.level).toBeNull();
    expect(r.next).toMatchObject({ level: 'A1', grammarDone: 9, grammarTotal: 10 });
  });

  it('A1 cleared, A2 half done: level A1, next A2 with its own counts', () => {
    const r = computeProgressLevel([counts('A1'), counts('A2', { wordsKnown: 50, grammarDone: 4 }), ...LEVELS.slice(2).map(open)]);
    expect(r.level).toBe('A1');
    expect(r.next).toEqual({ level: 'A2', wordsKnown: 50, wordsTotal: 100, wordsNeeded: 80, grammarDone: 4, grammarTotal: 10 });
  });

  it('no skipping: B1 is fully done but A2 is not, so the level stays A1 and next is A2', () => {
    const r = computeProgressLevel([counts('A1'), open('A2'), counts('B1'), open('B2'), open('C1')]);
    expect(r.level).toBe('A1');
    expect(r.next).toMatchObject({ level: 'A2' });
  });

  it('no skipping: higher levels done without A1 give no level at all', () => {
    const r = computeProgressLevel([open('A1'), counts('A2'), counts('B1'), counts('B2'), counts('C1')]);
    expect(r.level).toBeNull();
    expect(r.next).toMatchObject({ level: 'A1' });
  });

  it('the level climbs one by one: A1-B2 cleared is B2, next C1', () => {
    const r = computeProgressLevel([counts('A1'), counts('A2'), counts('B1'), counts('B2'), open('C1')]);
    expect(r.level).toBe('B2');
    expect(r.next).toMatchObject({ level: 'C1' });
  });

  it('C1 is the ceiling: everything cleared gives C1 and no next level (there is no C2)', () => {
    const r = computeProgressLevel(LEVELS.map((l) => counts(l)));
    expect(r).toEqual({ level: 'C1', next: null });
  });

  it('the order of the input does not matter', () => {
    const r = computeProgressLevel([counts('B1'), counts('A2'), open('B2'), counts('A1'), open('C1')]);
    expect(r.level).toBe('B1');
    expect(r.next).toMatchObject({ level: 'B2' });
  });

  it('a level missing from the input counts as not cleared', () => {
    const r = computeProgressLevel([counts('A1'), counts('B1')]);
    expect(r.level).toBe('A1');
    expect(r.next).toMatchObject({ level: 'A2', wordsTotal: 0, wordsNeeded: 0 });
  });

  it('the ladder is A1 to C1 (no C2)', () => {
    expect(PROGRESS_LEVELS).toEqual(LEVELS);
  });
});

describe('readProgressLevel (real corpus, fake store)', () => {
  beforeEach(() => setPcicTarget('es'));

  const idsOf = (level: PcicLevel) => pcicItemsForLevel(level).map((i) => i.id);
  const review = (itemId: string): Sm2Card => ({ ...sm2NewCard(itemId), state: 'review', interval: 3, due: '2026-10-20' });
  const doneRow = (topicId: string) => ({ itemId: topicId, state: 'done', data: { correct: 1, total: 1 } });
  const topicsOf = (level: PcicLevel) => syllabusForLevel(level, 'es').map((t) => t.id);
  const store = (cards: Sm2Card[], rows: { itemId: string; state: string; data: unknown }[] = []) => ({
    getPcicCards: async () => cards,
    getGameProgress: async (gameId: string) => (gameId === GRAMMAR_PROGRESS_KEY ? rows : []),
  });
  /** Cards for the first `n` words of the level, in the review state. */
  const learned = (level: PcicLevel, n: number) => idsOf(level).slice(0, n).map(review);
  const wordGoal = (level: PcicLevel) => wordsNeededFor(idsOf(level).length);

  it('the corpus has words and grammar topics on every level A1-C1', () => {
    for (const level of LEVELS) {
      expect(idsOf(level).length).toBeGreaterThan(0);
      expect(topicsOf(level).length).toBeGreaterThan(0);
    }
  });

  it('a fresh learner: no level, A1 totals come from the words-open corpus and the syllabus', async () => {
    const r = await readProgressLevel(store([]), 'es');
    expect(r).toEqual({
      level: null,
      next: {
        level: 'A1',
        wordsKnown: 0,
        wordsTotal: idsOf('A1').length,
        wordsNeeded: wordGoal('A1'),
        grammarDone: 0,
        grammarTotal: topicsOf('A1').length,
      },
    });
  });

  it('the English direction (es→en) has no levels', async () => {
    expect(await readProgressLevel(store(learned('A1', 5)), 'en')).toBeNull();
  });

  it('"learned" is the Stats definition: review state or marked known; learning, new and orphan cards do not count', async () => {
    const [a, b, c, d] = idsOf('A1');
    const cards: Sm2Card[] = [
      review(a),
      { ...sm2NewCard(b), known: true },
      { ...sm2NewCard(c), state: 'learning' },
      sm2NewCard(d),
      review('w999999'), // not in the corpus: belongs to no level
    ];
    const r = await readProgressLevel(store(cards), 'es');
    expect(r?.next).toMatchObject({ level: 'A1', wordsKnown: 2 });
  });

  it('"done" is the Course tab definition: an open row does not count, a finished one does', async () => {
    const [t1, t2, t3] = topicsOf('A1');
    const rows = [doneRow(t1), doneRow(t2), { itemId: t3, state: 'progress', data: { correct: 1, total: 4 } }];
    const r = await readProgressLevel(store([], rows), 'es');
    expect(r?.next).toMatchObject({ level: 'A1', grammarDone: 2 });
  });

  it('grammar topics of other levels do not count toward A1', async () => {
    const r = await readProgressLevel(store([], topicsOf('A2').map(doneRow)), 'es');
    expect(r?.next).toMatchObject({ level: 'A1', grammarDone: 0 });
  });

  it('one word short of 80% (all topics done): still heading for A1; at 80%: A1, next A2', async () => {
    const rows = topicsOf('A1').map(doneRow);
    const short = await readProgressLevel(store(learned('A1', wordGoal('A1') - 1), rows), 'es');
    expect(short?.level).toBeNull();
    const enough = await readProgressLevel(store(learned('A1', wordGoal('A1')), rows), 'es');
    expect(enough?.level).toBe('A1');
    expect(enough?.next).toMatchObject({ level: 'A2', wordsKnown: 0 });
  });

  it('all words but one topic missing: not cleared', async () => {
    const topics = topicsOf('A1');
    const r = await readProgressLevel(store(learned('A1', idsOf('A1').length), topics.slice(1).map(doneRow)), 'es');
    expect(r?.level).toBeNull();
    expect(r?.next).toMatchObject({ level: 'A1', grammarDone: topics.length - 1, grammarTotal: topics.length });
  });

  it('every level cleared: C1, no next', async () => {
    const cards = LEVELS.flatMap((l) => learned(l, wordGoal(l)));
    const rows = LEVELS.flatMap((l) => topicsOf(l).map(doneRow));
    expect(await readProgressLevel(store(cards, rows), 'es')).toEqual({ level: 'C1', next: null });
  });

  it('no skipping on real data: B1 cleared without A2 stays at A1', async () => {
    const cards = [...learned('A1', wordGoal('A1')), ...learned('B1', wordGoal('B1'))];
    const rows = [...topicsOf('A1'), ...topicsOf('B1')].map(doneRow);
    const r = await readProgressLevel(store(cards, rows), 'es');
    expect(r?.level).toBe('A1');
    expect(r?.next).toMatchObject({ level: 'A2' });
  });
});
