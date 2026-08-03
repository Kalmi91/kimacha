// FB86: an icon on cards whose two sides collide in the learner's head.
// "flour" and "flower" are one letter apart in English while harina and flor
// share nothing in Spanish, so the card gets a picture to anchor the meaning.
//
// Deliberately a short, hand-kept list: an icon is only useful when it removes
// a real confusion, so entries are added from feedback, never generated.

export interface NamedWord {
  es?: string;
  [key: string]: unknown;
}

// Key = Spanish lemma with the article stripped, singular and plural spelled out.
const ICONS: Record<string, string> = {
  harina: '🌾',
  flor: '🌸',
  flores: '🌸',
};

const strip = (value: string): string =>
  value
    .toLowerCase()
    .replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '')
    .trim();

export function cardIcon(word: NamedWord, targetLang: string): string | null {
  if (targetLang !== 'es') return null;
  return ICONS[strip(String(word.es ?? ''))] ?? null;
}
