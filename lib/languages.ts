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

const activeLangs = ['es', 'hu', 'en', 'de'];

export const supportedPairs: [string, string][] = activeLangs.flatMap(
  s => activeLangs.filter(t => t !== s).map(t => [s, t] as [string, string])
);

export function isPairSupported(source: string, target: string): boolean {
  return supportedPairs.some(([s, t]) => s === source && t === target);
}

// Full BCP-47 locales for text-to-speech. Native TTS engines (iOS/Android) pick
// the right voice far more reliably from a region-qualified tag than from a bare
// 2-letter code, so Hungarian text is read by a Hungarian voice, etc.
const SPEECH_LOCALE: Record<string, string> = {
  es: 'es-ES',
  hu: 'hu-HU',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  pt: 'pt-PT',
};

export function speechLang(code: string): string {
  return SPEECH_LOCALE[code] ?? code;
}
