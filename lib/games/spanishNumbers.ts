// FB187, Kálmán 2026-09-08 (word:the rubbish / garbage): „szám és dátum gyakorlásra
// is kell egy játék. Olyan ami mondja spanyolul nekem meg le kell írnom akár a
// számot akár a dátumot. legyen két külön. Legyenek benne hónapok és napok is."
//
// A két diktálós játék tartalma nem JSON-ból jön, hanem generált: egy szám vagy egy
// dátum spanyol alakja szabály, nem szótári tétel, ezért írható és tesztelhető
// függvényként. Így a játék nem fogy el, és nem terheli a korpusz-auditot sem.

const UNITS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];

const TENS: Record<number, string> = {
  3: 'treinta', 4: 'cuarenta', 5: 'cincuenta', 6: 'sesenta',
  7: 'setenta', 8: 'ochenta', 9: 'noventa',
};

const HUNDREDS: Record<number, string> = {
  1: 'ciento', 2: 'doscientos', 3: 'trescientos', 4: 'cuatrocientos', 5: 'quinientos',
  6: 'seiscientos', 7: 'setecientos', 8: 'ochocientos', 9: 'novecientos',
};

export const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const WEEKDAYS_ES = [
  'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo',
];

/** 0-9999 spanyol alakja. Fölötte a játék úgysem kérdez. */
export function numberToSpanish(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 9999) throw new RangeError(`out of range: ${n}`);
  if (n < 30) return UNITS[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? TENS[t] : `${TENS[t]} y ${UNITS[u]}`;
  }
  if (n === 100) return 'cien';
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return rest === 0 ? HUNDREDS[h] : `${HUNDREDS[h]} ${numberToSpanish(rest)}`;
  }
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  // 1000 = „mil", nem „un mil"; 2000-től viszont kiírjuk a szorzót.
  const head = thousands === 1 ? 'mil' : `${numberToSpanish(thousands)} mil`;
  return rest === 0 ? head : `${head} ${numberToSpanish(rest)}`;
}

export function monthName(month: number): string {
  return MONTHS_ES[month - 1];
}

export function weekdayName(weekday: number): string {
  return WEEKDAYS_ES[weekday];
}

/**
 * Egy dátum kimondott alakja. A hónapnév kötelező, a hét napja opcionális
 * („Legyenek benne hónapok és napok is"), a nap sorszáma spanyolul tőszámnév
 * (quince de marzo), csak az elseje ünnepélyesebb alakja szokásos.
 */
export function dateToSpanish(day: number, month: number, weekday?: number): string {
  const core = `${numberToSpanish(day)} de ${monthName(month)}`;
  return weekday === undefined ? core : `${weekdayName(weekday)} ${core}`;
}
