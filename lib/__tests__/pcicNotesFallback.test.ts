// PLAN-fb0924 6. lépés (FB392/393): a nyelvi visszaesés (hu hiányzik -> en)
// külön fájlban, mockolt itemekkel, hogy ne kelljen a valódi adatba egy
// csak-en jegyzetet felvenni csak a teszt kedvéért.
// PLAN-ketiranyu 2. lépés (2026-09-28): pcicNotes.ts mostantól a data/pcic.ts
// item.noteEn/noteHu mezőjéből olvas (nem a notes.json fájlból), ezért a mock
// a `@/data/pcic` findPcicItem-jét adja, nem a nyers JSON-t.

jest.mock('@/data/pcic', () => {
  const items: Record<string, { noteEn?: string; noteHu?: string }> = {
    'en-only': { noteEn: 'only english' },
    'en-and-hu': { noteEn: 'english text', noteHu: 'magyar szöveg' },
  };
  return { findPcicItem: (id: string) => items[id] };
});

import { pcicNoteFor, pcicNoteText } from '../pcicNotes';

describe('pcicNoteText, nyelvi visszaesés', () => {
  it('hu-t kér, de csak en van -> en-t adja vissza', () => {
    expect(pcicNoteText('en-only', 'hu')).toBe('only english');
  });

  it('hu-t kér, és van hu -> hu-t adja vissza', () => {
    expect(pcicNoteText('en-and-hu', 'hu')).toBe('magyar szöveg');
  });

  it('paraméter nélkül en-t ad (az alapértelmezett felület-nyelv)', () => {
    expect(pcicNoteText('en-and-hu')).toBe('english text');
  });

  it('nincs jegyzet -> undefined, nem dob hibát', () => {
    expect(pcicNoteFor('no-such-id')).toBeUndefined();
    expect(pcicNoteText('no-such-id')).toBeUndefined();
  });
});
