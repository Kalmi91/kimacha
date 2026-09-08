// FB189, Kálmán 2026-09-08 (word:flu): „egy fontos része a nyelvtannal az szófajok
// megkülönböztetése erre is helyezz hansúlyt. valahogyan."
//
// Kálmán választása két helyre kérte: egy játékra a Game fülön és a nyelvtani
// leckékbe. Ez a játék fele. A tartalom itt is generált: minden szókártya hordozza
// a `pos` mezőjét (lib/__tests__/wordPos.test.ts őrzi az épségét), tehát a kérdés
// a MEGLÉVŐ szókincsből áll elő, nem kell hozzá új korpusz.
//
// Négy szófajra kérdezünk (főnév, ige, melléknév, határozószó): ez a négy az, ami
// mindegyik szinten bőven van, és amit a mondatépítéshez tényleg szét kell tudni
// választani. A névmás, elöljáró, számnév és a `phrase` besorolás kimarad a
// kérdésekből, mert vagy túl kevés van belőlük, vagy nem egy szó szófaja
// (a `phrase` több szavas kifejezés).

import { shuffleArray } from '../shuffle';
import type { WordEntry } from '@/data/words';

export const CLASS_OPTIONS = ['noun', 'verb', 'adj', 'adv'] as const;

export type WordClass = (typeof CLASS_OPTIONS)[number];

export interface WordClassItem {
  wordId: number;
  /** A tanult nyelv szava, ez a kérdés. */
  prompt: string;
  /** A saját nyelvű jelentés, felfedéskor látszik. */
  gloss: string;
  answer: WordClass;
}

export function isQuizzableClass(pos: string | undefined): pos is WordClass {
  return (CLASS_OPTIONS as readonly string[]).includes(String(pos));
}

function textOf(w: WordEntry, lang: string): string {
  const v = w[lang];
  return typeof v === 'string' ? v : '';
}

/**
 * Egy kör kérdései a megadott szókészletből. A négy szófaj arányosan kerül elő
 * (ciklikusan járjuk körbe őket), különben a főnév-túlsúly miatt a kör fele
 * ugyanaz a válasz lenne, és tippelésre lehetne játszani.
 */
export function buildWordClassRound(
  pool: WordEntry[],
  learnedLang: string,
  nativeLang: string,
  seed: number,
  count = 10
): WordClassItem[] {
  const byClass = new Map<WordClass, WordEntry[]>();
  for (const cls of CLASS_OPTIONS) byClass.set(cls, []);
  for (const w of pool) {
    if (!isQuizzableClass(w.pos)) continue;
    if (!textOf(w, learnedLang) || !textOf(w, nativeLang)) continue;
    byClass.get(w.pos as WordClass)!.push(w);
  }

  const decks = new Map<WordClass, WordEntry[]>();
  for (const cls of CLASS_OPTIONS) decks.set(cls, shuffleArray(byClass.get(cls)!, seed + cls.length));

  const items: WordClassItem[] = [];
  const cursor = new Map<WordClass, number>(CLASS_OPTIONS.map((c) => [c, 0]));
  let guard = 0;
  while (items.length < count && guard < count * CLASS_OPTIONS.length * 2) {
    for (const cls of CLASS_OPTIONS) {
      if (items.length >= count) break;
      const deck = decks.get(cls)!;
      const at = cursor.get(cls)!;
      if (at >= deck.length) continue;
      cursor.set(cls, at + 1);
      const w = deck[at];
      items.push({
        wordId: w.id,
        prompt: textOf(w, learnedLang),
        gloss: textOf(w, nativeLang),
        answer: cls,
      });
    }
    guard += 1;
  }
  return items;
}

/** Elég szó van-e egy értelmes körhöz (legalább két szófaj képviselve). */
export function canPlayWordClass(pool: WordEntry[]): boolean {
  const seen = new Set<string>();
  for (const w of pool) if (isQuizzableClass(w.pos)) seen.add(String(w.pos));
  return seen.size >= 2;
}
