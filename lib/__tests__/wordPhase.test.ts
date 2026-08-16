import { wordPhase, phaseShape } from '@/lib/wordPhase';

// FB105: promotion counts SUCCESSFUL reviews, so a lapse takes a step back.
// FB109/FB111/FB114: the typing step must be reachable, it is the step that
// decides whether a word is learned.
describe('wordPhase', () => {
  it('starts a brand-new word on the learned→native flashcard', () => {
    expect(wordPhase({ reps: 0, lapses: 0 })).toBe(0);
  });

  it('moves to the reverse flashcard after one pass', () => {
    expect(wordPhase({ reps: 1, lapses: 0 })).toBe(1);
  });

  it('reaches the typing card after two passes', () => {
    expect(wordPhase({ reps: 2, lapses: 0 })).toBe(2);
  });

  it('demotes on every lapse', () => {
    expect(wordPhase({ reps: 2, lapses: 1 })).toBe(1);
    expect(wordPhase({ reps: 3, lapses: 3 })).toBe(0);
  });

  it('treats more lapses than reps as a fresh word', () => {
    expect(wordPhase({ reps: 1, lapses: 4 })).toBe(0);
  });

  it('tolerates missing counters', () => {
    expect(wordPhase({})).toBe(0);
  });
});

describe('phaseShape', () => {
  it('phase 0 is a flashcard in the default direction', () => {
    expect(phaseShape(0)).toEqual({ isTyping: false });
  });

  it('phase 1 is a flashcard native→learned', () => {
    expect(phaseShape(1)).toEqual({ isTyping: false, typingDirection: 'native-to-learned' });
  });

  it('phase 2 is the typing card native→learned', () => {
    expect(phaseShape(2)).toEqual({ isTyping: true, typingDirection: 'native-to-learned' });
  });
});
