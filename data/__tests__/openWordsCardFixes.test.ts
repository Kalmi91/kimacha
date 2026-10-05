// PLAN-fb1005d: a Learn (PCIC) kártyák adat-javításai Kálmán 2026-10-03/05 visszajelzései nyomán
// (FB473-479, 482-484, 486, 497). Minden tétel egy-egy teszt, hogy a javítás ne csússzon vissza.
import { findPcicItem, setPcicTarget } from '../pcic';

describe('data/words-open kártya-javítások (FB1005d)', () => {
  beforeEach(() => setPcicTarget('es'));
  afterEach(() => setPcicTarget('es'));

  it('FB473: az adelante (o896) mondata egyértelmű irány-mondat, nem a "va adelante" autós félreérthető', () => {
    const item = findPcicItem('o896');
    expect(item?.exampleEs).toBe('La tienda está adelante, no muy lejos.');
    expect(item?.exampleEn).toBe('The store is up ahead, not very far.');
  });
});
