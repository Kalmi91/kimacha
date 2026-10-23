// The steps of a Sentences tab round (lib/sentenceSteps.ts, FB524).

import { roundSteps } from '../sentenceSteps';
import type { SentenceEntry } from '../sentenceTab';

const entry = (n: number, chunks?: number): SentenceEntry => ({
  itemId: `a1-w${n}`, source: `Sentence ${n}.`, target: `frase ${n}`, wordCount: 2, wordIds: [`a1-w${n}`], due: false, dueIds: [], staleness: '', slots: [{ id: `a1-w${n}`, words: ['frase'] }],
  ...(chunks === undefined ? {} : { chunks: Array.from({ length: chunks }, (_, i) => ({ source: `part ${i}`, target: `parte ${i}` })) }),
});
const ids = (entries: SentenceEntry[], listening: boolean) => roundSteps(entries, { listening }).map((s) => s.id);

describe('roundSteps', () => {
  it('a split sentence: one chunk step per part, then listen, build, type', () => {
    expect(ids([entry(1, 2)], true)).toEqual(['a1-w1#chunk0', 'a1-w1#chunk1', 'a1-w1#listen', 'a1-w1#build', 'a1-w1#type']);
    expect(ids([entry(1, 3)], true).slice(0, 3)).toEqual(['a1-w1#chunk0', 'a1-w1#chunk1', 'a1-w1#chunk2']);
  });

  it('the listen step only comes with the listening switch', () => {
    expect(ids([entry(1, 2)], false)).toEqual(['a1-w1#chunk0', 'a1-w1#chunk1', 'a1-w1#build', 'a1-w1#type']);
  });

  it('a sentence with no parts (or fewer than 2) has no chunk steps', () => {
    expect(ids([entry(1)], true)).toEqual(['a1-w1#listen', 'a1-w1#build', 'a1-w1#type']);
    expect(ids([entry(1, 0)], false)).toEqual(['a1-w1#build', 'a1-w1#type']);
    expect(ids([entry(1, 1)], false)).toEqual(['a1-w1#build', 'a1-w1#type']);
  });

  it('the sentences run one after the other, in the round order', () => {
    expect(ids([entry(1), entry(2, 2), entry(3)], false)).toEqual([
      'a1-w1#build', 'a1-w1#type', 'a1-w2#chunk0', 'a1-w2#chunk1', 'a1-w2#build', 'a1-w2#type', 'a1-w3#build', 'a1-w3#type',
    ]);
  });

  it('a step knows its sentence, kind and part', () => {
    const steps = roundSteps([entry(1, 2)], { listening: true });
    expect(steps[1]).toEqual({ id: 'a1-w1#chunk1', itemId: 'a1-w1', kind: 'chunk', chunk: 1 });
    expect(steps[4]).toEqual({ id: 'a1-w1#type', itemId: 'a1-w1', kind: 'type' });
    expect(steps.every((s) => s.itemId === 'a1-w1')).toBe(true);
  });

  it('a sentence from the mistake list is ONE mistake step, whatever else it carries', () => {
    const mistake: SentenceEntry = { ...entry(2, 2), mistake: { wrong: 'frase mal' } };
    expect(roundSteps([entry(1), mistake], { listening: true }).map((s) => `${s.id}:${s.kind}`)).toEqual([
      'a1-w1#listen:listen', 'a1-w1#build:build', 'a1-w1#type:type', 'a1-w2#mistake:mistake',
    ]);
  });

  it('no sentences, no steps', () => {
    expect(roundSteps([], { listening: true })).toEqual([]);
  });
});
