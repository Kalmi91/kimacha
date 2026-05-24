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
