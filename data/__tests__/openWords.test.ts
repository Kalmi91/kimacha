// a words-open WordEntry-alakú nézete (data/openWords.ts).
import { getOpenWordsForLevel, getOpenWordsUpToLevel, openLevelOf, openWords } from '../openWords';

describe('data/openWords.ts', () => {
  it('4442 cards, unique id (= order), A1-B2 512-1371-1537-1022', () => {
    expect(openWords).toHaveLength(4442);
    expect(new Set(openWords.map((w) => w.id)).size).toBe(4442);
    expect(getOpenWordsForLevel('A1')).toHaveLength(512);
    expect(getOpenWordsForLevel('A2')).toHaveLength(1371);
    expect(getOpenWordsForLevel('B1')).toHaveLength(1537);
    expect(getOpenWordsForLevel('B2')).toHaveLength(1022);
    expect(getOpenWordsForLevel('A0')).toEqual([]);
  });

  it('the fields come from the words-open card, the part of speech mapped to WordPos, the raw part of speech stays', () => {
    const yo = openWords.find((w) => w.id === 1)!;
    expect(yo).toMatchObject({ es: 'yo', en: 'I', hu: 'én', de: 'ich', level: 'A1', pos: 'pron', openPos: 'pron', lemma: 'yo' });
    const y = openWords.find((w) => w.es === 'y')!;
    expect(y.openPos).toBe('conj');
    expect(y.pos).toBeUndefined();
  });

  it('the noun gender comes from the article, a non-noun has no gender', () => {
    expect(openWords.find((w) => w.es === 'el perro')?.gender).toBe('m');
    expect(openWords.find((w) => w.es === 'la casa')?.gender).toBe('f');
    expect(openWords.filter((w) => w.openPos === 'noun' && !w.gender)).toEqual([]);
    expect(openWords.filter((w) => w.openPos !== 'noun' && w.gender !== undefined)).toEqual([]);
  });

  it('A0 falls to A1, C1/C2 to B2, the cumulative set goes back down to A1', () => {
    expect(openLevelOf('A0')).toBe('A1');
    expect(openLevelOf('C1')).toBe('B2');
    expect(openLevelOf('C2')).toBe('B2');
    expect(openLevelOf('B1')).toBe('B1');
    expect(getOpenWordsUpToLevel('A0')).toHaveLength(512);
    expect(getOpenWordsUpToLevel('A2')).toHaveLength(1883);
    expect(getOpenWordsUpToLevel('C2')).toHaveLength(4442);
  });
});
