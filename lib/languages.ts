export interface Language {
  code: string;
  name: string;
  flag: string;
}

// Kimacha Play: single en-es pair (Kálmán, 2026-09-22). The other language
// tracks (hu, de, fr, pt, sv) no longer have an onboarding entry point; their
// data files stay in the repo (see AGENTS.md 2. lépés for what became
// unreachable), just nothing routes a learner to them any more.
export const languages: Language[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

export const supportedPairs: [string, string][] = [
  ['en', 'es'],
];

export function isPairSupported(source: string, target: string): boolean {
  return supportedPairs.some(([s, t]) => s === source && t === target);
}

// Full BCP-47 locales for text-to-speech, i.e. what iOS wants. Android cannot
// take these as they are: expo-speech feeds the string to `Locale(...)`, which
// reads "hu-HU" as a language named "hu-hu" and then falls back to the device
// default voice (FB144). `lib/speech.ts` narrows the tag per platform, so speak
// through that module, never through expo-speech directly.
const SPEECH_LOCALE: Record<string, string> = {
  // Kálmán 2026-08-22: Mexican Spanish, not Castilian. He is learning for CDMX,
  // and the deck teaches both variants anyway (coche AND carro, móvil AND
  // celular). A phone without an es-MX voice falls back to the best Spanish
  // voice it has, see voiceIdFor in lib/speech.ts.
  es: 'es-MX',
  hu: 'hu-HU',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  sv: 'sv-SE',
  pt: 'pt-PT',
};

export function speechLang(code: string): string {
  return SPEECH_LOCALE[code] ?? code;
}
