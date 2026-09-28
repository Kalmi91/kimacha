// PLAN-ketiranyu 4. lépés (2026-09-28): lib/i18n/es.ts most már teljes
// felület-fordítás (nem csak a `usage` blokk), és t()/setLanguage() tényleg
// vált, nem no-op. Ez a teszt a modul futásidejű viselkedését fedi; a kulcs-
// egyezést maga a TypeScript is kikényszeríti (es.ts: Strings = typeof en),
// de egy futásidejű mélységi ellenőrzés itt is kimondja, amit a típus ígér.

import en from '../en';
import es from '../es';
import { t, setLanguage, currentLanguage, stringsFor } from '../index';

// Rekurzívan bejárja mindkét objektumot, és összeveti a kulcsok halmazát
// minden szinten (a levélérték típusát - string vs function - a TS típus már
// kikényszerítette, ez csak a kulcsok jelenlétét ellenőrzi újra, futásidőben).
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
});
