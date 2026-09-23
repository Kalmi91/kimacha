import { isPairSupported, speechLang, supportedPairs, languages } from '../languages';
import { getWordsForLevel } from '@/data/words';

describe('languages', () => {
  // Kimacha Play: single en-es pair (Kálmán, 2026-09-22).
  it('lists exactly en and es', () => {
    expect(languages.map(l => l.code)).toEqual(['en', 'es']);
  });

  describe('supportedPairs', () => {
    it('contains no self-pairs', () => {
      expect(supportedPairs.every(([s, t]) => s !== t)).toBe(true);
    });

    it('lists only the en-es pair', () => {
      expect(supportedPairs).toEqual([['en', 'es']]);
    });

    it('has no duplicate entry', () => {
      const seen = supportedPairs.map(([s, t]) => `${s}-${t}`);
      expect(new Set(seen).size).toBe(seen.length);
    });

    it('never offers a direction with no vocabulary behind it', () => {
      const backed = new Set(['en', 'es']);
      for (const [source, target] of supportedPairs) {
        expect(backed.has(target)).toBe(true);
        expect(getWordsForLevel('A1', target).length).toBeGreaterThan(0);
        expect(backed.has(source)).toBe(true);
      }
    });
  });

  describe('isPairSupported', () => {
    it('accepts the active en-es pair', () => {
      expect(isPairSupported('en', 'es')).toBe(true);
    });

    it('rejects a same-language pair', () => {
      expect(isPairSupported('es', 'es')).toBe(false);
    });

    it('rejects a pair involving a language no longer offered (hu/de/fr/pt)', () => {
      expect(isPairSupported('es', 'hu')).toBe(false);
      expect(isPairSupported('en', 'de')).toBe(false);
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
