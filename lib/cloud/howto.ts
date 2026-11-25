export const HOWTO_BASE = 'https://kimacha-site.kichata.workers.dev/assets/';

export function howtoSources(browserLang: string | undefined | null): {
  lang: 'en' | 'es' | 'de' | 'hu';
  video: string;
  poster: string;
  track: { src: string; srclang: string } | null;
} {
  const code = browserLang?.slice(0, 2).toLowerCase();
  const lang = code === 'es' || code === 'de' || code === 'hu' ? code : 'en';
  if (lang === 'es') {
    return {
      lang,
      video: `${HOWTO_BASE}howto-es.mp4`,
      poster: `${HOWTO_BASE}howto-es-poster.jpg`,
      track: null,
    };
  }
  return {
    lang,
    video: `${HOWTO_BASE}howto.mp4`,
    poster: `${HOWTO_BASE}howto-poster.jpg`,
    track: { src: `${HOWTO_BASE}howto-${lang}.vtt`, srclang: lang },
  };
}

export function browserLanguage(): string | null {
  return typeof navigator !== 'undefined' ? navigator.language : null;
}
