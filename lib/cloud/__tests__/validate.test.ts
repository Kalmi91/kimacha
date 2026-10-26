import { NAME_MAX, NAME_MIN, isValidName, isValidPin, nameKey } from '../validate';

describe('nameKey', () => {
  it('trims, collapses inner whitespace and lowercases', () => {
    expect(nameKey('  Kálmán   Fekete ')).toBe('kálmán fekete');
  });

  it('puts a decomposed accent and the composed one on the same key', () => {
    expect(nameKey('Kálmán')).toBe(nameKey('Kálmán'));
  });
});

describe('isValidName', () => {
  it('accepts the length limits and nothing outside them', () => {
    expect(isValidName('x'.repeat(NAME_MIN - 1))).toBe(false);
    expect(isValidName('x'.repeat(NAME_MIN))).toBe(true);
    expect(isValidName('x'.repeat(NAME_MAX))).toBe(true);
    expect(isValidName('x'.repeat(NAME_MAX + 1))).toBe(false);
  });

  it('counts the key, not the typed form', () => {
    expect(isValidName('   a   ')).toBe(false);
    expect(isValidName(' ab ')).toBe(true);
  });
});

describe('isValidPin', () => {
  it.each(['0000', '1234', '9876'])('accepts %s', (pin) => {
    expect(isValidPin(pin)).toBe(true);
  });

  it.each(['', '123', '12345', 'abcd', '12 4', '12-4', '١٢٣٤'])('rejects "%s"', (pin) => {
    expect(isValidPin(pin)).toBe(false);
  });
});
