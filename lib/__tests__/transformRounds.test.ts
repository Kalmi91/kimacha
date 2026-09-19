// FB316 (NYELVTAN.md NY10): a `pickTransformRound` egyetlen felelőssége, hogy
// legfeljebb `size` itemet adjon vissza, a legkevésbé gyakorolt előre sorolva.

import { pickTransformRound } from '@/lib/grammar/transformRounds';
import type { TransformItem } from '@/lib/grammar/lessonTypes';

function item(id: string): TransformItem {
  return {
    id,
    kind: 'transform',
    tense: { from: 'presente', to: 'indefinido' },
    prompt: { es: `es-${id}`, hu: `hu-${id}`, en: `en-${id}`, de: `de-${id}` },
    answer: `answer-${id}`,
    wordIds: ['1'],
    why: { hu: 'h', en: 'e', es: 's', de: 'd' },
  };
}

const fifteen = Array.from({ length: 15 }, (_, i) => item(`i${i}`));

describe('pickTransformRound', () => {
  it('returns at most `size` items', () => {
    const round = pickTransformRound(fifteen, {}, 10, 1);
    expect(round.length).toBe(10);
  });

  it('returns every item, unsorted-safe, when there are size or fewer', () => {
    const five = fifteen.slice(0, 5);
    const round = pickTransformRound(five, {}, 10, 1);
    expect(round.length).toBe(5);
    expect(new Set(round.map((i) => i.id))).toEqual(new Set(five.map((i) => i.id)));
  });

  it('never repeats an item within a round', () => {
    const round = pickTransformRound(fifteen, {}, 10, 42);
    const ids = round.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('puts less-practised items first', () => {
    const seenCounts: Record<string, number> = {};
    fifteen.forEach((it, i) => {
      // The first 5 items are already well-practised, the rest untouched (0).
      seenCounts[it.id] = i < 5 ? 9 : 0;
    });
    const round = pickTransformRound(fifteen, seenCounts, 10, 7);
    // All 10 picked items must be from the untouched (seen=0) pool: there are
    // exactly 10 of those (i5..i14), so the round is fully determined by seen.
    for (const it of round) {
      expect(seenCounts[it.id]).toBe(0);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = pickTransformRound(fifteen, {}, 10, 123);
    const b = pickTransformRound(fifteen, {}, 10, 123);
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
  });
});
