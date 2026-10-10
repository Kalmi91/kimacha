import { getOpenWordsForLevel } from '@/data/openWords';
import { resolveGloss, buildGlossMap } from '../games/gloss';

// GlossText's data source. A token resolves either
// to a corpus card (isNew reflects the caller's "known" set) or to an
// authored override (story/myth "newWords"/"gloss"), and never to a blank.

describe('resolveGloss', () => {
  const word = getOpenWordsForLevel('A1')[0];

  it('resolves a corpus word and marks it new when not in knownWordIds', () => {
    const info = resolveGloss(word.es, { learnedLang: 'es', nativeLang: 'en' });
    expect(info).toBeDefined();
    expect(info!.wordId).toBe(word.id);
    expect(info!.learned).toBe(word.es);
    expect(info!.native).toBe(word.en);
    expect(info!.isNew).toBe(true);
  });

  it('marks a corpus word known when its id is in knownWordIds', () => {
    const info = resolveGloss(word.es, {
      learnedLang: 'es',
      nativeLang: 'en',
      knownWordIds: new Set([word.id]),
    });
    expect(info!.isNew).toBe(false);
  });

  it('falls back to an authored override for a word outside the corpus', () => {
    const info = resolveGloss('gazpacho', {
      learnedLang: 'es',
      nativeLang: 'en',
      overrides: { gazpacho: { en: 'cold tomato soup' } },
    });
    expect(info).toEqual({ learned: 'gazpacho', native: 'cold tomato soup', isNew: true });
  });

  it('returns undefined for a token with no corpus match and no override', () => {
    expect(resolveGloss('xyzxyz-not-a-word', { learnedLang: 'es', nativeLang: 'en' })).toBeUndefined();
  });
});

describe('buildGlossMap', () => {
  it('every entry in a resolved sentence is either known or glossable (the F0 core criterion)', () => {
    const w = getOpenWordsForLevel('A1').find((e) => typeof e.sentence_es === 'string' && e.sentence_es);
    expect(w).toBeDefined();
    const map = buildGlossMap(w!.sentence_es as string, { learnedLang: 'es', nativeLang: 'en' });
    for (const info of map.values()) {
      expect(info.isNew === false || (info.learned.length > 0 && info.native.length > 0)).toBe(true);
    }
  });

  it('keys entries by normalized token, deduping repeats', () => {
    const map = buildGlossMap('Hola hola HOLA', { learnedLang: 'es', nativeLang: 'en', overrides: { hola: { en: 'hi' } } });
    expect(map.size).toBe(1);
    expect(map.get('hola')).toEqual({ learned: 'Hola', native: 'hi', isNew: true });
  });
});
