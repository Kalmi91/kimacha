// The adaptive placement test's ladder step,
// on simulated answer sequences: all right -> B2, all wrong -> A1, mixed -> intermediate level,
// and never more than 20 questions.

import type { PcicLevel } from '@/data/pcic';
import { mulberry32 } from '@/lib/shuffle';
import {
  PLACEMENT_BLOCK,
  PLACEMENT_MAX_QUESTIONS,
  placedLevel,
  placementAnswer,
  placementBreakdown,
  placementFinish,
  placementStart,
  placementVerdict,
  type PlacementState,
} from '../placement';

const LEVELS: PcicLevel[] = ['A1', 'A2', 'B1', 'B2'];

/** Plays through the ladder: the `policy` answers based on the current level and the question index. */
function play(levels: PcicLevel[], policy: (level: PcicLevel, asked: number) => boolean): PlacementState {
  let state = placementStart(levels);
  for (let guard = 0; !state.done && guard < 100; guard++) {
    state = placementAnswer(state, policy(state.current, state.asked));
  }
  return state;
}

/** The answers of one ladder step (5): the given number right, then wrong. */
const answers = (right: number) => Array.from({ length: PLACEMENT_BLOCK }, (_, i) => i < right);

/** The given answer sequence on the levels, consumed in order (separately per level). */
function scripted(plan: Partial<Record<PcicLevel, boolean[]>>) {
  const used: Partial<Record<PcicLevel, number>> = {};
  return (level: PcicLevel) => {
    const at = used[level] ?? 0;
    used[level] = at + 1;
    return plan[level]?.[at] ?? false;
  };
}

describe('placementVerdict', () => {
  it('at 5 questions per step: 4+ up, 3 middle, 2- down', () => {
    expect(placementVerdict({ asked: 5, correct: 5 })).toBe('pass');
    expect(placementVerdict({ asked: 5, correct: 4 })).toBe('pass');
    expect(placementVerdict({ asked: 5, correct: 3 })).toBe('mixed');
    expect(placementVerdict({ asked: 5, correct: 2 })).toBe('fail');
    expect(placementVerdict({ asked: 5, correct: 0 })).toBe('fail');
  });

  it('at two steps (10 questions): 8+ up, 5-7 middle, 4- down', () => {
    expect(placementVerdict({ asked: 10, correct: 8 })).toBe('pass');
    expect(placementVerdict({ asked: 10, correct: 7 })).toBe('mixed');
    expect(placementVerdict({ asked: 10, correct: 5 })).toBe('mixed');
    expect(placementVerdict({ asked: 10, correct: 4 })).toBe('fail');
  });
});

describe('placementStart', () => {
  it('starts from A2', () => {
    expect(placementStart(LEVELS).current).toBe('A2');
  });

  it('if there is no A2 data, from the lowest measurable level', () => {
    expect(placementStart(['A1', 'B1']).current).toBe('A1');
    expect(placementStart(['B1']).current).toBe('B1');
  });
});

describe('simulated answer rows (A1-B2)', () => {
  it('all right -> B2, stops at the top level (15 questions)', () => {
    const end = play(LEVELS, () => true);
    expect(end.done).toBe(true);
    expect(end.placed).toBe('B2');
    expect(end.asked).toBe(15);
  });

  it('all wrong -> A1, stops at the bottom level (10 questions)', () => {
    const end = play(LEVELS, () => false);
    expect(end.placed).toBe('A1');
    expect(end.asked).toBe(10);
  });

  it('knows A2, not B1 -> A2, decided between two neighboring levels (10 questions)', () => {
    const end = play(LEVELS, (level) => LEVELS.indexOf(level) <= 1);
    expect(end.placed).toBe('A2');
    expect(end.asked).toBe(10);
    expect(placementBreakdown(end)).toEqual([
      { level: 'A2', correct: 5, asked: 5 },
      { level: 'B1', correct: 0, asked: 5 },
    ]);
  });

  it('knows up to B1 -> B1 (15 questions)', () => {
    const end = play(LEVELS, (level) => LEVELS.indexOf(level) <= 2);
    expect(end.placed).toBe('B1');
    expect(end.asked).toBe(15);
  });

  it('fails A2, knows A1 -> A1', () => {
    const end = play(LEVELS, (level) => level === 'A1');
    expect(end.placed).toBe('A1');
    expect(end.asked).toBe(10);
    expect(placementBreakdown(end)).toEqual([
      { level: 'A1', correct: 5, asked: 5 },
      { level: 'A2', correct: 0, asked: 5 },
    ]);
  });

  it('A2 4/5, B1 2/5 -> A2 (the example of the screen description)', () => {
    const end = play(LEVELS, scripted({ A2: answers(4), B1: answers(2) }));
    expect(end.placed).toBe('A2');
    expect(placementBreakdown(end).map((b) => `${b.level} ${b.correct}/${b.asked}`)).toEqual(['A2 4/5', 'B1 2/5']);
  });
});

describe('middle result (3 out of 5)', () => {
  it('after the step it does not decide yet: stays on the same level', () => {
    let state = placementStart(LEVELS);
    for (const ok of answers(3)) state = placementAnswer(state, ok);
    expect(state.done).toBe(false);
    expect(state.current).toBe('A2');
    expect(state.asked).toBe(5);
    expect(state.blockAsked).toBe(0);
  });

  it('the second step decides together: 8/10 -> up', () => {
    const end = play(LEVELS, scripted({ A2: [...answers(3), ...answers(5)], B1: answers(2) }));
    expect(end.placed).toBe('A2');
    expect(placementBreakdown(end)[0]).toEqual({ level: 'A2', correct: 8, asked: 10 });
    expect(end.tallies.B1).toEqual({ asked: 5, correct: 2 });
  });

  it('the second step decides together: 4/10 -> down', () => {
    const end = play(LEVELS, scripted({ A2: [...answers(3), ...answers(1)], A1: answers(5) }));
    expect(end.placed).toBe('A1');
    expect(end.tallies.A2).toEqual({ asked: 10, correct: 4 });
  });

  it('6/10 stops at that level', () => {
    const end = play(LEVELS, scripted({ A2: [...answers(3), ...answers(3)] }));
    expect(end.placed).toBe('A2');
    expect(end.asked).toBe(10);
  });
});

describe('at most 20 questions', () => {
  it('after the 4th step it stops even if there would be an upper level', () => {
    // A2: 3/5 + 5/5 = 8/10 moves up; B1: 3/5 + 3/5 = 6/10 intermediate: 20 questions.
    const end = play(LEVELS, scripted({ A2: [...answers(3), ...answers(5)], B1: [...answers(3), ...answers(3)] }));
    expect(end.asked).toBe(PLACEMENT_MAX_QUESTIONS);
    expect(end.done).toBe(true);
    expect(end.placed).toBe('B1');
  });

  it('with random answers it never exceeds 20 questions, and it always gets decided', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed);
      // A different hit rate per level (out of 0, 0.3, 0.6, 0.9), so that every branch gets its turn.
      const rate = Object.fromEntries(LEVELS.map((l) => [l, [0, 0.3, 0.6, 0.9][Math.floor(rng() * 4)]])) as Record<PcicLevel, number>;
      const end = play(LEVELS, (level) => rng() < rate[level]);
      expect(end.done).toBe(true);
      expect(end.asked).toBeLessThanOrEqual(PLACEMENT_MAX_QUESTIONS);
      expect(end.asked % PLACEMENT_BLOCK).toBe(0);
      expect(LEVELS).toContain(end.placed);
    }
  });
});

describe('fewer levels', () => {
  it('es→en (A1, A2, B1): all right -> B1', () => {
    const end = play(['A1', 'A2', 'B1'], () => true);
    expect(end.placed).toBe('B1');
    expect(end.asked).toBe(10);
  });

  it('it stops even with a single level', () => {
    const end = play(['A1'], () => true);
    expect(end.placed).toBe('A1');
    expect(end.asked).toBe(PLACEMENT_BLOCK);
  });
});

describe('placementFinish / placedLevel', () => {
  it('early close gives a suggestion from the measurement so far', () => {
    let state = placementStart(LEVELS);
    for (const ok of answers(5)) state = placementAnswer(state, ok);
    expect(state.current).toBe('B1');
    const end = placementFinish(state);
    expect(end).toMatchObject({ done: true, placed: 'A2' });
  });

  it('if nothing is measured, the lowest level', () => {
    expect(placedLevel({ levels: LEVELS, tallies: {} })).toBe('A1');
  });

  it('a further answer does not change the closed state', () => {
    const end = play(LEVELS, () => true);
    expect(placementAnswer(end, false)).toBe(end);
  });
});
