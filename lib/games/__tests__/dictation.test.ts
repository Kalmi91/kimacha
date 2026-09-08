import {
  MONTHS_ES,
  WEEKDAYS_ES,
  dateToSpanish,
  numberToSpanish,
} from '../spanishNumbers';
import {
  buildDateItem,
  buildNumberItem,
  canonicalAnswer,
  checkDictation,
  numberRangeForLevel,
} from '../dictation';

describe('numberToSpanish', () => {
  it('spells the irregular teens and twenties', () => {
    expect(numberToSpanish(0)).toBe('cero');
    expect(numberToSpanish(15)).toBe('quince');
    expect(numberToSpanish(16)).toBe('dieciséis');
    expect(numberToSpanish(21)).toBe('veintiuno');
    expect(numberToSpanish(29)).toBe('veintinueve');
  });

  it('joins tens and units with "y" from thirty up', () => {
    expect(numberToSpanish(30)).toBe('treinta');
    expect(numberToSpanish(31)).toBe('treinta y uno');
    expect(numberToSpanish(99)).toBe('noventa y nueve');
  });

  it('distinguishes cien from ciento', () => {
    expect(numberToSpanish(100)).toBe('cien');
    expect(numberToSpanish(101)).toBe('ciento uno');
    expect(numberToSpanish(500)).toBe('quinientos');
    expect(numberToSpanish(915)).toBe('novecientos quince');
  });

  it('says mil without "un", and keeps the multiplier above it', () => {
    expect(numberToSpanish(1000)).toBe('mil');
    expect(numberToSpanish(1500)).toBe('mil quinientos');
    expect(numberToSpanish(2026)).toBe('dos mil veintiséis');
  });

  it('produces a non-empty form for every value it promises to cover', () => {
    for (let n = 0; n <= 9999; n++) expect(numberToSpanish(n).length).toBeGreaterThan(0);
    expect(() => numberToSpanish(10000)).toThrow(RangeError);
    expect(() => numberToSpanish(-1)).toThrow(RangeError);
  });
});

describe('dateToSpanish', () => {
  it('reads the day as a cardinal, joined with "de"', () => {
    expect(dateToSpanish(15, 3)).toBe('quince de marzo');
    expect(dateToSpanish(1, 1)).toBe('uno de enero');
  });

  it('puts the weekday in front when there is one', () => {
    expect(dateToSpanish(15, 3, 0)).toBe('lunes quince de marzo');
  });

  it('names all twelve months and all seven weekdays', () => {
    expect(MONTHS_ES).toHaveLength(12);
    expect(WEEKDAYS_ES).toHaveLength(7);
    expect(new Set(MONTHS_ES).size).toBe(12);
    expect(new Set(WEEKDAYS_ES).size).toBe(7);
  });
});

describe('checkDictation, numbers', () => {
  const item = buildNumberItem(1, 100);

  it('accepts the digits and the Spanish spelling alike', () => {
    expect(checkDictation(item, String(item.value))).toBe(true);
    expect(checkDictation(item, item.spoken)).toBe(true);
  });

  it('forgives missing accents and stray spaces', () => {
    const sixteen = { mode: 'number' as const, value: 16, spoken: 'dieciséis' };
    expect(checkDictation(sixteen, '  dieciseis ')).toBe(true);
  });

  it('rejects a different number and an empty answer', () => {
    expect(checkDictation(item, String(item.value + 1))).toBe(false);
    expect(checkDictation(item, '   ')).toBe(false);
  });
});

describe('checkDictation, dates', () => {
  // Kálmán döntése (2026-09-08): „mindegyiket fogadja el".
  const item = { mode: 'date' as const, day: 15, month: 3, spoken: 'quince de marzo' };

  it('accepts digits in every common separator style', () => {
    for (const given of ['15.03', '15.3', '15/03', '15-03', '15 03', '1503'.slice(0, 2) + ' 3']) {
      expect(checkDictation(item, given)).toBe(true);
    }
  });

  it('accepts digit plus month name, with or without "de"', () => {
    expect(checkDictation(item, '15 marzo')).toBe(true);
    expect(checkDictation(item, '15 de marzo')).toBe(true);
  });

  it('accepts the fully spelled Spanish form', () => {
    expect(checkDictation(item, 'quince de marzo')).toBe(true);
  });

  it('accepts the month-first order too', () => {
    expect(checkDictation(item, '03.15')).toBe(true);
    expect(checkDictation(item, 'marzo 15')).toBe(true);
  });

  it('takes the weekday as optional, never as required', () => {
    const withDay = { ...item, weekday: 0, spoken: 'lunes quince de marzo' };
    expect(checkDictation(withDay, '15.03')).toBe(true);
    expect(checkDictation(withDay, 'lunes 15 de marzo')).toBe(true);
    expect(checkDictation(withDay, 'el lunes quince de marzo')).toBe(true);
  });

  it('rejects the wrong day or the wrong month', () => {
    expect(checkDictation(item, '16.03')).toBe(false);
    expect(checkDictation(item, '15.04')).toBe(false);
    expect(checkDictation(item, 'quince de abril')).toBe(false);
  });
});

describe('item generation', () => {
  it('is deterministic per seed and stays inside the level range', () => {
    for (let seed = 0; seed < 50; seed++) {
      const a = buildNumberItem(seed, 100);
      expect(buildNumberItem(seed, 100)).toEqual(a);
      expect(a.value).toBeGreaterThanOrEqual(0);
      expect(a.value).toBeLessThan(100);
    }
  });

  it('never generates an impossible date', () => {
    for (let seed = 0; seed < 200; seed++) {
      const d = buildDateItem(seed);
      expect(d.day).toBeGreaterThanOrEqual(1);
      expect(d.day).toBeLessThanOrEqual(28);
      expect(d.month).toBeGreaterThanOrEqual(1);
      expect(d.month).toBeLessThanOrEqual(12);
      if (d.weekday !== undefined) {
        expect(d.weekday).toBeGreaterThanOrEqual(0);
        expect(d.weekday).toBeLessThanOrEqual(6);
      }
      expect(checkDictation(d, `${d.day}.${d.month}`)).toBe(true);
    }
  });

  it('scales the number range with the level', () => {
    expect(numberRangeForLevel('A1')).toBe(100);
    expect(numberRangeForLevel('A2')).toBe(1000);
    expect(numberRangeForLevel('B1')).toBe(10000);
  });

  it('shows both the digits and the spoken form on reveal', () => {
    expect(canonicalAnswer({ mode: 'number', value: 15, spoken: 'quince' })).toBe('15 = quince');
    expect(canonicalAnswer({ mode: 'date', day: 15, month: 3, spoken: 'quince de marzo' }))
      .toBe('15.03. = quince de marzo');
  });
});
