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
    expect(a1.every((item) => item.id.startsWith('w'))).toBe(true);
  });

  // PLAN-ketiranyu 5. lépés (D-A döntés a): az A1 az data/words/en/a0.json
  // első 50 kártyáját adja, e<id> id-térrel; A2/B1/B2 marad üres (nincs rájuk terv).
  it('setPcicTarget("en")-re vált: A1 50 e<id> kártyát ad, A2/B1/B2 üres', () => {
    setPcicTarget('en');
    expect(getPcicTarget()).toBe('en');
    const a1 = pcicItemsForLevel('A1');
    expect(a1.length).toBe(50);
    expect(a1.every((item) => item.id.startsWith('e'))).toBe(true);
    expect(pcicItemsForLevel('A2')).toEqual([]);
    expect(pcicItemsForLevel('B1')).toEqual([]);
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
