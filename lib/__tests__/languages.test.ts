import { isPairSupported, speechLang, supportedPairs, languages } from '../languages';

describe('languages', () => {
  it('lists the expected language codes', () => {
    expect(languages.map(l => l.code)).toEqual(
      expect.arrayContaining(['es', 'hu', 'en', 'de']),
    );
  });

  describe('supportedPairs', () => {
    it('contains no self-pairs', () => {
      expect(supportedPairs.every(([s, t]) => s !== t)).toBe(true);
    });

    it('is the full directed product of the 4 active languages (4×3 = 12)', () => {
      expect(supportedPairs).toHaveLength(12);
    });
  });

  describe('isPairSupported', () => {
    it('accepts an active source/target pair', () => {
      expect(isPairSupported('es', 'hu')).toBe(true);
      expect(isPairSupported('en', 'de')).toBe(true);
    });

    it('rejects a same-language pair', () => {
      expect(isPairSupported('es', 'es')).toBe(false);
    });

    it('rejects a pair involving an inactive language (fr/pt)', () => {
      expect(isPairSupported('es', 'fr')).toBe(false);
      expect(isPairSupported('pt', 'en')).toBe(false);
    });
  });

  describe('speechLang', () => {
    it('maps a known code to its BCP-47 locale', () => {
      expect(speechLang('hu')).toBe('hu-HU');
      expect(speechLang('en')).toBe('en-US');
    });

    // Kálmán 2026-08-22: the Spanish course is for Mexico, so the voice must be
    // Mexican and not Castilian (no "th" for c/z).
    it('speaks Mexican Spanish, not Castilian', () => {
      expect(speechLang('es')).toBe('es-MX');
    });

    it('falls back to the bare code when unknown', () => {
      expect(speechLang('xx')).toBe('xx');
    });
  });
});
