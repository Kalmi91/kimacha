// GAMES.md 4.1 acceptance: "soha nem esik olyan szó, ami nincs a poolban" +
// "a generátor mindig pontosan 1 helyes választ ad".

import { buildFallingRound } from '../wordRain';
import type { PoolEntry } from '../vocabPool';

function entry(wordId: number, learned: string, native: string, isNew = false): PoolEntry {
  return { wordId, learned, native, level: 'A1', phase: 1, isNew };
}

const POOL: PoolEntry[] = [
  entry(1, 'perro', 'kutya'),
  entry(2, 'gato', 'macska'),
  entry(3, 'pero', 'de'),
  entry(4, 'pared', 'fal'),
  entry(5, 'puerta', 'ajtó'),
  entry(6, 'casa', 'ház'),
  entry(7, 'agua', 'víz'),
  entry(8, 'libro', 'könyv'),
];

describe('buildFallingRound', () => {
  it('always has exactly one target tile', () => {
    for (let seed = 0; seed < 50; seed++) {
      const round = buildFallingRound(POOL[0], POOL, {
        direction: 'forward',
        learnedLang: 'es',
        nativeLang: 'hu',
        fallingCount: 4,
        distractorMode: 'nearMiss',
        seed,
      });
      expect(round.words.filter((w) => w.isTarget)).toHaveLength(1);
    }
  });

  it('never falls a word that is not in the pool', () => {
    const learnedSet = new Set(POOL.map((p) => p.learned.toLowerCase()));
    for (let seed = 0; seed < 50; seed++) {
      const round = buildFallingRound(POOL[0], POOL, {
        direction: 'forward',
        learnedLang: 'es',
        nativeLang: 'hu',
        fallingCount: 5,
        distractorMode: 'nearMiss',
        seed,
      });
      for (const w of round.words) {
        expect(learnedSet.has(w.text.toLowerCase())).toBe(true);
      }
    }
  });

  it('the prompt is the source-language word, the falling target is the learned word (forward direction)', () => {
    const round = buildFallingRound(POOL[0], POOL, {
      direction: 'forward',
      learnedLang: 'es',
      nativeLang: 'hu',
      fallingCount: 4,
      distractorMode: 'nearMiss',
      seed: 1,
    });
    expect(round.prompt).toBe('kutya');
    const target = round.words.find((w) => w.isTarget)!;
    expect(target.text).toBe('perro');
  });

  it('reverses roles in the reverse direction', () => {
    const round = buildFallingRound(POOL[0], POOL, {
      direction: 'reverse',
      learnedLang: 'es',
      nativeLang: 'hu',
      fallingCount: 4,
      distractorMode: 'random',
      seed: 2,
    });
    expect(round.prompt).toBe('perro');
    const target = round.words.find((w) => w.isTarget)!;
    expect(target.text).toBe('kutya');
    const nativeSet = new Set(POOL.map((p) => p.native.toLowerCase()));
    for (const w of round.words) expect(nativeSet.has(w.text.toLowerCase())).toBe(true);
  });

  it('never has two tiles with the same text', () => {
    for (let seed = 0; seed < 50; seed++) {
      const round = buildFallingRound(POOL[1], POOL, {
        direction: 'forward',
        learnedLang: 'es',
        nativeLang: 'hu',
        fallingCount: 6,
        distractorMode: 'nearMiss',
        seed,
      });
      const texts = round.words.map((w) => w.text.toLowerCase());
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it('respects the requested falling count when the pool has enough distinct words', () => {
    const round = buildFallingRound(POOL[0], POOL, {
      direction: 'forward',
      learnedLang: 'es',
      nativeLang: 'hu',
      fallingCount: 4,
      distractorMode: 'random',
      seed: 3,
    });
    expect(round.words).toHaveLength(4);
  });
});
