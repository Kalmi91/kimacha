import { getLocales } from 'expo-localization';
import en from './en';
import hu from './hu';
import es from './es';
import de from './de';

const translations: Record<string, typeof en> = { en, hu, es, de };

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

// FB63: strings in a language OTHER than the UI one, the milestone toast greets
// the learner in the language being learned ("olyan nyelven amilyen nyelven tanulok").
export function stringsFor(code: string): Strings {
  return translations[code] ?? en;
}
