// The steps of a Sentences tab round (lib/sentenceSteps.ts, FB524, ladder FB569/FB570): a sentence gets only the steps of the
// rung it plays this round.

import { roundSteps } from '../sentenceSteps';
import type { SentenceEntry } from '../sentenceTab';

const entry = (n: number, chunks?: number, rung?: 2 | 3): SentenceEntry => ({
  itemId: `a1-w${n}`, source: `Sentence ${n}.`, target: `frase ${n}`, wordCount: 2, wordIds: [`a1-w${n}`], due: false, dueIds: [], staleness: '', slots: [{ id: `a1-w${n}`, words: ['frase'] }],
  ...(chunks === undefined ? {} : { chunks: Array.from({ length: chunks }, (_, i) => ({ source: `part ${i}`, target: `parte ${i}` })) }),
  ...(rung ? { rung } : {}),
});
const ids = (entries: SentenceEntry[]) => roundSteps(entries, {}).map((s) => s.id);

describe('roundSteps', () => {
  it('rung 1: one chunk step per part, then the whole sentence built; nothing else', () => {
    expect(ids([entry(1, 2)])).toEqual(['a1-w1#chunk0', 'a1-w1#chunk1', 'a1-w1#build']);
    expect(ids([entry(1, 3)])).toEqual(['a1-w1#chunk0', 'a1-w1#chunk1', 'a1-w1#chunk2', 'a1-w1#build']);
  });

  it('rung 2 is the listen step alone, rung 3 the typing step alone (the parts are not played again)', () => {
    expect(ids([entry(1, 2, 2)])).toEqual(['a1-w1#listen']);
    expect(ids([entry(1, 2, 3)])).toEqual(['a1-w1#type']);
    expect(ids([entry(1, undefined, 2)])).toEqual(['a1-w1#listen']);
    expect(ids([entry(1, undefined, 3)])).toEqual(['a1-w1#type']);
  });

  it('the listen step no longer needs a switch', () => {
    expect(roundSteps([entry(1, undefined, 2)], {}).map((s) => s.kind)).toEqual(['listen']);
  });

  it('a sentence with no shorter sentences has no chunk steps; one shorter sentence is one step (FB538)', () => {
    expect(ids([entry(1)])).toEqual(['a1-w1#build']);
    expect(ids([entry(1, 0)])).toEqual(['a1-w1#build']);
    expect(ids([entry(1, 1)])).toEqual(['a1-w1#chunk0', 'a1-w1#build']);
  });

  it('the sentences run one after the other, in the round order, each with its own rung', () => {
    expect(ids([entry(1), entry(2, 2), entry(3, undefined, 2), entry(4, undefined, 3)])).toEqual([
      'a1-w1#build', 'a1-w2#chunk0', 'a1-w2#chunk1', 'a1-w2#build', 'a1-w3#listen', 'a1-w4#type',
    ]);
  });

  // FB536: "the same sentences come one after the other, shuffle them" (beta sentenceMix).
  describe('with mix', () => {
    const mixed = (entries: SentenceEntry[]) => roundSteps(entries, { mix: true }).map((s) => s.id);

    it('the sentences take turns: never the same one twice in a row while another has steps left', () => {
      expect(mixed([entry(1), entry(2, 2), entry(3)])).toEqual(['a1-w2#chunk0', 'a1-w1#build', 'a1-w2#chunk1', 'a1-w3#build', 'a1-w2#build']);
      // A full round (5 sentences on mixed rungs, some split): no sentence twice in a row, each one in its own order.
      const round = [entry(1, 3), entry(2, undefined, 2), entry(3, 2), entry(4, undefined, 3), entry(5, 2)];
      const steps = roundSteps(round, { mix: true });
      expect(steps.some((s, i) => i > 0 && steps[i - 1].itemId === s.itemId && round.find((e) => e.itemId === s.itemId)?.rung !== undefined)).toBe(false);
      for (const e of round) {
        expect(steps.filter((s) => s.itemId === e.itemId).map((s) => s.id)).toEqual(ids([e]));
      }
    });

    it('only when one sentence is left do its steps follow each other', () => {
      expect(mixed([entry(1, 3), entry(2)])).toEqual(['a1-w1#chunk0', 'a1-w2#build', 'a1-w1#chunk1', 'a1-w1#chunk2', 'a1-w1#build']);
      expect(mixed([entry(1)])).toEqual(['a1-w1#build']);
    });

    it('a mistake sentence is one step among the others', () => {
      const mistake: SentenceEntry = { ...entry(2, 2), mistake: { wrong: 'frase mal' } };
      expect(mixed([entry(1, undefined, 2), mistake])).toEqual(['a1-w1#listen', 'a1-w2#mistake']);
    });
  });

  it('a step knows its sentence, kind and part', () => {
    const steps = roundSteps([entry(1, 2)], {});
    expect(steps[1]).toEqual({ id: 'a1-w1#chunk1', itemId: 'a1-w1', kind: 'chunk', chunk: 1 });
    expect(steps[2]).toEqual({ id: 'a1-w1#build', itemId: 'a1-w1', kind: 'build' });
    expect(roundSteps([entry(1, 2, 3)], {})[0]).toEqual({ id: 'a1-w1#type', itemId: 'a1-w1', kind: 'type' });
    expect(steps.every((s) => s.itemId === 'a1-w1')).toBe(true);
  });

  it('a sentence from the mistake list is ONE mistake step, whatever else it carries (also a rung)', () => {
    const mistake: SentenceEntry = { ...entry(2, 2), mistake: { wrong: 'frase mal' } };
    expect(roundSteps([entry(1), mistake], {}).map((s) => `${s.id}:${s.kind}`)).toEqual(['a1-w1#build:build', 'a1-w2#mistake:mistake']);
    expect(ids([{ ...mistake, rung: 3 }])).toEqual(['a1-w2#mistake']);
  });

  it('no sentences, no steps', () => {
    expect(roundSteps([], {})).toEqual([]);
  });
});
