// PLAN-fb1005d: a Learn (PCIC) kártyák adat-javításai Kálmán 2026-10-03/05 visszajelzései nyomán
// (FB473-479, 482-484, 486, 497). Minden tétel egy-egy teszt, hogy a javítás ne csússzon vissza.
import { findPcicItem, levelOfItem, setPcicTarget } from '../pcic';

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

  it('FB475-478: a lo / le / se kártyán (o84-86) kis angol mondat áll a kérdés alatt, mint a te (o83) kártyán', () => {
    expect(findPcicItem('o83')?.hint).toBeTruthy();
    for (const id of ['o84', 'o85', 'o86']) {
      expect(findPcicItem(id)?.hint).toMatch(/^[^*]*\*[^*]+\*[^*]*$/);
    }
  });
});
