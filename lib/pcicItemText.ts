// Per-language reading of a deck card: the word and its example sentence in a given language. The card
// carries es and en always; hu only on the hu deck and where the Hungarian gloss has the card.
import type { PcicItem } from '@/data/pcic';
import type { Lang } from '@/lib/languagePair';

export function wordIn(item: PcicItem, lang: Lang): string | undefined {
  return item[lang];
}

export function exampleIn(item: PcicItem, lang: Lang): string | undefined {
  if (lang === 'es') return item.exampleEs;
  return lang === 'en' ? item.exampleEn : item.exampleHu;
}
