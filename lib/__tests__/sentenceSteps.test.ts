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

  // FB536: "the same sentences come one after the other, shuffle them" (beta sentenceMix).
  describe('with mix', () => {
    const mixed = (entries: SentenceEntry[], listening = false) => roundSteps(entries, { listening, mix: true }).map((s) => s.id);

    it('the sentences take turns: never the same one twice in a row while another has steps left', () => {
      expect(mixed([entry(1), entry(2, 2), entry(3)])).toEqual([
        'a1-w2#chunk0', 'a1-w1#build', 'a1-w2#chunk1', 'a1-w3#build', 'a1-w2#build', 'a1-w1#type', 'a1-w2#type', 'a1-w3#type',
      ]);
      // A full round (5 sentences, some split, listening on): no sentence twice in a row, each one in its own order.
      const round = [entry(1, 3), entry(2), entry(3, 2), entry(4), entry(5, 2)];
      const steps = roundSteps(round, { listening: true, mix: true });
      expect(steps.some((s, i) => i > 0 && steps[i - 1].itemId === s.itemId)).toBe(false);
      for (const e of round) {
        expect(steps.filter((s) => s.itemId === e.itemId).map((s) => s.id)).toEqual(ids([e], true));
      }
    });

    it('only when one sentence is left do its steps follow each other', () => {
      expect(mixed([entry(1, 3), entry(2)])).toEqual([
        'a1-w1#chunk0', 'a1-w2#build', 'a1-w1#chunk1', 'a1-w2#type', 'a1-w1#chunk2', 'a1-w1#build', 'a1-w1#type',
      ]);
      expect(mixed([entry(1)])).toEqual(['a1-w1#build', 'a1-w1#type']);
    });

    it('a mistake sentence is one step among the others', () => {
      const mistake: SentenceEntry = { ...entry(2, 2), mistake: { wrong: 'frase mal' } };
      expect(mixed([entry(1), mistake], true)).toEqual(['a1-w1#listen', 'a1-w2#mistake', 'a1-w1#build', 'a1-w1#type']);
    });
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
