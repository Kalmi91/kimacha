// Word order (`order`): besides the words of the sentence the tile bank holds 2 or 3 words that are not needed.
// They come from the other sentences of the same lesson and are picked from the item id alone, so the same task always
// gets the same extra tiles (a resumed Small / Big test, a reopened drill). Using one of them is a wrong answer.
import { tileWords } from '@/lib/sentenceCards';
import { hashString, shuffleArray } from '@/lib/shuffle';

export const ORDER_DISTRACTOR_MIN = 2;
export const ORDER_DISTRACTOR_MAX = 3;

const key = (w: string) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** 2 or 3, by the item id. */
export function orderDistractorCount(id: string): number {
  return ORDER_DISTRACTOR_MIN + (hashString(`count:${id}`) % (ORDER_DISTRACTOR_MAX - ORDER_DISTRACTOR_MIN + 1));
}

/**
 * The unneeded tiles of one order task. `lessonItems` are the items of its lesson; every other item that carries an `es`
 * sentence lends its words. A word that is in the right sentence (or in any `accept` sentence), compared without case and
 * accents, is never picked, nor is a word picked twice or a capitalised word (a name would stand out among the tiles).
 */
export function orderDistractors(item: { id: string; es: string; accept?: string[] }, lessonItems: readonly unknown[]): string[] {
  const used = new Set<string>();
  for (const s of [item.es, ...(item.accept ?? [])]) for (const w of tileWords(s)) used.add(key(w));
  const all: string[] = [];
  for (const other of lessonItems) {
    const o = other as { id?: unknown; es?: unknown };
    if (o.id === item.id || typeof o.es !== 'string') continue;
    for (const w of tileWords(o.es)) if (!used.has(key(w)) && !/^\p{Lu}/u.test(w)) all.push(w);
  }
  // sorted first, so the pool does not depend on the order of the lesson's items
  all.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a < b ? -1 : a > b ? 1 : 0));
  const seen = new Set<string>();
  const pool = all.filter((w) => !seen.has(key(w)) && !!seen.add(key(w)));
  return shuffleArray(pool, hashString(`tiles:${item.id}`)).slice(0, orderDistractorCount(item.id));
}
