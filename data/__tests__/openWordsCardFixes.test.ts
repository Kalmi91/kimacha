// PLAN-fb1005d: a Learn (PCIC) kártyák adat-javításai Kálmán 2026-10-03/05 visszajelzései nyomán
// (FB473-479, 482-484, 486, 497). Minden tétel egy-egy teszt, hogy a javítás ne csússzon vissza.
import { gradePcicAnswer } from '@/lib/pcicMatch';
import { dropOrphanCards } from '@/lib/pcicSession';
import type { Sm2Card } from '@/lib/sm2';
import retired from '../../scripts/words-open-retired.json';
import { findPcicItem, levelOfItem, pcicItemsForLevel, setPcicTarget } from '../pcic';

describe('data/words-open kártya-javítások (FB1005d)', () => {
  beforeEach(() => setPcicTarget('es'));
  afterEach(() => setPcicTarget('es'));

  it('FB473: az adelante (o896) mondata egyértelmű irány-mondat, nem a "va adelante" autós félreérthető', () => {
    const item = findPcicItem('o896');
    expect(item?.exampleEs).toBe('La tienda está adelante, no muy lejos.');
    expect(item?.exampleEn).toBe('The store is up ahead, not very far.');
  });

  it('FB474: a ser kártya (o11) mondata csak a serrel jó, nincs benne ser/estar-kétértelmű melléknév', () => {
    const ex = findPcicItem('o11')?.exampleEs ?? '';
    expect(ex).not.toBe('');
    expect(ex).not.toMatch(/\b(feliz|contento|triste|aburrid[oa]|list[oa]|buen[oa]|mal[oa]|cansad[oa]|nervios[oa])\b/i);
    expect(ex).toMatch(/\b(soy|eres|es|somos|son)\b/i);
    expect(ex).not.toMatch(/\b(estoy|estás|está|estamos|están)\b/i);
  });

  it('FB479: a ropero kártya (o675) mondata az első jó választ (ropero) használja, nem az armariót', () => {
    const item = findPcicItem('o675');
    expect(item?.es).toBe('el ropero / el armario');
    expect(item?.exampleEs).toMatch(/\bropero\b/);
    expect(item?.exampleEs).not.toMatch(/\barmario\b/);
  });

  it('FB483: minden kérdőszó A1-en van (cómo, dónde, qué, quién, cuál, cuándo, cuánto, adónde)', () => {
    const orders = { cómo: 90, dónde: 91, qué: 92, quién: 93, cuál: 160, cuándo: 161, cuánto: 162, adónde: 737 };
    for (const [word, order] of Object.entries(orders)) {
      expect({ word, level: levelOfItem(`o${order}`) }).toEqual({ word, level: 'A1' });
      expect(findPcicItem(`o${order}`)?.es).toBe(word);
    }
  });

  it('FB484: a todavía (o178) kérdés alatti mondata és a felfedett példamondata ugyanazt a jelentést (still) hordozza', () => {
    const item = findPcicItem('o178');
    expect(item?.hint).toMatch(/\*still\*/i);
    expect(item?.exampleEn).toMatch(/\bstill\b/i);
    expect(item?.exampleEn).not.toMatch(/\byet\b/i);
  });

  it('FB486: nincs külön jitomate-kártya, a tomate (o940) kártyán a jitomate is elfogadott válasz', () => {
    const item = findPcicItem('o940');
    expect(item?.es).toBe('el tomate / el jitomate');
    expect(item?.en).toBe('tomato');
    expect(gradePcicAnswer('el jitomate', item!.es)).toMatchObject({ match: 'exact', best: 'el jitomate' });
    expect(gradePcicAnswer('el tomate', item!.es)).toMatchObject({ match: 'exact', best: 'el tomate' });
    const all = (['A1', 'A2', 'B1', 'B2'] as const).flatMap((l) => pcicItemsForLevel(l));
    expect(all.filter((i) => i.es.split(' / ')[0].replace(/^el /, '') === 'jitomate')).toEqual([]);
  });

  it('FB497: a taquería (o2705) kikerült a Learn-ből, az order nem használható újra, a többi order nem csúszott, az árva SRS-sort az app kihagyja', () => {
    expect(findPcicItem('o2705')).toBeUndefined();
    expect(retired.retired.map((r) => r.order)).toContain(2705);
    const all = (['A1', 'A2', 'B1', 'B2'] as const).flatMap((l) => pcicItemsForLevel(l));
    const orders = new Set(all.map((i) => i.order));
    for (const r of retired.retired) expect(orders.has(r.order)).toBe(false);
    // a szomszédos orderek ugyanazok a kártyák maradtak
    expect(findPcicItem('o2704')?.order).toBe(2704);
    expect(findPcicItem('o2706')?.order).toBe(2706);
    // az eltűnt kártya haladás-sora árva: a session kihagyja
    const orphan = { itemId: 'o2705', state: 'review' } as Sm2Card;
    expect(dropOrphanCards([orphan], (id) => findPcicItem(id) !== undefined)).toEqual([]);
  });

  it('FB475-478: a lo / le / se kártyán (o84-86) kis angol mondat áll a kérdés alatt, mint a te (o83) kártyán', () => {
    expect(findPcicItem('o83')?.hint).toBeTruthy();
    for (const id of ['o84', 'o85', 'o86']) {
      expect(findPcicItem(id)?.hint).toMatch(/^[^*]*\*[^*]+\*[^*]*$/);
    }
  });
});
