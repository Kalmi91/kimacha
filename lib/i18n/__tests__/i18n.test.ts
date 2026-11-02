// lib/i18n/es.ts is now a complete
// interface translation (not just the `usage` block), and t()/setLanguage() really
// switch, they are not a no-op. This test covers the module's runtime behavior; the key
// match is enforced by TypeScript itself (es.ts: Strings = typeof en),
// but a runtime deep check here also states what the type promises.

import en from '../en';
import es from '../es';
import hu from '../hu';
import de from '../de';
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

describe('lib/i18n: full coverage of es.ts + t()/setLanguage()', () => {
  afterEach(() => {
    setLanguage('en');
  });

  it('every en.ts key is present in es.ts (and vice versa, no orphan key on either side)', () => {
    const enPaths = collectKeyPaths(en).sort();
    const esPaths = collectKeyPaths(es).sort();
    expect(esPaths).toEqual(enPaths);
  });

  it('every en.ts key is present in hu (and vice versa, no orphan key on either side)', () => {
    const enPaths = collectKeyPaths(en).sort();
    const huPaths = collectKeyPaths(hu).sort();
    expect(huPaths).toEqual(enPaths);
  });

  it('every en.ts key is present in de (and vice versa, no orphan key on either side)', () => {
    const enPaths = collectKeyPaths(en).sort();
    const dePaths = collectKeyPaths(de).sort();
    expect(dePaths).toEqual(enPaths);
  });

  it('de keeps the {placeholders} of every en string and the arity of every function entry', () => {
    const placeholders = (v: string) => (v.match(/\{[A-Za-z]+\}/g) ?? []).sort();
    const walk = (e: unknown, d: unknown, path: string) => {
      if (typeof e === 'string') {
        expect(typeof d).toBe('string');
        expect([path, placeholders(d as string)]).toEqual([path, placeholders(e)]);
      } else if (typeof e === 'function') {
        expect(typeof d).toBe('function');
        expect([path, (d as (...a: unknown[]) => unknown).length]).toEqual([path, e.length]);
      } else if (Array.isArray(e)) {
        expect(Array.isArray(d)).toBe(true);
        expect([path, (d as unknown[]).length]).toEqual([path, e.length]);
        e.forEach((x, i) => walk(x, (d as unknown[])[i], `${path}[${i}]`));
      } else if (e && typeof e === 'object') {
        for (const k of Object.keys(e)) walk((e as Record<string, unknown>)[k], (d as Record<string, unknown>)[k], `${path}.${k}`);
      }
    };
    walk(en, de, 'de');
  });

  it('no German string contains an em dash', () => {
    const texts: string[] = [];
    const collect = (v: unknown) => {
      if (typeof v === 'string') texts.push(v);
      else if (typeof v === 'function') {
        // function-valued entries are rendered with sample arguments of each kind
        for (const args of [[1, 2, 3, 4], ['x', 'y', 'z', 'w'], [2, 1, true, false], ['es'], ['de']] as unknown[][]) {
          try {
            const out = (v as (...a: unknown[]) => unknown)(...args);
            if (typeof out === 'string') texts.push(out);
          } catch {
            /* an argument shape this entry does not take */
          }
        }
      } else if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === 'object') Object.values(v).forEach(collect);
    };
    collect(de);
    expect(texts.length).toBeGreaterThan(700);
    expect(texts.filter((x) => x.includes('\u2014'))).toEqual([]);
  });

  it('after setLanguage("en") t() gives the English text', () => {
    setLanguage('en');
    expect(currentLanguage()).toBe('en');
    expect(t().onboarding.start).toBe('Get started');
  });

  it('after setLanguage("es") t() gives the Spanish text', () => {
    setLanguage('es');
    expect(currentLanguage()).toBe('es');
    expect(t().onboarding.start).toBe('Empezar');
  });

  it('after setLanguage("hu") t() gives the Hungarian text', () => {
    setLanguage('hu');
    expect(currentLanguage()).toBe('hu');
    expect(t().onboarding.start).toBe('Kezdjük');
  });

  it('after setLanguage("de") t() gives the German text', () => {
    setLanguage('de');
    expect(currentLanguage()).toBe('de');
    expect(t().onboarding.start).toBe("Los geht's");
  });

  it('for an unknown code it falls back to English', () => {
    setLanguage('xx');
    expect(t().onboarding.start).toBe('Get started');
  });

  it('stringsFor gives the usage block of the requested language (for the toasts of the learned language)', () => {
    expect(stringsFor('es').usage.dailyGreeting).toBe(es.usage.dailyGreeting);
    expect(stringsFor('en').usage.dailyGreeting).toBe(en.usage.dailyGreeting);
    expect(stringsFor('hu').usage.dailyGreeting).toBe(hu.usage.dailyGreeting);
    expect(stringsFor('de').usage.dailyGreeting).toBe(de.usage.dailyGreeting);
    expect(stringsFor('de').usage.dailyGreeting).not.toBe(en.usage.dailyGreeting);
  });

  // singular instead of "1 days" (1 day / 1 día); other numbers stay plural.
  it('singular/plural of the day labels: intervalDays and scheduleNextDays (en, es)', () => {
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

  it('singular/plural of the German day labels', () => {
    expect(de.pcic.intervalDays(1)).toBe('1 Tag');
    expect(de.pcic.intervalDays(3)).toBe('3 Tage');
    expect(de.stats.scheduleNextDays(1)).toBe('in 1 Tag');
    expect(de.stats.scheduleNextDays(4)).toBe('in 4 Tagen');
  });

  it('the language-dependent entries name German as well (en, es, hu, de)', () => {
    expect(en.card.typeIn('de')).toBe('Type in German');
    expect(es.card.typeIn('de')).toBe('Escribe en alemán');
    expect(hu.card.typeIn('de')).toBe('Írd be németül');
    expect(de.card.typeIn('de')).toBe('Gib es auf Deutsch ein');
    expect(de.card.typeIn('hu')).toBe('Gib es auf Ungarisch ein');
    expect(en.exam.speakTranslate('de')).toBe('Say it in German');
    expect(de.exam.speakTranslate('es')).toBe('Sag es auf Spanisch');
    expect(de.mockExam.speakAnswerHint('de')).toContain('auf Deutsch');
  });

  // When the typo was fixed, the sentence count dropped out of the
  // Spanish "hoy: ... palabras · oraciones / 10" line.
  it('the Spanish badgeIntroducedToday prints the sentence count (1 oración, 2 oraciones)', () => {
    expect(es.pcic.badgeIntroducedToday(3, 1, 10)).toBe('hoy: 3 palabras · 1 oración / 10');
    expect(es.pcic.badgeIntroducedToday(1, 2, 10)).toBe('hoy: 1 palabra · 2 oraciones / 10');
    expect(es.pcic.badgeIntroducedToday(0, 0, 10)).toBe('hoy: 0 palabras · 0 oraciones / 10');
  });
});
