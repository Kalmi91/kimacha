import {
  bareSense,
  findPromptOverlaps,
  headwordLeaks,
  isConjugatedForm,
  normalizedPrompt,
  promptSenses,
} from '@/lib/promptOverlap';

describe('promptSenses / bareSense', () => {
  it('splits on " / ", lowercases and strips the article', () => {
    expect(promptSenses('The Cat / A Dog', 'en')).toEqual(['cat', 'dog']);
  });

  it('keeps the parenthesis as part of the sense', () => {
    expect(promptSenses('cold (illness)', 'en')).toEqual(['cold (illness)']);
  });

  it('strips only the trailing parenthesis for the bare sense', () => {
    expect(bareSense('cold (illness)')).toBe('cold');
    expect(bareSense('time (clock)')).toBe('time');
    expect(bareSense('cold')).toBe('cold');
  });

  it('normalizedPrompt rejoins the normalized senses', () => {
    expect(normalizedPrompt('the time / a moment', 'en')).toBe('time / moment');
  });
});

describe('isConjugatedForm', () => {
  it('flags a headword that carries a parenthesised form', () => {
    expect(isConjugatedForm('ir (fuimos)')).toBe(true);
    expect(isConjugatedForm('ir')).toBe(false);
  });
});

describe('findPromptOverlaps', () => {
  it('flags an exact overlap: two words with the identical normalized prompt', () => {
    const clusters = findPromptOverlaps(
      [
        { id: 1, headword: 'el resfriado', prompt: 'cold' },
        { id: 2, headword: 'frío', prompt: 'cold' },
      ],
      'en'
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind).toBe('exact');
    expect(clusters[0].words.map((w) => w.id).sort()).toEqual([1, 2]);
  });

  it('flags a partial overlap when a bare sense matches a parenthesised one (PROMPT-POLICY 2)', () => {
    const clusters = findPromptOverlaps(
      [
        { id: 1, headword: 'la hora', prompt: 'time (clock)' },
        { id: 2, headword: 'el tiempo', prompt: 'time' },
      ],
      'en'
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind).toBe('partial');
    expect(clusters[0].sense).toBe('time');
    expect(clusters[0].words.map((w) => w.id).sort()).toEqual([1, 2]);
  });

  it('accepts two different parenthesised senses, that is the policy fix itself (PROMPT-POLICY 2)', () => {
    const clusters = findPromptOverlaps(
      [
        { id: 1, headword: 'la hora', prompt: 'time (clock)' },
        { id: 2, headword: 'la vez', prompt: 'time (occasion)' },
        { id: 3, headword: 'el resfriado', prompt: 'cold (illness)' },
        { id: 4, headword: 'frío', prompt: 'cold (temperature)' },
      ],
      'en'
    );
    expect(clusters).toHaveLength(0);
  });

  it('flags a partial overlap through a shared sense inside a " / " prompt', () => {
    const clusters = findPromptOverlaps(
      [
        { id: 1, headword: 'seguir', prompt: 'to continue / to follow' },
        { id: 2, headword: 'perseguir', prompt: 'to chase / to follow' },
      ],
      'en'
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind).toBe('partial');
    expect(clusters[0].sense).toBe('to follow');
  });

  it('ignores leading articles when comparing the whole normalized prompt (exact)', () => {
    const clusters = findPromptOverlaps(
      [
        { id: 1, headword: 'el libro', prompt: 'the book' },
        { id: 2, headword: 'un libro viejo', prompt: 'a book' },
      ],
      'en'
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind).toBe('exact');
  });

  it('skips conjugated-form items entirely (PROMPT-POLICY 8)', () => {
    const clusters = findPromptOverlaps(
      [
        { id: 1, headword: 'ir (fuimos)', prompt: 'to go (we went)' },
        { id: 2, headword: 'ir (fuiste)', prompt: 'to go (you went)' },
      ],
      'en'
    );
    expect(clusters).toEqual([]);
  });

  it('leaves unrelated prompts alone', () => {
    const clusters = findPromptOverlaps(
      [
        { id: 1, headword: 'el perro', prompt: 'dog' },
        { id: 2, headword: 'el gato', prompt: 'cat' },
      ],
      'en'
    );
    expect(clusters).toEqual([]);
  });
});

describe('headwordLeaks (PROMPT-POLICY 12)', () => {
  it('flags the Spanish headword surfacing inside the English prompt', () => {
    const leaks = headwordLeaks([{ id: 1, headword: 'tratar', prompt: 'to try (tratar de + inf.)' }], 'en');
    expect(leaks).toHaveLength(1);
    expect(leaks[0].id).toBe(1);
  });

  it('accepts a cognate card, the prompt article-stripped equals the headword (PROMPT-POLICY 11/6)', () => {
    const leaks = headwordLeaks([{ id: 1, headword: 'el hotel', prompt: 'the hotel' }], 'en');
    expect(leaks).toEqual([]);
  });

  it('accepts a cognate inside a " / " prompt, one alternative equals the headword', () => {
    const leaks = headwordLeaks([{ id: 1, headword: 'interior', prompt: 'interior / inner' }], 'en');
    expect(leaks).toEqual([]);
  });

  it('does not run on a headword shorter than 3 letters', () => {
    const leaks = headwordLeaks([{ id: 1, headword: 'no', prompt: 'no, not' }], 'en');
    expect(leaks).toEqual([]);
  });

  // Valós korpusz-találatok (2026-09-18-i futtatás): a " / " mellett a
  // korpusz "/" és ", " alak-elválasztót is használ (ua. mint a
  // corpusIntegrity.test.ts "senses" helperje), ezek is cognate-ok, nem hiba.
  it('accepts a cognate joined by a bare slash, no surrounding spaces', () => {
    const leaks = headwordLeaks([{ id: 2095, headword: 'grave', prompt: 'serious/grave' }], 'en');
    expect(leaks).toEqual([]);
  });

  it('accepts a cognate joined by a comma', () => {
    const leaks = headwordLeaks([{ id: 2940, headword: 'fatal', prompt: 'terrible, fatal' }], 'en');
    expect(leaks).toEqual([]);
  });
});
