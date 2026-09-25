// PLAN-fb0924 6. lépés (FB392/393): kézzel írt ℹ️ jegyzet PCIC-tételekre,
// a régi Learn fül `lib/cardNotes.ts` mintája (kivéve a fülével együtt),
// ÚJRA felépítve a PCIC id-térre. Adat: data/pcic/notes.json.

import notesRaw from '@/data/pcic/notes.json';

export interface PcicNote {
  en: string;
  hu?: string;
}

const NOTES = notesRaw as Record<string, PcicNote>;

/** Van-e jegyzet ehhez az id-hez (a ℹ️ gomb csak ekkor jelenik meg). */
export function pcicNoteFor(itemId: string): PcicNote | undefined {
  return NOTES[itemId];
}

/**
 * A jegyzet szövege a felület nyelvén; ha az adott nyelven nincs jegyzet,
 * en-re esik vissza. A Kimacha Play felülete ma mindig angol (lib/i18n/
 * index.ts, Kálmán 2026-09-22), tehát `uiLang` gyakorlatilag mindig 'en',
 * a `hu` mező a jegyzet adatában a jövőbeli/kézi olvasáshoz marad.
 */
export function pcicNoteText(itemId: string, uiLang: 'en' | 'hu' = 'en'): string | undefined {
  const note = NOTES[itemId];
  if (!note) return undefined;
  return note[uiLang] ?? note.en;
}
