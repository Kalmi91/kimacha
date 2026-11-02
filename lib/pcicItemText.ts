// Per-language reading of a deck card: the word and its example sentence in a given language. The card
// carries es and en always; hu and de only on their own deck and where the gloss overlay has the card.
import type { PcicItem } from '@/data/pcic';
import type { Lang } from '@/lib/languagePair';

export function wordIn(item: PcicItem, lang: Lang): string | undefined {
  return item[lang];
}

export function exampleIn(item: PcicItem, lang: Lang): string | undefined {
  if (lang === 'es') return item.exampleEs;
  if (lang === 'en') return item.exampleEn;
  return lang === 'hu' ? item.exampleHu : item.exampleDe;
}
