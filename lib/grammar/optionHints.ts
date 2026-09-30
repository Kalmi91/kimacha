import type { Lang4 } from './lessonTypes';

// FB410 + FB411 (PLAN-fb0929 5. lépés), Kálmán 2026-09-29: „amable is identity?" és
// „kisbetűvel tedd még oda mintának, mi számít identitásnak". A "miért ez a mondat"
// feladat szabály-opciói (pl. „profesión, identidad (ser)") alatt kisbetűs, halvány sor
// mutatja, mi tartozik oda, két-három példával. A kulcs az opció ANGOL szövege
// (`text.en`), így a tanterv-adat (data/games/grammar/**) nem változik, és az új
// leckék opciói itt bővíthetők.
//
// Csak a ser/estar szabály-nevekhez van jelenleg (a `ser-estar` és a `to-be` lecke);
// ahol nincs bejegyzés, nem jelenik meg semmi.

const traits = 'Soy Ana, es médico, es amable';

export const OPTION_HINTS: Record<string, Lang4> = {
  // --- spanyol lecke (ser-estar) ---
  'profession, identity (ser)': {
    hu: `név, foglalkozás, jellem · ${traits}`,
    en: `name, job, character · ${traits}`,
    es: `nombre, profesión, carácter · ${traits}`,
    de: `Name, Beruf, Charakter · ${traits}`,
  },
  'origin (ser)': {
    hu: 'ország, város, nemzetiség · Soy de México, es mexicana',
    en: 'country, city, nationality · Soy de México, es mexicana',
    es: 'país, ciudad, nacionalidad · Soy de México, es mexicana',
    de: 'Land, Stadt, Nationalität · Soy de México, es mexicana',
  },
  'time, date (ser)': {
    hu: 'óra, nap, dátum · Son las tres, es lunes',
    en: 'hour, day, date · Son las tres, es lunes',
    es: 'hora, día, fecha · Son las tres, es lunes',
    de: 'Uhrzeit, Tag, Datum · Son las tres, es lunes',
  },
  'location (estar)': {
    hu: 'hol van valaki vagy valami · Estoy en casa, está en la mesa',
    en: 'where someone or something is · Estoy en casa, está en la mesa',
    es: 'dónde está alguien o algo · Estoy en casa, está en la mesa',
    de: 'wo jemand oder etwas ist · Estoy en casa, está en la mesa',
  },
  'temporary state (estar)': {
    hu: 'hangulat, egészség, éppen most · Estoy cansado, está enfermo',
    en: 'mood, health, right now · Estoy cansado, está enfermo',
    es: 'ánimo, salud, ahora mismo · Estoy cansado, está enfermo',
    de: 'Stimmung, Gesundheit, gerade jetzt · Estoy cansado, está enfermo',
  },
  'result of a change (estar)': {
    hu: 'egy cselekvés eredménye · La puerta está abierta',
    en: 'what is left after an action · La puerta está abierta',
    es: 'lo que queda tras una acción · La puerta está abierta',
    de: 'was nach einer Handlung übrig ist · La puerta está abierta',
  },
  // --- angol lecke (to-be), a példák angolul ---
  'identity, profession (ser meaning)': {
    hu: 'név, foglalkozás, jellem · I am Ana, she is a doctor, he is kind',
    en: 'name, job, character · I am Ana, she is a doctor, he is kind',
    es: 'nombre, profesión, carácter · I am Ana, she is a doctor, he is kind',
    de: 'Name, Beruf, Charakter · I am Ana, she is a doctor, he is kind',
  },
  'origin, identity (ser meaning)': {
    hu: 'ország, város, nemzetiség · I am from Mexico, she is Mexican',
    en: 'country, city, nationality · I am from Mexico, she is Mexican',
    es: 'país, ciudad, nacionalidad · I am from Mexico, she is Mexican',
    de: 'Land, Stadt, Nationalität · I am from Mexico, she is Mexican',
  },
  'location (estar meaning)': {
    hu: 'hol van valaki vagy valami · I am at home, the book is on the table',
    en: 'where someone or something is · I am at home, the book is on the table',
    es: 'dónde está alguien o algo · I am at home, the book is on the table',
    de: 'wo jemand oder etwas ist · I am at home, the book is on the table',
  },
  'temporary state (estar meaning)': {
    hu: 'hangulat, egészség, éppen most · I am tired, she is ill',
    en: 'mood, health, right now · I am tired, she is ill',
    es: 'ánimo, salud, ahora mismo · I am tired, she is ill',
    de: 'Stimmung, Gesundheit, gerade jetzt · I am tired, she is ill',
  },
};

/** A szabály-opció alatti példa-sor a lecke nyelvén, vagy undefined, ha nincs bejegyzés. */
export function optionHint(text: Lang4, lang: string): string | undefined {
  const hint = OPTION_HINTS[text.en];
  if (!hint) return undefined;
  return (hint as Record<string, string>)[lang] ?? hint.en;
}
