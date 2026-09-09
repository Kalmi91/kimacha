export interface Language {
  code: string;
  name: string;
  flag: string;
}

export const languages: Language[] = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
];

// Issue #3: a párok listája KÉZI, nem kereszt-szorzat. A szorzat minden új
// nyelvkódra nyolc új párt hirdetett meg magától, tartalom nélkül: aki ilyet
// választott, üres kurzust kapott. Egy nyelv mostantól páronként kerül be,
// akkor, amikor az adott irányhoz tényleg van szókészlet.
//
// A cél-nyelv mögötti tartalom: `es` a közös korpusz, `en` és `hu` a saját
// ágán (`data/words/<lang>/`), `de` a közös korpusz `de` mezőin. Ha egy új
// nyelv (pl. `sv`) belép, ide annyi sor kerül, ahány irányban kész a tartalom.
export const supportedPairs: [string, string][] = [
  ['es', 'hu'], ['es', 'en'], ['es', 'de'],
  ['hu', 'es'], ['hu', 'en'], ['hu', 'de'],
  ['en', 'es'], ['en', 'hu'], ['en', 'de'],
  ['de', 'es'], ['de', 'hu'], ['de', 'en'],
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
  pt: 'pt-PT',
};

export function speechLang(code: string): string {
  return SPEECH_LOCALE[code] ?? code;
}
