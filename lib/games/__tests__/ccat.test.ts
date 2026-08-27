// GAMES.md 4.10 (ccat). K17: no spatial items, every item type here is
// vocabulary/logic-based; K19: only the short practice mode (10-25 items),
// no live-simulation mode exists to test. Coverage: each builder returns a
// well-formed item (unique options, correct answer present) or null when the
// input can't support one (never a guessed/invented answer), and the two
// motor-reuse item types (oddOneOut, sentenceFill) really do reuse the
// existing engines rather than duplicating their logic.

import {
  buildAntonymItem,
  buildSynonymItem,
  buildAnalogyItem,
  buildCcatOddOneOut,
  buildSentenceFillItem,
  buildAnagramItem,
  buildNumberSeriesItem,
  buildWordProblemItem,
  buildInstructionItem,
  CCAT_KINDS,
} from '../ccat';
import type { OddWordMeta } from '../oddOneOut';
import type { PoolEntry } from '../vocabPool';

function meta(wordId: number, opts: Partial<OddWordMeta> = {}): OddWordMeta {
  return { wordId, learned: `w${wordId}`, native: `n${wordId}`, isNew: false, ...opts };
}

function poolEntry(wordId: number, learned: string, opts: Partial<PoolEntry> = {}): PoolEntry {
  return { wordId, learned, native: `native-${wordId}`, level: 'A1', phase: 1, isNew: false, ...opts };
}

describe('CCAT_KINDS', () => {
  it('lists all 9 item types from GAMES.md 4.10', () => {
    expect(CCAT_KINDS).toHaveLength(9);
    expect(new Set(CCAT_KINDS).size).toBe(9);
  });
});

describe('buildAntonymItem / buildSynonymItem (authored es content)', () => {
  it('antonym: 4 unique options including the correct answer, for many seeds', () => {
    for (let seed = 0; seed < 20; seed++) {
      const item = buildAntonymItem('es', seed);
      expect(item).not.toBeNull();
      expect(item!.kind).toBe('antonym');
      expect(new Set(item!.options).size).toBe(item!.options.length);
      expect(item!.options.length).toBeGreaterThanOrEqual(3);
      expect(item!.correctIndex).toBeGreaterThanOrEqual(0);
      expect(item!.options[item!.correctIndex]).toBeTruthy();
      expect(item!.options).not.toContain(item!.word); // the prompt word itself is never an option
    }
  });

  it('synonym: same shape guarantee', () => {
    for (let seed = 0; seed < 20; seed++) {
      const item = buildSynonymItem('es', seed);
      expect(item).not.toBeNull();
      expect(item!.kind).toBe('synonym');
      expect(new Set(item!.options).size).toBe(item!.options.length);
    }
  });

  it('returns null for a language with no authored ccat content', () => {
    expect(buildAntonymItem('de', 0)).toBeNull();
    expect(buildSynonymItem('de', 0)).toBeNull();
  });
});

describe('buildAnalogyItem (derived from antonym/synonym pairs)', () => {
  it('a:b :: c:?, the correct completion is always present, options unique', () => {
    for (let seed = 0; seed < 30; seed++) {
      const item = buildAnalogyItem('es', seed);
      expect(item).not.toBeNull();
      expect(item!.a).toBeTruthy();
      expect(item!.b).toBeTruthy();
      expect(item!.c).toBeTruthy();
      expect(new Set(item!.options).size).toBe(item!.options.length);
      expect(item!.options[item!.correctIndex]).toBeTruthy();
      // the prompt words themselves never leak into the option list (would look like a glitch)
      expect(item!.options).not.toContain(item!.a);
      expect(item!.options).not.toContain(item!.c);
    }
  });

  it('returns null with no authored content', () => {
    expect(buildAnalogyItem('de', 0)).toBeNull();
  });
});

describe('buildCcatOddOneOut (wraps lib/games/oddOneOut.ts, no reimplementation)', () => {
  it('wraps a valid 4-item round with exactly one odd one out', () => {
    const pool: OddWordMeta[] = [
      ...Array.from({ length: 5 }, (_, i) => meta(i + 1, { topicId: 'comida' })),
      ...Array.from({ length: 5 }, (_, i) => meta(i + 10, { topicId: 'ropa' })),
    ];
    for (let seed = 0; seed < 15; seed++) {
      const item = buildCcatOddOneOut(pool, seed);
      expect(item).not.toBeNull();
      expect(item!.kind).toBe('oddOneOut');
      expect(item!.round.items).toHaveLength(4);
    }
  });

  it('returns null when the pool has no valid category', () => {
    const pool: OddWordMeta[] = [meta(1), meta(2)];
    expect(buildCcatOddOneOut(pool, 0)).toBeNull();
  });
});

describe('buildSentenceFillItem (wraps lib/games/grammarChoice.ts + real content)', () => {
  it('pulls a real grammar-choice item with valid options', () => {
    for (let seed = 0; seed < 10; seed++) {
      const item = buildSentenceFillItem('es', seed);
      expect(item).not.toBeNull();
      expect(item!.kind).toBe('sentenceFill');
      expect(item!.round.item.sentence).toContain('___');
      expect(item!.round.options.length).toBeGreaterThanOrEqual(2);
      expect(item!.round.options[item!.round.correctIndex]).toBeTruthy();
    }
  });

  it('returns null for a language with no grammar-choice topics', () => {
    expect(buildSentenceFillItem('de', 0)).toBeNull();
  });
});

describe('buildAnagramItem', () => {
  it('scrambles a real pool word, always different from the original, correct answer present', () => {
    const pool: PoolEntry[] = [
      poolEntry(1, 'perro'), poolEntry(2, 'gato'), poolEntry(3, 'casa'), poolEntry(4, 'libro'), poolEntry(5, 'coche'),
    ];
    for (let seed = 0; seed < 20; seed++) {
      const item = buildAnagramItem(pool, 'es', seed);
      expect(item).not.toBeNull();
      expect(item!.scrambled).not.toBe(item!.options[item!.correctIndex]);
      expect(item!.scrambled.split('').sort().join('')).toBe(item!.options[item!.correctIndex].split('').sort().join(''));
      expect(new Set(item!.options).size).toBe(item!.options.length);
    }
  });

  it('returns null with too few or too-short candidate words', () => {
    expect(buildAnagramItem([poolEntry(1, 'sol')], 'es', 0)).toBeNull(); // 3-letter word excluded, and pool too small anyway
    expect(buildAnagramItem([poolEntry(1, 'perro'), poolEntry(2, 'gato')], 'es', 0)).toBeNull(); // not enough candidates
  });

  it('never uses a multi-word entry (e.g. "yo hablo") as the scrambled target', () => {
    const pool: PoolEntry[] = [
      poolEntry(1, 'yo hablo'), poolEntry(2, 'tú hablas'), poolEntry(3, 'perro'), poolEntry(4, 'gato'), poolEntry(5, 'casa'),
    ];
    for (let seed = 0; seed < 10; seed++) {
      const item = buildAnagramItem(pool, 'es', seed);
      if (item) expect(item.options[item.correctIndex]).not.toContain(' ');
    }
  });
});

describe('buildNumberSeriesItem (ES-only, only numbers with a real card)', () => {
  it('builds a step-1 sequence from consecutive taught numbers', () => {
    const pool: PoolEntry[] = [
      poolEntry(1, 'cinco'), poolEntry(2, 'seis'), poolEntry(3, 'siete'), poolEntry(4, 'ocho'),
      poolEntry(5, 'diez'), poolEntry(6, 'once'), poolEntry(7, 'doce'), // extra numbers, so 3 distractors are available
    ];
    const item = buildNumberSeriesItem(pool, 'es', 1);
    expect(item).not.toBeNull();
    expect(item!.sequence).toEqual(['cinco', 'seis', 'siete']);
    expect(item!.options[item!.correctIndex]).toBe('ocho');
  });

  it('returns null for a non-Spanish learned language', () => {
    const pool: PoolEntry[] = [poolEntry(1, 'five'), poolEntry(2, 'six'), poolEntry(3, 'seven'), poolEntry(4, 'eight')];
    expect(buildNumberSeriesItem(pool, 'en', 0)).toBeNull();
  });

  it('returns null when the pool has no consecutive run of taught numbers', () => {
    const pool: PoolEntry[] = [poolEntry(1, 'dos'), poolEntry(2, 'veinte'), poolEntry(3, 'cien')];
    expect(buildNumberSeriesItem(pool, 'es', 0)).toBeNull();
  });

  it('never invents a number word not present in the pool as the correct answer', () => {
    const pool: PoolEntry[] = [
      poolEntry(1, 'once'), poolEntry(2, 'doce'), poolEntry(3, 'trece'), poolEntry(4, 'catorce'),
      poolEntry(5, 'veinte'), poolEntry(6, 'treinta'),
    ];
    const poolWords = new Set(pool.map((p) => p.learned));
    for (let seed = 0; seed < 10; seed++) {
      const item = buildNumberSeriesItem(pool, 'es', seed);
      if (item) for (const opt of item.options) expect(poolWords.has(opt)).toBe(true);
    }
  });
});

describe('buildWordProblemItem (authored es content)', () => {
  it('the correct numeric answer is present among the options', () => {
    for (let seed = 0; seed < 15; seed++) {
      const item = buildWordProblemItem('es', seed);
      expect(item).not.toBeNull();
      expect(item!.options[item!.correctIndex]).toBe(String(item!.item.answer));
      expect(new Set(item!.options).size).toBe(item!.options.length);
    }
  });

  it('returns null for a language with no authored word problems', () => {
    expect(buildWordProblemItem('de', 0)).toBeNull();
  });
});

describe('buildInstructionItem (topic AND gender conjunction from pool metadata)', () => {
  it('exactly one option satisfies BOTH the topic and the gender', () => {
    const pool: OddWordMeta[] = [
      meta(1, { pos: 'noun', topicId: 'comida', gender: 'f' }), // the only food+feminine word
      meta(2, { pos: 'noun', topicId: 'comida', gender: 'm' }),
      meta(3, { pos: 'noun', topicId: 'comida', gender: 'm' }),
      meta(4, { pos: 'noun', topicId: 'ropa', gender: 'f' }),
      meta(5, { pos: 'noun', topicId: 'ropa', gender: 'f' }),
      meta(6, { pos: 'noun', topicId: 'ropa', gender: 'm' }),
    ];
    for (let seed = 0; seed < 10; seed++) {
      const item = buildInstructionItem(pool, seed, 4);
      expect(item).not.toBeNull();
      // whichever (topic, gender) combo was picked, exactly one pool word satisfies both
      const trulyMatching = pool.filter((p) => p.topicId === item!.topicId && p.gender === item!.gender);
      expect(trulyMatching).toHaveLength(1);
      expect(item!.options[item!.correctIndex].wordId).toBe(trulyMatching[0].wordId);
    }
  });

  it('returns null when no (topic, gender) combo has both a match and enough non-matches', () => {
    const pool: OddWordMeta[] = [meta(1, { pos: 'noun', topicId: 'comida', gender: 'f' })];
    expect(buildInstructionItem(pool, 0, 5)).toBeNull();
  });
});
