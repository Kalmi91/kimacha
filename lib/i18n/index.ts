import en from './en';
import es from './es';

type Strings = typeof en;

const LANGS: Record<string, Strings> = { en, es };

let current: Strings = en;
let currentCode = 'en';

// the interface language is now the pair's
// SOURCE language (onboarding.source), not always English; setLanguage() now
// really switches, it is no longer a no-op. app/_layout.tsx calls it with the
// source loaded at startup, app/onboarding.tsx on choosing, the Settings
// direction-switch row on switching.
export function initI18n() {}

export function t(): Strings {
  return current;
}

// Switches only to the languages of the two supported pairs (lib/languages.ts supportedPairs);
// an unknown code falls back to English, so the UI never stays empty.
// It does NOT notify the listeners by itself (see notifyLanguageChange below): the
// onboarding also calls this between its own steps, as a live preview, and the
// remount that the notify triggers (app/_layout.tsx) would destroy the
// OnboardingScreen's own `step` state.
export function setLanguage(code: string) {
  current = LANGS[code] ?? en;
  currentCode = code;
}

export function currentLanguage(): string {
  return currentCode;
}

// The Settings direction-switch row calls this AFTER setLanguage() (not setLanguage
// itself), so that only a COMMITTED switch triggers the remount of the whole tree
// (app/_layout.tsx `key={langVersion}`), a trial switch during onboarding does not.
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeLanguage(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyLanguageChange() {
  listeners.forEach((fn) => fn());
}

// the usage toasts (milestone, daily greeting, midnight
// rollover) speak the language being LEARNED (the pair's target), not the UI
// language. Now that both en-es and es-en exist, this reads whichever
// language's `usage` block the caller asks for (the active pair's target).
export function stringsFor(code: string): Pick<Strings, 'usage'> {
  return LANGS[code] ?? es;
}
