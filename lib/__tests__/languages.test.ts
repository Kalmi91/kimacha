import { needsPairCorrection, FORCED_PAIR, speechLang, supportedPairs, languages, pairLabel } from '../languages';
import { getOpenWordsForLevel } from '@/data/openWords';

describe('languages', () => {
  // en, es and the Hungarian language added for the four hu pairs.
  it('lists exactly en, es and hu', () => {
    expect(languages.map(l => l.code)).toEqual(['en', 'es', 'hu']);
  });

  describe('supportedPairs', () => {
    it('contains no self-pairs', () => {
      expect(supportedPairs.every(([s, t]) => s !== t)).toBe(true);
    });

    // the second direction, es→en, then the four Hungarian pairs.
    it('lists the six pairs between en, es and hu', () => {
      expect(supportedPairs).toEqual([['en', 'es'], ['es', 'en'], ['es', 'hu'], ['en', 'hu'], ['hu', 'es'], ['hu', 'en']]);
    });

    it('has no duplicate entry', () => {
      const seen = supportedPairs.map(([s, t]) => `${s}-${t}`);
      expect(new Set(seen).size).toBe(seen.length);
    });

    it('never offers a direction with no vocabulary behind it', () => {
      const backed = new Set(['en', 'es', 'hu']);
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

    it('an outdated pair (a language with no pair, e.g. pt-es) needs repair', () => {
      expect(needsPairCorrection({ source: 'pt', target: 'es' })).toBe(true);
    });

    it('a pair made with itself or an unknown target needs repair', () => {
      expect(needsPairCorrection({ source: 'es', target: 'es' })).toBe(true);
      expect(needsPairCorrection({ source: 'en', target: 'de' })).toBe(true);
    });

    it('the en-es pair needs no repair', () => {
      expect(needsPairCorrection({ source: 'en', target: 'es' })).toBe(false);
    });

    it('the new es-en pair needs no repair either', () => {
      expect(needsPairCorrection({ source: 'es', target: 'en' })).toBe(false);
    });

    it('none of the four Hungarian pairs needs repair', () => {
      for (const [source, target] of [['es', 'hu'], ['en', 'hu'], ['hu', 'es'], ['hu', 'en']]) {
        expect(needsPairCorrection({ source, target })).toBe(false);
      }
    });
  });

  describe('pairLabel', () => {
    it('is the flags and the native names, no per-pair translation key', () => {
      expect(pairLabel('en', 'es')).toBe('🇬🇧 English → 🇪🇸 Español');
      expect(pairLabel('hu', 'en')).toBe('🇭🇺 Magyar → 🇬🇧 English');
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

    it('speaks Hungarian with the hu-HU locale', () => {
      expect(speechLang('hu')).toBe('hu-HU');
    });

    it('falls back to the bare code when unknown', () => {
      expect(speechLang('xx')).toBe('xx');
    });
  });
});
