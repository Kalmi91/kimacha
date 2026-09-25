// PLAN-fb0924 6. lépés (FB392/393): a nyelvi visszaesés (hu hiányzik -> en)
// külön fájlban, mockolt notes.json-nal, hogy ne kelljen a valódi adatba
// egy csak-en jegyzetet felvenni csak a teszt kedvéért.

jest.mock('@/data/pcic/notes.json', () => ({
  'en-only': { en: 'only english' },
  'en-and-hu': { en: 'english text', hu: 'magyar szöveg' },
}));

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
