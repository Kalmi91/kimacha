import { CLASS_OPTIONS, buildWordClassRound, canPlayWordClass, isQuizzableClass } from '../wordClass';
import { getWordsForLevel, type WordEntry } from '@/data/words';

const a1 = getWordsForLevel('A1', 'es');

describe('isQuizzableClass', () => {
  it('takes the four classes the game asks about', () => {
    for (const cls of CLASS_OPTIONS) expect(isQuizzableClass(cls)).toBe(true);
  });

  it('leaves out the classes that are too rare or not a single word', () => {
    // `phrase` is a multi-word expression, so it has no single word class.
    for (const cls of ['pron', 'prep', 'num', 'phrase', undefined]) {
      expect(isQuizzableClass(cls)).toBe(false);
    }
  });
});

describe('buildWordClassRound', () => {
  it('asks ten questions from the A1 vocabulary', () => {
    const round = buildWordClassRound(a1, 'es', 'hu', 99, 10);
    expect(round).toHaveLength(10);
    for (const item of round) {
      expect(item.prompt.length).toBeGreaterThan(0);
      expect(item.gloss.length).toBeGreaterThan(0);
      expect(CLASS_OPTIONS).toContain(item.answer);
    }
  });

  it('labels every word with its own class from the corpus', () => {
    const byId = new Map(a1.map((w) => [w.id, w]));
    for (const item of buildWordClassRound(a1, 'es', 'hu', 5, 10)) {
      expect(byId.get(item.wordId)?.pos).toBe(item.answer);
    }
  });

  it('spreads the answers across the classes, so guessing "noun" cannot win', () => {
    // A1-en 566 főnév áll 8 határozószóval szemben; körbejárás nélkül a kör
    // majdnem csupa főnév lenne.
    const answers = buildWordClassRound(a1, 'es', 'hu', 7, 8).map((i) => i.answer);
    expect(new Set(answers).size).toBeGreaterThanOrEqual(3);
    const nouns = answers.filter((a) => a === 'noun').length;
    expect(nouns).toBeLessThanOrEqual(answers.length / 2);
  });

  it('never repeats a word inside one round', () => {
    const ids = buildWordClassRound(a1, 'es', 'hu', 11, 10).map((i) => i.wordId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is deterministic per seed', () => {
    expect(buildWordClassRound(a1, 'es', 'hu', 3, 6)).toEqual(buildWordClassRound(a1, 'es', 'hu', 3, 6));
  });

  it('stops instead of looping when the pool runs dry', () => {
    const tiny = a1.filter((w) => w.pos === 'adv').slice(0, 2);
    const round = buildWordClassRound(tiny, 'es', 'hu', 1, 10);
    expect(round.length).toBe(2);
  });
});

describe('canPlayWordClass', () => {
  it('needs at least two classes present', () => {
    expect(canPlayWordClass(a1)).toBe(true);
    expect(canPlayWordClass(a1.filter((w) => w.pos === 'noun'))).toBe(false);
    expect(canPlayWordClass([] as WordEntry[])).toBe(false);
  });
});
