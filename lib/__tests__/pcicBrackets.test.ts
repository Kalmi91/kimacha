// PLAN-fb0923 3. lepes (FB363/FB367), or-teszt: A1-B2 nyers `es` mezoben
// nincs paratlan `[`/`]` (a region-cimke szetszedett zarojel-parjai
// osszevonva), es ahol `region`/`mx` mezo van, az nem ures string.
import a1 from '../../data/pcic/a1-all.json';
import a2 from '../../data/pcic/a2-all.json';
import b1 from '../../data/pcic/b1-all.json';
import b2 from '../../data/pcic/b2-all.json';

interface RawItem {
  id: string;
  es: string;
  region?: string;
  mx?: string;
}

const LEVELS: Record<string, RawItem[]> = {
  A1: a1 as RawItem[],
  A2: a2 as RawItem[],
  B1: b1 as RawItem[],
  B2: b2 as RawItem[],
};

describe('PCIC zarojel-egyenszaz (FB363/FB367)', () => {
  for (const [level, items] of Object.entries(LEVELS)) {
    it(`${level}: nincs paratlan [ vagy ] az es mezoben`, () => {
      const unpaired = items
        .filter((i) => (i.es.match(/\[/g) || []).length !== (i.es.match(/\]/g) || []).length)
        .map((i) => i.id);
      expect(unpaired).toEqual([]);
    });

    it(`${level}: minden region mezo nem ures string`, () => {
      const bad = items.filter((i) => i.region !== undefined && i.region.trim() === '').map((i) => i.id);
      expect(bad).toEqual([]);
    });

    it(`${level}: minden mx mezo nem ures string`, () => {
      const bad = items.filter((i) => i.mx !== undefined && i.mx.trim() === '').map((i) => i.id);
      expect(bad).toEqual([]);
    });
  }
});
