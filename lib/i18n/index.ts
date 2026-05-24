import { getLocales } from 'expo-localization';
import en from './en';
import hu from './hu';
import es from './es';

const translations: Record<string, typeof en> = { en, hu, es };

type Strings = typeof en;

let current: Strings = en;

export function initI18n() {
  const locales = getLocales();
  const lang = locales[0]?.languageCode ?? 'en';
  current = translations[lang] ?? en;
}

export function t(): Strings {
  return current;
}

export function setLanguage(code: string) {
  current = translations[code] ?? en;
}
