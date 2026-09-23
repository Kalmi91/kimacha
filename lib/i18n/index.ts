import en from './en';
import es from './es';

type Strings = typeof en;

const current: Strings = en;

// Kimacha Play: the UI is always English, regardless of the phone's locale
// (Kálmán, 2026-09-22, "felület csak angol"). Kept as a function so the
// existing call site (app/_layout.tsx, before splash hides) doesn't change.
export function initI18n() {}

export function t(): Strings {
  return current;
}

// Only one UI language exists now; kept so the onboarding/root-layout call
// sites that pass the active pair's source don't need to change.
export function setLanguage(_code: string) {}

// FB63/76/108/149: the usage toasts (milestone, daily greeting, midnight
// rollover) speak the language being LEARNED, not the UI language. Kimacha
// Play only ever teaches Spanish, so this is the small Spanish `usage`
// subset those toasts read, not a full UI translation (see lib/i18n/es.ts).
export function stringsFor(_code: string): Pick<Strings, 'usage'> {
  return es;
}
