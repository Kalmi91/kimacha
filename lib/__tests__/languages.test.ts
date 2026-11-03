import { needsPairCorrection, FORCED_PAIR, speechLang, supportedPairs, languages, pairLabel, sampleWordFor } from '../languages';
import { getOpenWordsForLevel } from '@/data/openWords';

describe('languages', () => {
  // en, es, the Hungarian language of the four hu pairs and the German language of the six de pairs.
  it('lists exactly en, es, hu and de', () => {
    expect(languages.map(l => l.code)).toEqual(['en', 'es', 'hu', 'de']);
  });

  it('names German Deutsch with the German flag', () => {
    expect(languages.find((l) => l.code === 'de')).toEqual({ code: 'de', name: 'Deutsch', flag: '🇩🇪' });
  });

  describe('supportedPairs', () => {
    it('contains no self-pairs', () => {
      expect(supportedPairs.every(([s, t]) => s !== t)).toBe(true);
    });

    // the second direction, es→en, the four Hungarian pairs, then the six German ones.
    it('lists the twelve pairs between en, es, hu and de, the earlier six first and in their order', () => {
      expect(supportedPairs.slice(0, 6)).toEqual([['en', 'es'], ['es', 'en'], ['es', 'hu'], ['en', 'hu'], ['hu', 'es'], ['hu', 'en']]);
      expect(supportedPairs).toHaveLength(12);
    });

    it('offers every ordered pair of the four languages', () => {
      const codes = languages.map((l) => l.code);
      const all = codes.flatMap((from) => codes.filter((to) => to !== from).map((to) => `${from}-${to}`));
      expect(supportedPairs.map(([s, t]) => `${s}-${t}`).sort()).toEqual(all.sort());
    });

    it('has no duplicate entry', () => {
      const seen = supportedPairs.map(([s, t]) => `${s}-${t}`);
      expect(new Set(seen).size).toBe(seen.length);
    });

    it('never offers a direction with no vocabulary behind it', () => {
      const backed = new Set(['en', 'es', 'hu', 'de']);
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
      expect(needsPairCorrection({ source: 'de', target: 'de' })).toBe(true);
      expect(needsPairCorrection({ source: 'en', target: 'pt' })).toBe(true);
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

    // app/_layout.tsx and the database reset a pair only when this says so: a German pair must survive the startup.
    it('none of the six German pairs needs repair, so startup keeps them', () => {
      for (const [source, target] of [['en', 'de'], ['es', 'de'], ['hu', 'de'], ['de', 'en'], ['de', 'es'], ['de', 'hu']]) {
        expect(needsPairCorrection({ source, target })).toBe(false);
      }
    });
  });

  describe('pairLabel', () => {
    it('is the flags and the native names, no per-pair translation key', () => {
      expect(pairLabel('en', 'es')).toBe('🇬🇧 English → 🇪🇸 Español');
      expect(pairLabel('hu', 'en')).toBe('🇭🇺 Magyar → 🇬🇧 English');
      expect(pairLabel('de', 'es')).toBe('🇩🇪 Deutsch → 🇪🇸 Español');
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

    it('speaks German with the de-DE locale', () => {
      expect(speechLang('de')).toBe('de-DE');
    });

    it('falls back to the bare code when unknown', () => {
      expect(speechLang('xx')).toBe('xx');
    });
  });

  describe('sampleWordFor', () => {
    it('is a word of the language being learned, never another language\'s', () => {
      expect(sampleWordFor('es')).toBe('el carro');
      expect(sampleWordFor('en')).toBe('the car');
      expect(sampleWordFor('hu')).toBe('az autó');
      expect(sampleWordFor('de')).toBe('das Auto');
    });

    it('has a sample for every language of the app', () => {
      for (const { code } of languages) expect(sampleWordFor(code)).toBeTruthy();
      expect(new Set(languages.map((l) => sampleWordFor(l.code))).size).toBe(languages.length);
    });
  });
});
