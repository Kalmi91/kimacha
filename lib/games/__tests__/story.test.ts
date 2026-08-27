import { collectNewWords, shuffledQuestionOptions } from '../story';
import type { StoryData, StoryScene } from '../content';

function scene(over: Partial<StoryScene>): StoryScene {
  return { id: 's1', text: { es: 'Hola.' }, ...over };
}

function story(scenes: StoryScene[]): StoryData {
  return { id: 'x', level: 'A1', track: 'cdmx', title: { es: 'X' }, cover: '📖', estMinutes: 3, scenes };
}

describe('collectNewWords', () => {
  it('dedupes across scenes, keeping first-appearance order', () => {
    const s = story([
      scene({ newWords: [{ word: 'mercado', gloss: { hu: 'piac' } }] }),
      scene({ newWords: [{ word: 'Mercado', gloss: { hu: 'piac' } }, { word: 'tomate', gloss: { hu: 'paradicsom' } }] }),
    ]);
    expect(collectNewWords(s).map((w) => w.word)).toEqual(['mercado', 'tomate']);
  });

  it('returns [] when no scene has newWords', () => {
    const s = story([scene({}), scene({})]);
    expect(collectNewWords(s)).toEqual([]);
  });
});

describe('shuffledQuestionOptions', () => {
  it('returns null when the scene has no question', () => {
    expect(shuffledQuestionOptions(scene({}), 1)).toBeNull();
  });

  it('keeps the correct option flagged after shuffling', () => {
    const sc = scene({
      question: {
        prompt: { hu: '?' },
        options: [{ es: 'a' }, { es: 'b', correct: true }, { es: 'c' }],
      },
    });
    for (let seed = 0; seed < 20; seed++) {
      const result = shuffledQuestionOptions(sc, seed)!;
      expect(result.options[result.correctIndex].correct).toBe(true);
      expect(result.options).toHaveLength(3);
    }
  });

  it('is deterministic for a given seed', () => {
    const sc = scene({
      question: { prompt: { hu: '?' }, options: [{ es: 'a' }, { es: 'b', correct: true }, { es: 'c' }] },
    });
    const r1 = shuffledQuestionOptions(sc, 42)!;
    const r2 = shuffledQuestionOptions(sc, 42)!;
    expect(r1.options.map((o) => o.es)).toEqual(r2.options.map((o) => o.es));
  });
});
