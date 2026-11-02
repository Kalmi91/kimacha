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
  it('en→es: A1/A2/B1/B2/C1 = 512-1379-1619-892-280 words-open cards (601 = tocar), o<order> id, unique id', () => {
    const levels = (['A1', 'A2', 'B1', 'B2', 'C1'] as const).map((l) => pcicItemsForLevel(l));
    expect(levels.map((items) => items.length)).toEqual([512, 1379, 1619, 892, 280]);
    const all = levels.flat();
    expect(new Set(all.map((item) => item.id)).size).toBe(4682);
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

  // A1 = data/words/en a0 + a1 with the e<id> id space, A2 = a2.
  // B1 = data/words/en/b1.json (CEFR-J), from e10000; B2 = b2.json (CEFR-J), from e11000;
  // C1 = c1.json (the owner's Spanish deck headwords), from e12000.
  it('switches to setPcicTarget("en"): A1 = en a0+a1, A2 = en a2, B1/B2/C1 = en b1/b2/c1, e<id>, an English word once', () => {
    setPcicTarget('en');
    expect(getPcicTarget()).toBe('en');
    const a1 = pcicItemsForLevel('A1');
    const a2 = pcicItemsForLevel('A2');
    const b1 = pcicItemsForLevel('B1');
    const b2 = pcicItemsForLevel('B2');
    const c1 = pcicItemsForLevel('C1');
    expect(a1.length).toBeGreaterThan(1100);
    expect(a2.length).toBeGreaterThan(750);
    expect(b1.length).toBeGreaterThan(700);
    expect(b2.length).toBeGreaterThan(900);
    expect(c1.length).toBeGreaterThan(500);
    const all = [...a1, ...a2, ...b1, ...b2, ...c1];
    expect(all.every((item) => item.id.startsWith('e'))).toBe(true);
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
    expect(new Set(all.map((item) => item.en.trim().toLowerCase())).size).toBe(all.length);
    expect(a1[0].id).toBe('e5800');
    expect(b1[0].id).toBe('e10000');
    expect(b2[0].id).toBe('e11000');
    expect(c1[0].id).toBe('e12000');
    expect(levelOfItem('e11000')).toBe('B2');
    expect(levelOfItem('e12000')).toBe('C1');
  });

  // Every en B2/C1 card is a complete card (es, en and both sentences), and the Hungarian overlay
  // (hu→en) has a row with hu + sentence_hu for it: none of the new cards may reach the learner half-empty.
  it('the en B2/C1 cards are complete and every one has a Hungarian gloss row', () => {
    setPcicTarget('en');
    for (const level of ['B2', 'C1'] as const) {
      const items = pcicItemsForLevel(level);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.es.trim()).not.toBe('');
        expect(item.en.trim()).not.toBe('');
        expect((item.exampleEs ?? '').trim()).not.toBe('');
        expect((item.exampleEn ?? '').trim()).not.toBe('');
        expect((item.hu ?? '').trim()).not.toBe('');
        expect((item.exampleHu ?? '').trim()).not.toBe('');
      }
    }
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
