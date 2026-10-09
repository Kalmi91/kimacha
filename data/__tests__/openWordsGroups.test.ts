// the closed word groups (cardinal numbers, days, months, seasons, basic colours, the
// closest family, question words) sit on one level in words-open: A1. After a new card/reorder
// they must stay together too (moving changes neither order nor id, only the file).
import { openWords } from '../openWords';

const GROUPS: Record<string, string[]> = {
  alapszámok: [
    'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece',
    'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'treinta', 'cuarenta',
    'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa', 'cien', 'doscientos', 'quinientos', 'mil',
  ],
  napok: ['el lunes', 'el martes', 'el miércoles', 'el jueves', 'el viernes', 'el sábado', 'el domingo'],
  hónapok: [
    'el enero', 'el febrero', 'el marzo', 'el abril', 'el mayo', 'el junio', 'el julio', 'el agosto',
    'el septiembre', 'el octubre', 'el noviembre', 'el diciembre',
  ],
  évszakok: ['la primavera', 'el verano', 'el otoño', 'el invierno'],
  alapszínek: ['rojo', 'azul', 'verde', 'amarillo', 'morado', 'rosa', 'negro', 'blanco', 'gris', 'anaranjado'],
  család: [
    'la madre', 'el padre', 'la mamá', 'el papá', 'el hermano', 'el hijo', 'el abuelo', 'la abuela', 'el tío',
    'la tía', 'el primo', 'el esposo', 'la esposa', 'el novio', 'la novia',
  ],
  kérdőszavak: ['cuándo', 'cuál'],
};

describe('data/words-open closed word groups at one level', () => {
  for (const [name, list] of Object.entries(GROUPS)) {
    it(`${name}: all present, and all A1`, () => {
      const rows = list.map((es) => ({ es, cards: openWords.filter((w) => w.es === es) }));
      expect(rows.filter((r) => r.cards.length !== 1).map((r) => r.es)).toEqual([]);
      expect(rows.filter((r) => r.cards[0].level !== 'A1').map((r) => `${r.es}:${r.cards[0].level}`)).toEqual([]);
    });
  }
});
