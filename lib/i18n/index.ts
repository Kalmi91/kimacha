import en from './en';
import es from './es';

export type Strings = typeof en;

const LANGS: Record<string, Strings> = { en, es };

let current: Strings = en;
let currentCode = 'en';

// PLAN-ketiranyu 4. lépés (2026-09-28): a felület nyelve mostantól a pár
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
export function setLanguage(code: string) {
  current = LANGS[code] ?? en;
  currentCode = code;
  listeners.forEach((fn) => fn());
}

export function currentLanguage(): string {
  return currentCode;
}

// A Settings irányváltó sora ettől frissül azonnal (app/_layout.tsx erre
// épített remount-kulccsal), hogy a tab-fülek felirata is azonnal váltson,
// nem csak a fókuszban lévő képernyő.
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeLanguage(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// FB63/76/108/149: the usage toasts (milestone, daily greeting, midnight
// rollover) speak the language being LEARNED (the pair's target), not the UI
// language. Now that both en-es and es-en exist, this reads whichever
// language's `usage` block the caller asks for (the active pair's target).
export function stringsFor(code: string): Pick<Strings, 'usage'> {
  return LANGS[code] ?? es;
}
