// PLAN-fb0924 6. lépés (FB392/393): kézzel írt ℹ️ jegyzet PCIC-tételekre.
// PLAN-ketiranyu 2. lépés (2026-09-28): a data/pcic/notes.json (PCIC-id-tér)
// helyett a betöltött item saját noteEn/noteHu mezőjéből olvas (data/pcic.ts,
// a lib/cardNotes.ts hibrid ℹ️ jegyzete, FB75, a szó note_en/note_hu mezőjéből
// mappelve). A két exportált függvény aláírása változatlan.

import { findPcicItem } from '@/data/pcic';

export interface PcicNote {
  en: string;
  hu?: string;
}

/** Van-e jegyzet ehhez az id-hez (a ℹ️ gomb csak ekkor jelenik meg). */
export function pcicNoteFor(itemId: string): PcicNote | undefined {
  const item = findPcicItem(itemId);
  if (!item?.noteEn) return undefined;
  return { en: item.noteEn, hu: item.noteHu };
}

/**
 * A jegyzet szövege a felület nyelvén; ha az adott nyelven nincs jegyzet,
 * en-re esik vissza. A Kimacha Play felülete ma mindig angol (lib/i18n/
 * index.ts, Kálmán 2026-09-22), tehát `uiLang` gyakorlatilag mindig 'en',
 * a `hu` mező a jegyzet adatában a jövőbeli/kézi olvasáshoz marad.
 */
export function pcicNoteText(itemId: string, uiLang: 'en' | 'hu' = 'en'): string | undefined {
  const note = pcicNoteFor(itemId);
  if (!note) return undefined;
  return note[uiLang] ?? note.en;
}
