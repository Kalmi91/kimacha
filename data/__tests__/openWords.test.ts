// PLAN-regi-szavak-ki 5. lépés: a words-open WordEntry-alakú nézete (data/openWords.ts).
import { getOpenWordsForLevel, getOpenWordsUpToLevel, openLevelOf, openWords } from '../openWords';

describe('data/openWords.ts', () => {
  it('601 kártya, egyedi id (= order), A1-B2 150-151-150-150', () => {
    expect(openWords).toHaveLength(601);
    expect(new Set(openWords.map((w) => w.id)).size).toBe(601);
    expect(getOpenWordsForLevel('A1')).toHaveLength(150);
    expect(getOpenWordsForLevel('A2')).toHaveLength(151);
    expect(getOpenWordsForLevel('B1')).toHaveLength(150);
    expect(getOpenWordsForLevel('B2')).toHaveLength(150);
    expect(getOpenWordsForLevel('A0')).toEqual([]);
  });

  it('a mezők a words-open kártyáról jönnek, a szófaj a WordPos-ra képezve, a nyers szófaj megmarad', () => {
    const yo = openWords.find((w) => w.id === 1)!;
    expect(yo).toMatchObject({ es: 'yo', en: 'I', hu: 'én', de: 'ich', level: 'A1', pos: 'pron', openPos: 'pron', lemma: 'yo' });
    const y = openWords.find((w) => w.es === 'y')!;
    expect(y.openPos).toBe('conj');
    expect(y.pos).toBeUndefined();
  });

  it('a főnév neme a névelőből jön, nem főnévnek nincs neme', () => {
    expect(openWords.find((w) => w.es === 'el perro')?.gender).toBe('m');
    expect(openWords.find((w) => w.es === 'la casa')?.gender).toBe('f');
    expect(openWords.filter((w) => w.openPos === 'noun' && !w.gender)).toEqual([]);
    expect(openWords.filter((w) => w.openPos !== 'noun' && w.gender !== undefined)).toEqual([]);
  });

  it('az A0 az A1-re, a C1/C2 a B2-re esik, a kumulatív halmaz A1-ig visszamegy', () => {
    expect(openLevelOf('A0')).toBe('A1');
    expect(openLevelOf('C1')).toBe('B2');
    expect(openLevelOf('C2')).toBe('B2');
    expect(openLevelOf('B1')).toBe('B1');
    expect(getOpenWordsUpToLevel('A0')).toHaveLength(150);
    expect(getOpenWordsUpToLevel('A2')).toHaveLength(301);
    expect(getOpenWordsUpToLevel('C2')).toHaveLength(601);
  });
});
