// Which build steps of a Sentences tab round are listening ones (lib/sentenceSteps.ts, BRIEF-B1).

import { buildStepKind } from '../sentenceSteps';
import { startRound } from '../sentenceRound';
import type { SentenceEntry } from '../sentenceTab';

const entry = (n: number): SentenceEntry => ({
  itemId: `a1-w${n}`, source: `Sentence ${n}.`, target: `frase ${n}`, wordCount: 2, wordIds: [`a1-w${n}`], due: false, dueIds: [], staleness: '', slots: [{ id: `a1-w${n}`, words: ['frase'] }],
});
const four = [1, 2, 3, 4].map(entry);
const round = startRound(four, entry(9), '2026-10-21', 'es');

describe('buildStepKind', () => {
  it('on: the 2nd and the 4th build are listening, the 1st and the 3rd normal', () => {
    expect(four.map((e) => buildStepKind(round, e.itemId, { listening: true, mistakes: false }))).toEqual(['normal', 'listening', 'normal', 'listening']);
  });

  it('off: every build is normal (today\'s behavior)', () => {
    expect(four.map((e) => buildStepKind(round, e.itemId, { listening: false, mistakes: false }))).toEqual(['normal', 'normal', 'normal', 'normal']);
  });

  it('the kind belongs to the sentence, not to its turn: a sentence that comes back after a wrong build keeps it', () => {
    // 1st sentence built wrong -> at the end of the queue; the 2nd is on screen first, then the 3rd, the 4th, the 1st again
    const wrongFirst = { ...round, queue: ['a1-w2', 'a1-w3', 'a1-w4', 'a1-w1'] };
    expect(wrongFirst.queue.map((id) => buildStepKind(wrongFirst, id, { listening: true, mistakes: false }))).toEqual(['listening', 'normal', 'listening', 'normal']);
  });

  it('a short round: one build is normal, a sentence that is not in the round is normal', () => {
    const one = startRound([entry(1)], entry(9), '2026-10-21', 'es');
    expect(buildStepKind(one, 'a1-w1', { listening: true, mistakes: false })).toBe('normal');
    expect(buildStepKind(round, 'a1-w9', { listening: true, mistakes: false })).toBe('normal');
  });

  it('a sentence from the mistake list is a mistake step while that switch is on, whatever its place; off = a plain build', () => {
    const withMistake = startRound([entry(1), entry(2), { ...entry(3), mistake: { wrong: 'frase mal' } }, entry(4)], entry(9), '2026-10-21', 'es');
    const kinds = (flags: { listening: boolean; mistakes: boolean }) => withMistake.entries.map((e) => buildStepKind(withMistake, e.itemId, flags));
    expect(kinds({ listening: true, mistakes: true })).toEqual(['normal', 'listening', 'mistake', 'listening']);
    expect(kinds({ listening: false, mistakes: true })).toEqual(['normal', 'normal', 'mistake', 'normal']);
    expect(kinds({ listening: true, mistakes: false })).toEqual(['normal', 'listening', 'normal', 'listening']);
    // at an odd place the mistake step still wins over the listening one
    const odd = startRound([entry(1), { ...entry(2), mistake: { wrong: 'x' } }], entry(9), '2026-10-21', 'es');
    expect(buildStepKind(odd, 'a1-w2', { listening: true, mistakes: true })).toBe('mistake');
  });
});
