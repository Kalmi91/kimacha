import { needsPairCorrection, FORCED_PAIR, speechLang, supportedPairs, languages } from '../languages';
import { getOpenWordsForLevel } from '@/data/openWords';

describe('languages', () => {
  // Kimacha Play: single en-es pair.
  it('lists exactly en and es', () => {
    expect(languages.map(l => l.code)).toEqual(['en', 'es']);
  });

  describe('supportedPairs', () => {
    it('contains no self-pairs', () => {
      expect(supportedPairs.every(([s, t]) => s !== t)).toBe(true);
    });

    // the second direction, es→en, was added.
    it('lists the en-es and es-en pairs', () => {
      expect(supportedPairs).toEqual([['en', 'es'], ['es', 'en']]);
    });

    it('has no duplicate entry', () => {
      const seen = supportedPairs.map(([s, t]) => `${s}-${t}`);
      expect(new Set(seen).size).toBe(seen.length);
    });

    it('never offers a direction with no vocabulary behind it', () => {
      const backed = new Set(['en', 'es']);
      for (const [source, target] of supportedPairs) {
        expect(backed.has(target)).toBe(true);
        expect(getOpenWordsForLevel('A1').length).toBeGreaterThan(0);
        expect(backed.has(source)).toBe(true);
      }
    });
  });

  // the legacy state (onboarding done, no pair / an outdated
  // pair) counts as en-es, which FORCED_PAIR enforces
  // (app/_layout.tsx needsPairCorrection); it does NOT rewrite the new es-en pair.
  describe('needsPairCorrection + FORCED_PAIR', () => {
    it('FORCED_PAIR = en→es', () => {
      expect(FORCED_PAIR).toEqual({ source: 'en', target: 'es' });
    });

    it('egy elavult pár (pl. régi hu-es ág) javításra szorul', () => {
      expect(needsPairCorrection({ source: 'hu', target: 'es' })).toBe(true);
    });

    it('önmagával vagy ismeretlen céllal alkotott pár javításra szorul', () => {
      expect(needsPairCorrection({ source: 'es', target: 'es' })).toBe(true);
      expect(needsPairCorrection({ source: 'en', target: 'de' })).toBe(true);
    });

    it('az en-es pár nem szorul javításra', () => {
      expect(needsPairCorrection({ source: 'en', target: 'es' })).toBe(false);
    });

    it('az új es-en pár sem szorul javításra', () => {
      expect(needsPairCorrection({ source: 'es', target: 'en' })).toBe(false);
    });
  });

  describe('speechLang', () => {
    it('maps a known code to its BCP-47 locale', () => {
      expect(speechLang('en')).toBe('en-US');
    });

    // the Spanish course is for Mexico, so the voice must be
    // Mexican and not Castilian (no "th" for c/z).
    it('speaks Mexican Spanish, not Castilian', () => {
      expect(speechLang('es')).toBe('es-MX');
    });

    it('falls back to the bare code when unknown', () => {
      expect(speechLang('xx')).toBe('xx');
    });
  });
});
