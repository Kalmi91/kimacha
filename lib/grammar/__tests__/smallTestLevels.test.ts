// The Small test is level-independent: a round at B1 is built from B1's core topics (the level's own sample set here), the
// saved run is kept per level (A1 and B1 never mix), and a topic that lacks a task type is asked from what it has.

const mockCore: Record<string, string[]> = { A1: ['a-1', 'a-2'], B1: ['b-1', 'b-2', 'b-3'] };
const mockQs: Record<string, { id: string; kind: string }[]> = {
  'a-1': [{ id: 'a-1-q1', kind: 'choice' }],
  'b-1': [1, 2, 3].map((n) => ({ id: `b-1-q${n}`, kind: 'choice' })),
  'b-2': [{ id: 'b-2-q1', kind: 'choice' }],
  'b-3': [],
};
// b-2 also has typed items; b-3 has no usable item at all
const mockLessons: Record<string, { items: unknown[] }> = {
  'b-2': { items: [{ kind: 'opencloze', id: 'b-2-c1' }, { kind: 'bank', id: 'b-2-k1' }, { kind: 'dictation', id: 'b-2-d1' }] },
};

jest.mock('@/lib/grammar/randomRoundView', () => ({
  questionsOf: (_d: unknown, _seed: number, topic: string) => mockQs[topic] ?? [],
}));
jest.mock('@/lib/grammar/syllabus', () => ({
  ...jest.requireActual('@/lib/grammar/syllabus'),
  lessonFor: (_lang: string, topic: string) => mockLessons[topic] ?? null,
}));
jest.mock('@/lib/grammar/taskTypes', () => ({
  ...jest.requireActual('@/lib/grammar/taskTypes'),
  coreTopicsForLevel: (level: string) => mockCore[level] ?? [],
  // B1 here has only choice + opencloze + bank; the other types are missing from the level
  taskConfigForLevel: () => ({ enabled: true, types: ['choice', 'opencloze', 'bank'] }),
}));

import { getDb } from '@/lib/database.web';
import type { RoundData } from '@/lib/grammar/randomRoundView';
import {
  beginRound,
  hasSavedSmallRun,
  loadSmallState,
  newSmallState,
  saveSmallState,
  smallKey,
  startRound,
} from '../smallTest';
import { smallTestView } from '../smallTestView';

const data = (level: string, ids: string[]): RoundData =>
  ({
    learnedLang: 'es',
    contentLang: 'en',
    userLevel: level,
    levels: ['A1', 'A2', 'B1', 'B2', 'C1'],
    startLevel: level,
    topics: ids.map((id) => ({ id, level, unit: 'u', title: { en: id }, blurb: { en: '' } })),
    cache: { seed: -1, map: new Map() },
  }) as unknown as RoundData;

describe('small test at a level other than A1', () => {
  it('builds the round from the level\'s own core topics, in the level\'s own types', () => {
    const v = smallTestView(data('B1', ['b-1', 'b-2', 'b-3']), 5, 'B1');
    expect(v.topics).toEqual([
      { id: 'b-1', core: true },
      { id: 'b-2', core: true },
      { id: 'b-3', core: true },
    ]);
    // b-3 has no usable question: it is not counted among the core topics the level bar needs
    expect(v.coreIds).toEqual(['b-1', 'b-2']);
    const st = beginRound(startRound(newSmallState(), v.topics, v.pool, 5), v.pool);
    const used = new Set(st.run!.topics.map((x) => x.id));
    for (const id of used) expect(['b-1', 'b-2', 'b-3']).toContain(id);
    expect([...used].some((id) => id.startsWith('a-'))).toBe(false);
  });

  it('a topic that lacks task types is asked from what it has, without crashing', () => {
    const v = smallTestView(data('B1', ['b-1', 'b-2', 'b-3']), 5, 'B1');
    expect(v.pool('b-1').map((q) => q.type)).toEqual(['choice', 'choice', 'choice']);
    // dictation is not one of the 8 types, so it never enters the pool; opencloze + bank + choice do
    expect(v.pool('b-2').map((q) => q.type).sort()).toEqual(['bank', 'choice', 'opencloze']);
    expect(v.pool('b-3')).toEqual([]);
    const st = beginRound(startRound(newSmallState(), v.topics, v.pool, 9), v.pool);
    expect(st.run!.current).not.toBeNull();
  });

  it('keeps the saved run per level: A1 and B1 do not mix', async () => {
    const db = getDb();
    const pair = 'en→es';
    expect(smallKey(pair, 'B1')).not.toBe(smallKey(pair, 'A1'));
    const v = smallTestView(data('B1', ['b-1', 'b-2']), 5, 'B1');
    const st = startRound(newSmallState(), v.topics, v.pool, 5);
    await saveSmallState(db, pair, 'B1', st);
    expect(await hasSavedSmallRun(db, pair, 'B1')).toBe(true);
    expect(await hasSavedSmallRun(db, pair, 'A1')).toBe(false);
    expect((await loadSmallState(db, pair, 'A1')).run).toBeNull();
    expect((await loadSmallState(db, pair, 'B1')).run?.topics.map((x) => x.id).sort()).toEqual(['b-1', 'b-2']);
    await saveSmallState(db, pair, 'B1', newSmallState());
  });
});
