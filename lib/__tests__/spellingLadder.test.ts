import { spellingLadderDays } from '../spellingLadder';

describe('spellingLadderDays', () => {
  it('matches the fixed 1,3,4,8,16,32 steps then doubles', () => {
    const out = [0, 1, 2, 3, 4, 5, 6, 7].map(spellingLadderDays);
    expect(out).toEqual([1, 3, 4, 8, 16, 32, 64, 128]);
  });
});
