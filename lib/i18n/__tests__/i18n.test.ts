// lib/i18n/es.ts is now a complete
// interface translation (not just the `usage` block), and t()/setLanguage() really
// switch, they are not a no-op. This test covers the module's runtime behavior; the key
// match is enforced by TypeScript itself (es.ts: Strings = typeof en),
// but a runtime deep check here also states what the type promises.

import en from '../en';
import es from '../es';
import { t, setLanguage, currentLanguage, stringsFor } from '../index';

// Walks both objects recursively and compares the set of keys at
// every level (the type of the leaf value - string vs function - is already enforced
// by the TS type, this only re-checks the presence of the keys, at runtime).
function collectKeyPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return [prefix];
  const paths: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    paths.push(...collectKeyPaths(v, prefix ? `${prefix}.${k}` : k));
  }
  return paths;
}

describe('lib/i18n: es.ts teljes lefedettsége + t()/setLanguage() (PLAN-ketiranyu 4. lépés)', () => {
  afterEach(() => {
    setLanguage('en');
  });

  it('az es.ts minden en.ts kulcsa megvan (és fordítva, nincs árva kulcs egyik oldalon sem)', () => {
    const enPaths = collectKeyPaths(en).sort();
    const esPaths = collectKeyPaths(es).sort();
    expect(esPaths).toEqual(enPaths);
  });

  it('setLanguage("en") után t() az angol szöveget adja', () => {
    setLanguage('en');
    expect(currentLanguage()).toBe('en');
    expect(t().onboarding.start).toBe('Get Started');
  });

  it('setLanguage("es") után t() a spanyol szöveget adja', () => {
    setLanguage('es');
    expect(currentLanguage()).toBe('es');
    expect(t().onboarding.start).toBe('Empezar');
  });

  it('ismeretlen kódra angolra esik vissza', () => {
    setLanguage('xx');
    expect(t().onboarding.start).toBe('Get Started');
  });

  it('stringsFor a kért nyelv usage-blokkját adja (a tanult nyelv toastjaihoz)', () => {
    expect(stringsFor('es').usage.dailyGreeting).toBe(es.usage.dailyGreeting);
    expect(stringsFor('en').usage.dailyGreeting).toBe(en.usage.dailyGreeting);
  });

  // singular instead of "1 days" (1 day / 1 día); other numbers stay plural.
  it('a nap-feliratok egyes/többes száma: intervalDays és scheduleNextDays (en, es)', () => {
    expect(en.pcic.intervalDays(1)).toBe('1 day');
    expect(en.pcic.intervalDays(2)).toBe('2 days');
    expect(en.pcic.intervalDays(21)).toBe('21 days');
    expect(es.pcic.intervalDays(1)).toBe('1 día');
    expect(es.pcic.intervalDays(3)).toBe('3 días');
    expect(en.stats.scheduleNextDays(1)).toBe('in 1 day');
    expect(en.stats.scheduleNextDays(4)).toBe('in 4 days');
    expect(es.stats.scheduleNextDays(1)).toBe('en 1 día');
    expect(es.stats.scheduleNextDays(4)).toBe('en 4 días');
  });

  // When the typo was fixed, the sentence count dropped out of the
  // Spanish "hoy: ... palabras · oraciones / 10" line.
  it('a spanyol badgeIntroducedToday kiírja a mondatszámot (1 oración, 2 oraciones)', () => {
    expect(es.pcic.badgeIntroducedToday(3, 1, 10)).toBe('hoy: 3 palabras · 1 oración / 10');
    expect(es.pcic.badgeIntroducedToday(1, 2, 10)).toBe('hoy: 1 palabra · 2 oraciones / 10');
    expect(es.pcic.badgeIntroducedToday(0, 0, 10)).toBe('hoy: 0 palabras · 0 oraciones / 10');
  });
});
