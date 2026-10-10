// data/pcic.ts became direction-aware
// (en→es stays the default, es→en is the newly wired second pair).
// This test covers the behaviour of the module-level setPcicTarget/getPcicTarget and the
// separation of the id spaces of the two directions (w<id> / e<id>).

import {
  setPcicTarget,
  getPcicTarget,
  pcicItemsForLevel,
  findPcicItem,
  levelOfItem,
} from '../pcic';

describe('data/pcic.ts: direction-aware corpus', () => {
  afterEach(() => {
    // Do not let the module-level state leak into the next test file.
    setPcicTarget('es');
  });

  it('default target "es" (en→es, the old Kimacha Play behavior is unchanged)', () => {
    expect(getPcicTarget()).toBe('es');
    const a1 = pcicItemsForLevel('A1');
    expect(a1.length).toBeGreaterThan(0);
    // the id space of the en→es deck is o<order> (data/words-open).
    expect(a1.every((item) => item.id.startsWith('o'))).toBe(true);
  });

  // the 5 levels, from the words-open
  // a1/a2/b1/b2/c1.json, order = the file's order field, id = o<order>.
  it('en→es: A1/A2/B1/B2/C1 = 512-1371-1537-763-259 words-open cards (601 = tocar), o<order> id, unique id', () => {
    const levels = (['A1', 'A2', 'B1', 'B2', 'C1'] as const).map((l) => pcicItemsForLevel(l));
    expect(levels.map((items) => items.length)).toEqual([512, 1371, 1537, 763, 259]);
    const all = levels.flat();
    expect(new Set(all.map((item) => item.id)).size).toBe(4442);
    expect(all.every((item) => item.id === `o${item.order}`)).toBe(true);
    expect(levels[0][0]).toMatchObject({ id: 'o1', es: 'yo', en: 'I', kind: 'word', pos: 'pron', exampleEs: undefined, exampleEn: undefined });
    expect(levelOfItem('o150')).toBe('A1');
    expect(levelOfItem('o151')).toBe('A2');
    expect(levelOfItem('o451')).toBe('B2');
    expect(levelOfItem('o600')).toBe('B2');
    expect(levelOfItem('o4077')).toBe('B2');
    expect(levelOfItem('o1357')).toBe('C1');
    expect(levelOfItem('o3837')).toBe('C1');
    // The old w<id> id space is not in the loaded corpus (the DB rows stay, they just do not show up).
    expect(findPcicItem('w1')).toBeUndefined();
  });

  it('en→es: example sentence from sentence_es/en, pos mapping (det and interj too)', () => {
    expect(findPcicItem('o3')).toMatchObject({ pos: 'adv', exampleEs: 'Yo estoy bien.', exampleEn: 'I am fine.' });
    expect(findPcicItem('o15')?.pos).toBe('conj');
    expect(findPcicItem('o20')?.pos).toBe('det');
    expect(findPcicItem('o7')?.pos).toBe('interj');
    expect(findPcicItem('o883')?.pos).toBe('interj');
  });

  // A1 gives the first 50 cards of data/words/en/a0.json
  // with the e<id> id space; A2/B1/B2 stay empty (no plan for them).
  // B1 = data/words/en/b1.json (CEFR-J), from e10000; B2 is empty.
  it('switches to setPcicTarget("en"): A1 = en a0+a1, A2 = en a2, B1 = en b1, e<id>, an English word once; B2 empty', () => {
    setPcicTarget('en');
    expect(getPcicTarget()).toBe('en');
    const a1 = pcicItemsForLevel('A1');
    const a2 = pcicItemsForLevel('A2');
    const b1 = pcicItemsForLevel('B1');
    expect(a1.length).toBeGreaterThan(1100);
    expect(a2.length).toBeGreaterThan(750);
    expect(b1.length).toBeGreaterThan(700);
    const all = [...a1, ...a2, ...b1];
    expect(all.every((item) => item.id.startsWith('e'))).toBe(true);
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
    expect(new Set(all.map((item) => item.en.trim().toLowerCase())).size).toBe(all.length);
    expect(a1[0].id).toBe('e5800');
    expect(b1[0].id).toBe('e10000');
    expect(pcicItemsForLevel('B2')).toEqual([]);
  });

  it('the id spaces of the two directions live apart: an es-es id does not resolve on the "en" target language, and vice versa', () => {
    setPcicTarget('es');
    const esItem = pcicItemsForLevel('A1')[0];
    expect(findPcicItem(esItem.id)).toEqual(esItem);

    setPcicTarget('en');
    expect(findPcicItem(esItem.id)).toBeUndefined();
    expect(levelOfItem(esItem.id)).toBeUndefined();
  });

  it('after switching direction and back the es corpus stays unchanged', () => {
    const before = pcicItemsForLevel('A1');
    setPcicTarget('en');
    setPcicTarget('es');
    expect(pcicItemsForLevel('A1')).toEqual(before);
  });
});
