// PLAN-ketiranyu 4. lépés (2026-09-28): a data/pcic.ts irány-tudatos lett
// (en→es marad az alapértelmezett, es→en az újonnan bekötött második pár).
// Ez a teszt a modul-szintű setPcicTarget/getPcicTarget viselkedését és a
// két irány id-terének (w<id> / e<id>) elkülönülését fedi.

import {
  setPcicTarget,
  getPcicTarget,
  pcicItemsForLevel,
  findPcicItem,
  levelOfItem,
} from '../pcic';

describe('data/pcic.ts: irány-tudatos korpusz (PLAN-ketiranyu 4. lépés)', () => {
  afterEach(() => {
    // Ne szivárogjon át a modul-szintű állapot a következő tesztfájlba.
    setPcicTarget('es');
  });

  it('alapértelmezett cél "es" (en→es, a régi Kimacha Play viselkedés változatlan)', () => {
    expect(getPcicTarget()).toBe('es');
    const a1 = pcicItemsForLevel('A1');
    expect(a1.length).toBeGreaterThan(0);
    // PLAN-learn-words-open: az en→es pakli id-tere o<order> (data/words-open).
    expect(a1.every((item) => item.id.startsWith('o'))).toBe(true);
  });

  // PLAN-learn-words-open 1-2. lépés: a 4 szint 150-150 kártya a words-open
  // a1/a2/b1/b2.json-ból, order = a fájl order mezője (1-600), id = o<order>.
  it('en→es: A1/A2/B1/B2 = 242-151-150-150 words-open kártya (601 = tocar), o<order> id, egyedi id', () => {
    const levels = (['A1', 'A2', 'B1', 'B2'] as const).map((l) => pcicItemsForLevel(l));
    expect(levels.map((items) => items.length)).toEqual([242, 151, 150, 150]);
    const all = levels.flat();
    expect(new Set(all.map((item) => item.id)).size).toBe(693);
    expect(all.every((item) => item.id === `o${item.order}`)).toBe(true);
    expect(levels[0][0]).toMatchObject({ id: 'o1', es: 'yo', en: 'I', kind: 'word', pos: 'pron', exampleEs: undefined, exampleEn: undefined });
    expect(levelOfItem('o150')).toBe('A1');
    expect(levelOfItem('o151')).toBe('A2');
    expect(levelOfItem('o451')).toBe('B2');
    expect(levelOfItem('o600')).toBe('B2');
    // A régi w<id> id-tér nincs a betöltött korpuszban (a DB-sorok megmaradnak, csak nem jelennek meg).
    expect(findPcicItem('w1')).toBeUndefined();
  });

  it('en→es: példamondat a sentence_es/en-ből, pos-leképezés (det/interj nem képezhető le)', () => {
    expect(findPcicItem('o3')).toMatchObject({ pos: 'adv', exampleEs: 'Yo estoy bien.', exampleEn: 'I am fine.' });
    expect(findPcicItem('o15')?.pos).toBe('conj');
    expect(findPcicItem('o20')?.pos).toBeUndefined(); // det
    expect(findPcicItem('o7')?.pos).toBeUndefined(); // interj
  });

  // PLAN-ketiranyu 5. lépés (D-A döntés a): az A1 az data/words/en/a0.json
  // első 50 kártyáját adja, e<id> id-térrel; A2/B1/B2 marad üres (nincs rájuk terv).
  // PLAN-enb1: B1 = data/words/en/b1.json (CEFR-J), e10000-től; B2 üres.
  it('setPcicTarget("en")-re vált: A1 = en a0+a1, A2 = en a2, B1 = en b1, e<id>, angol szó egyszer; B2 üres', () => {
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

  it('a két irány id-tere külön él: es-es id "en" célnyelven nem oldódik fel, és fordítva', () => {
    setPcicTarget('es');
    const esItem = pcicItemsForLevel('A1')[0];
    expect(findPcicItem(esItem.id)).toEqual(esItem);

    setPcicTarget('en');
    expect(findPcicItem(esItem.id)).toBeUndefined();
    expect(levelOfItem(esItem.id)).toBeUndefined();
  });

  it('irányváltás után visszaváltva az es korpusz változatlan marad', () => {
    const before = pcicItemsForLevel('A1');
    setPcicTarget('en');
    setPcicTarget('es');
    expect(pcicItemsForLevel('A1')).toEqual(before);
  });
});
