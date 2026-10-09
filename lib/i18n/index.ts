import en from './en';
import es from './es';

type Strings = typeof en;

const LANGS: Record<string, Strings> = { en, es };

let current: Strings = en;
let currentCode = 'en';

// a felület nyelve mostantól a pár
// KIINDULÓ nyelve (onboarding.source), nem mindig angol; setLanguage() innentől
// tényleg vált, nem no-op. Az app/_layout.tsx hívja a betöltéskor kapott
// source-szal, app/onboarding.tsx a választáskor, a Settings irányváltó sora
// a váltáskor.
export function initI18n() {}

export function t(): Strings {
  return current;
}

// Csak a két támogatott pár nyelvére vált (lib/languages.ts supportedPairs);
// ismeretlen kódra angolra esik vissza, hogy a felület sose maradjon üresen.
// Önmagában NEM értesíti a listenereket (lásd notifyLanguageChange lent): az
// onboarding a saját lépései közt is hívja ezt, élő előnézetnek, és az a
// remount, amit a notify kivált (app/_layout.tsx), elpusztítaná az
// OnboardingScreen saját `step`-állapotát.
export function setLanguage(code: string) {
  current = LANGS[code] ?? en;
  currentCode = code;
}

export function currentLanguage(): string {
  return currentCode;
}

// A Settings irányváltó sora ezt hívja meg setLanguage() UTÁN (nem maga
// setLanguage), hogy csak egy VÉGLEGESÍTETT váltás váltsa ki a teljes fa
// remountját (app/_layout.tsx `key={langVersion}`), az onboarding közbeni
// próba-váltás ne.
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
