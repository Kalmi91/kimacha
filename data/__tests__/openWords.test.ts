// The WordEntry-shaped view of words-open (data/openWords.ts).
import { getOpenWordsForLevel, getOpenWordsUpToLevel, getOpenWords, openLevelOf } from '../openWords';

describe('data/openWords.ts', () => {
  it('4682 cards, unique id (= order), A1-C1 512-1379-1619-892-280', () => {
    expect(getOpenWords()).toHaveLength(4682);
    expect(new Set(getOpenWords().map((w) => w.id)).size).toBe(4682);
    expect(getOpenWordsForLevel('A1')).toHaveLength(512);
    expect(getOpenWordsForLevel('A2')).toHaveLength(1379);
    expect(getOpenWordsForLevel('B1')).toHaveLength(1619);
    expect(getOpenWordsForLevel('B2')).toHaveLength(892);
    expect(getOpenWordsForLevel('C1')).toHaveLength(280);
    expect(getOpenWordsForLevel('A0')).toEqual([]);
  });

  it('the fields come from the words-open card, the part of speech mapped to WordPos, the raw part of speech stays', () => {
    const yo = getOpenWords().find((w) => w.id === 1)!;
    expect(yo).toMatchObject({ es: 'yo', en: 'I', level: 'A1', pos: 'pron', openPos: 'pron', lemma: 'yo' });
    const y = getOpenWords().find((w) => w.es === 'y')!;
    expect(y.openPos).toBe('conj');
    expect(y.pos).toBeUndefined();
  });

  it('the noun gender comes from the article, a non-noun has no gender', () => {
    expect(getOpenWords().find((w) => w.es === 'el perro')?.gender).toBe('m');
    expect(getOpenWords().find((w) => w.es === 'la casa')?.gender).toBe('f');
    expect(getOpenWords().filter((w) => w.openPos === 'noun' && !w.gender)).toEqual([]);
    expect(getOpenWords().filter((w) => w.openPos !== 'noun' && w.gender !== undefined)).toEqual([]);
  });

  it('A0 falls to A1, C2 to C1, the cumulative set goes back down to A1', () => {
    expect(openLevelOf('A0')).toBe('A1');
    expect(openLevelOf('C1')).toBe('C1');
    expect(openLevelOf('C2')).toBe('C1');
    expect(openLevelOf('B1')).toBe('B1');
    expect(getOpenWordsUpToLevel('A0')).toHaveLength(512);
    expect(getOpenWordsUpToLevel('A2')).toHaveLength(1891);
    expect(getOpenWordsUpToLevel('B2')).toHaveLength(4402);
    expect(getOpenWordsUpToLevel('C1')).toHaveLength(4682);
    expect(getOpenWordsUpToLevel('C2')).toHaveLength(4682);
  });
});
