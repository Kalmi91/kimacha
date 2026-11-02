// Per-language reading of a deck card: the word and its example sentence in a given language. The card
// carries es and en always; hu and de only on their own deck and where the gloss overlay has the card.
import type { PcicItem } from '@/data/pcic';
import type { Lang } from '@/lib/languagePair';
import { pcicAlternatives } from '@/lib/pcicMatch';

export function wordIn(item: PcicItem, lang: Lang): string | undefined {
  return item[lang];
}

export function exampleIn(item: PcicItem, lang: Lang): string | undefined {
  if (lang === 'es') return item.exampleEs;
  if (lang === 'en') return item.exampleEn;
  return lang === 'hu' ? item.exampleHu : item.exampleDe;
}

/** A German article, any case: the headword of a noun starts with one (der Hund), a phrase may start with one in another case (den Tisch decken). */
export const GERMAN_ARTICLE_RE = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)\s+/i;

/**
 * The first form of a card's word in the learned language, the way a game shows it and reads it aloud: the first of its
 * alternatives. A German headword has no optional-word brackets (its bracketed gloss, "sein (Zustand, Ort)" or "die Leute (Pl.)",
 * only tells meanings apart and is optional when typing), so the gloss is dropped and never read out as a word.
 */
export function firstForm(text: string, lang: Lang): string {
  if (lang === 'de') return (text.split(' / ')[0] ?? text).replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  return (pcicAlternatives(text)[0] ?? text).trim();
}
