// PLAN-fb0924 6. lépés (FB392/393): a ℹ️ jegyzet-adat (data/pcic/notes.json)
// tesztje. Valódi PCIC-korpuszt használ (findPcicItem), hogy egy törölt/
// átnevezett item-id azonnal kiderüljön, ne csendben vesszen el a gomb.

import notesRaw from '@/data/pcic/notes.json';
import { findPcicItem, pcicItemsForLevel, PCIC_LEVELS } from '@/data/pcic';
import { pcicNoteFor, pcicNoteText } from '../pcicNotes';

describe('pcic notes.json, minden id létező PCIC-item (őr)', () => {
  it('minden notes.json kulcs egy valódi PCIC-item id', () => {
    for (const id of Object.keys(notesRaw)) {
      expect(findPcicItem(id)).toBeDefined();
    }
  });

  it('a FB392/393 által kért 3 konkrét item mind ott van', () => {
    expect(Object.keys(notesRaw).sort()).toEqual(['a1-1b94c09a', 'a1-bbd0d81f', 'a1-f14e8374'].sort());
  });

  it('minden jegyzetnek van legalább en szövege', () => {
    for (const [id, note] of Object.entries(notesRaw as Record<string, { en?: string; hu?: string }>)) {
      expect(note.en?.length ?? 0).toBeGreaterThan(0);
      // Ellenőrzés: id még mindig feloldható (redundáns a fenti loop-pal, de
      // itt konkrét item-en, hogy egy jövőbeli id-mozgás azonnal kiderüljön).
      expect(findPcicItem(id)).toBeDefined();
    }
  });
});

describe('pcicNoteFor / pcicNoteText', () => {
  it('van jegyzete a haber (a1-1b94c09a) itemnek', () => {
    expect(pcicNoteFor('a1-1b94c09a')).toBeDefined();
    expect(pcicNoteText('a1-1b94c09a')).toContain('haber');
  });

  it('nincs jegyzete egy tetszőleges, nem-felsorolt itemnek', () => {
    const anyOtherItem = pcicItemsForLevel('A1').find((i) => !(i.id in (notesRaw as object)));
    expect(anyOtherItem).toBeDefined();
    expect(pcicNoteFor(anyOtherItem!.id)).toBeUndefined();
    expect(pcicNoteText(anyOtherItem!.id)).toBeUndefined();
  });

  it('hu nyelven is visszaadja a jegyzetet (mindhárom FB392/393 jegyzet ad hu szöveget is)', () => {
    expect(pcicNoteText('a1-1b94c09a', 'hu')).toContain('haber');
  });
});

// FB392/393 tartalom-ellenőrzés: a három item pontosan azt magyarázza, amit
// a feedback kért (nem csak azt, hogy VAN jegyzet, hanem hogy jó-e).
describe('a konkrét FB392/393 jegyzetek tartalma', () => {
  it('haber (a1-1b94c09a): kimondja a hay <-> haber kapcsolatot', () => {
    const text = pcicNoteText('a1-1b94c09a')!;
    expect(text).toMatch(/hay/i);
    expect(text).toMatch(/haber/i);
  });

  it('El piso tiene tres habitaciones. (a1-f14e8374): kimondja az ékezet-szabályt', () => {
    const text = pcicNoteText('a1-f14e8374')!;
    expect(text).toMatch(/accent/i);
    expect(text).toMatch(/habitaci/i);
  });

  it('habitación headword (a1-bbd0d81f): ugyanaz az ékezet-magyarázat', () => {
    const text = pcicNoteText('a1-bbd0d81f')!;
    expect(text).toMatch(/accent/i);
    expect(text).toMatch(/habitaci/i);
  });
});

// A guard teszt éles: ha egy item eltűnik/id-t vált a korpuszban, itt buknia
// kell, minden PCIC szinten végigfuttatva (nem csak A1-en).
describe('teljes korpusz-szintű ellenőrzés', () => {
  it('a notes.json egyetlen kulcsa sem hivatkozik nem létező szintre/id-re', () => {
    const allIds = new Set(PCIC_LEVELS.flatMap((level) => pcicItemsForLevel(level).map((i) => i.id)));
    for (const id of Object.keys(notesRaw)) {
      expect(allIds.has(id)).toBe(true);
    }
  });
});
