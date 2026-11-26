// The WordEntry-shaped view of words-open (data/openWords.ts).
import { esFeminine, esPlural } from '@/lib/esInflect';
import { formsOfCard } from '@/lib/esForms';
import { conjugate, TENSES } from '@/lib/games/conjugate';
import { findOpenWordByForm, foldAccents, getOpenWordsForLevel, getOpenWordsUpToLevel, getOpenWords, openLevelOf } from '../openWords';

describe('data/openWords.ts', () => {
  it('4683 cards, unique id (= order), A1-C1 512-1379-1620-892-280', () => {
    expect(getOpenWords()).toHaveLength(4683);
    expect(new Set(getOpenWords().map((w) => w.id)).size).toBe(4683);
    expect(getOpenWordsForLevel('A1')).toHaveLength(512);
    expect(getOpenWordsForLevel('A2')).toHaveLength(1379);
    expect(getOpenWordsForLevel('B1')).toHaveLength(1620);
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
    expect(getOpenWordsUpToLevel('B2')).toHaveLength(4403);
    expect(getOpenWordsUpToLevel('C1')).toHaveLength(4683);
    expect(getOpenWordsUpToLevel('C2')).toHaveLength(4683);
  });

  it('foldAccents is NFD without combining marks, for every form the index folds (the table only skips normalize)', () => {
    const nfd = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, ''); // the fold before the table
    const deps = { conjugate, TENSES, esPlural, esFeminine };
    const forms = getOpenWords().flatMap((c) => [...formsOfCard(c.es, c.openPos, deps), c.es]).map((f) => f.trim().toLowerCase());
    expect(forms.length).toBeGreaterThan(100000);
    expect(forms.filter((f) => foldAccents(f) !== nfd(f))).toEqual([]);
    expect(['ayúdame', 'pingüino', 'año', 'ÉL', 'café', 'ångström', 'plain'].map(foldAccents)).toEqual(['ayudame', 'pinguino', 'ano', 'EL', 'cafe', 'angstrom', 'plain']);
  });

  it('the form index grown slice by slice answers as the whole index: the first card of a form wins, a miss is a miss', () => {
    const deps = { conjugate, TENSES, esPlural, esFeminine };
    const whole = new Map<string, number>();
    for (const c of getOpenWords()) {
      const forms = [...formsOfCard(c.es, c.openPos, deps), ...(c.openPos === 'verb' ? c.es.split(' / ') : [])];
      for (const f of forms) {
        const key = f.trim().toLowerCase();
        if (key && !whole.has(key)) whole.set(key, c.id);
      }
    }
    const keys = [...whole.keys()];
    // an early form first (only the first slice is indexed), then forms of every level, a miss, a form with an article
    const sample = [keys[3], ...keys.filter((_, i) => i % 499 === 0), keys[keys.length - 1], 'zzzqx', `el ${keys[7]}`];
    expect(sample.map((k) => findOpenWordByForm(k)?.id)).toEqual(sample.map((k) => whole.get(k.replace(/^el /, ''))));
    expect(findOpenWordByForm('verlo')?.es).toBe('ver');
  });
});
