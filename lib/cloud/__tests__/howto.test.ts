import { browserLanguage, HOWTO_BASE, howtoSources } from '../howto';

describe('howtoSources', () => {
  it('uses the Spanish cut with burned-in subtitles for es-MX', () => {
    expect(howtoSources('es-MX')).toEqual({
      lang: 'es',
      video: `${HOWTO_BASE}howto-es.mp4`,
      poster: `${HOWTO_BASE}howto-es-poster.jpg`,
      track: null,
    });
  });

  it.each([
    ['de-DE', 'de'],
    ['hu', 'hu'],
    ['EN-us', 'en'],
    ['DE-de', 'de'],
    ['fr-FR', 'en'],
    [undefined, 'en'],
    [null, 'en'],
    ['', 'en'],
  ])('uses the shared video and %s subtitles as %s', (browserLang, lang) => {
    expect(howtoSources(browserLang)).toEqual({
      lang,
      video: `${HOWTO_BASE}howto.mp4`,
      poster: `${HOWTO_BASE}howto-poster.jpg`,
      track: { src: `${HOWTO_BASE}howto-${lang}.vtt`, srclang: lang },
    });
  });
});

describe('browserLanguage', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  });

  it('reads the browser language', () => {
    Object.defineProperty(globalThis, 'navigator', { value: { language: 'es-MX' }, configurable: true });
    expect(browserLanguage()).toBe('es-MX');
  });

  it('returns null without a browser', () => {
    Reflect.deleteProperty(globalThis, 'navigator');
    expect(browserLanguage()).toBeNull();
  });
});
