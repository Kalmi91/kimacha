interface Language {
  code: string;
  name: string;
  flag: string;
}

// Kimacha Play: single en-es pair. The other language
// tracks (hu, de, fr, pt, sv) no longer have an onboarding entry point, and their
// content is gone from the repo.
export const languages: Language[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
];

// the second direction, es→en (the learner
// learns English from Spanish), alongside the old en→es. An existing install stays on en-es
// because of FORCED_PAIR, this list only decides which pair
// the onboarding/settings direction switch accepts.
export const supportedPairs: [string, string][] = [
  ['en', 'es'],
  ['es', 'en'],
  ['es', 'hu'],
  ['en', 'hu'],
  ['hu', 'es'],
  ['hu', 'en'],
];

// "🇬🇧 English → 🇪🇸 Español", the label of a pair in the direction pickers: the native language
// names, so it needs no i18n key per pair.
export function pairLabel(source: string, target: string): string {
  const show = (code: string) => {
    const lang = languages.find((l) => l.code === code);
    return lang ? `${lang.flag} ${lang.name}` : code;
  };
  return `${show(source)} → ${show(target)}`;
}

// Play Store release: the pair onboarding is forced to whenever
// it drifts from the single supported pair, whether at startup (an older
// install still on hu-es/es-hu/hu-en/...) or after a backup restore (an
// older-schema payload, same drift). Shared so both call sites agree.
export const FORCED_PAIR = { source: 'en', target: 'es' } as const;

// The sample word of the theme previews (onboarding theme step, My mix), in the language being learned,
// so it shows the theme's font on a real word of that language.
const SAMPLE_WORD: Record<string, string> = { es: 'el carro', en: 'the car', hu: 'az autó' };

export function sampleWordFor(target: string): string {
  return SAMPLE_WORD[target] ?? SAMPLE_WORD.es;
}

export function needsPairCorrection(pair: { source: string; target: string }): boolean {
  return !supportedPairs.some(([s, t]) => s === pair.source && t === pair.target);
}

// Full BCP-47 locales for text-to-speech, i.e. what iOS wants. Android cannot
// take these as they are: expo-speech feeds the string to `Locale(...)`, which
// reads "hu-HU" as a language named "hu-hu" and then falls back to the device
// default voice. `lib/speech.ts` narrows the tag per platform, so speak
// through that module, never through expo-speech directly.
const SPEECH_LOCALE: Record<string, string> = {
  // Mexican Spanish, not Castilian. The app is aimed at learners
  // living in CDMX, and the deck teaches both variants anyway (coche AND carro, móvil AND
  // celular). A phone without an es-MX voice falls back to the best Spanish
  // voice it has, see voiceIdFor in lib/speech.ts.
  es: 'es-MX',
  en: 'en-US',
  hu: 'hu-HU',
};

export function speechLang(code: string): string {
  return SPEECH_LOCALE[code] ?? code;
}
