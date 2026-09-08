// Átbeszélő — a szókvíz formátum.
//
// A harmadik formátum (Kálmán szavaival „feleletválasztós szavak") NEM
// szerzői tartalom: a cella szókincséből épül futásidőben, tehát minden
// makró×szint cella, aminek a fában van szava, azonnal játszható. Ez az
// oka, hogy a rács nem üres akkor sem, amikor a sztori és a párbeszéd még
// „Hamarosan".
//
// A zavaró válaszok ugyanabból a cellából jönnek (ugyanaz a téma, ugyanaz a
// szint), és ha van elég azonos szófajú szó, akkor azokból: a „melyik a
// nadrág" kérdésre a három rossz válasz is ruhadarab legyen, ne ige.

import { macroWords } from './catalog';
import { shuffleArray, shuffleOptions } from '@/lib/shuffle';
import type { Level, WordEntry } from '@/data/words';

export interface TalkQuizItem {
  wordId: number;
  /** A tanult nyelv szava, ez a kérdés. */
  prompt: string;
  /** A saját nyelvű jelentések, kevert sorrendben. */
  options: string[];
  correctIndex: number;
}

/** Ennyi válaszlehetőség egy kérdésnél (1 jó + 3 zavaró). */
const OPTION_COUNT = 4;

/** Ennyi szó kell a cellában, hogy a kvíz egyáltalán játszható legyen. */
export const MIN_QUIZ_WORDS = OPTION_COUNT;

function textOf(w: WordEntry, lang: string): string {
  const v = w[lang];
  return typeof v === 'string' ? v : '';
}

/**
 * Egy cella kvíze. `count` kérdés, mindegyik 4 válasszal.
 * A `seed` teszi ismételhetővé a keverést (ugyanaz a seed = ugyanaz a kör).
 */
export function buildTalkQuiz(
  macro: number,
  level: Level,
  learnedLang: string,
  nativeLang: string,
  seed: number,
  count = 10
): TalkQuizItem[] {
  const pool = macroWords(macro, level, learnedLang).filter(
    (w) => textOf(w, learnedLang) && textOf(w, nativeLang)
  );
  if (pool.length < MIN_QUIZ_WORDS) return [];

  const picked = shuffleArray(pool, seed).slice(0, count);
  const items: TalkQuizItem[] = [];

  picked.forEach((word, i) => {
    const correct = textOf(word, nativeLang);
    // Először azonos szófajú zavarók, utána bármi a cellából. A `word.id`
    // szűrése kell, mert a szólista tartalmazhat azonos jelentésű duplát.
    const others = pool.filter((w) => w.id !== word.id && textOf(w, nativeLang) !== correct);
    const samePos = others.filter((w) => w.pos && word.pos && w.pos === word.pos);
    const ordered = [...shuffleArray(samePos, seed + i), ...shuffleArray(others, seed + i + 1)];

    const distractors: string[] = [];
    const seen = new Set([correct]);
    for (const w of ordered) {
      const text = textOf(w, nativeLang);
      if (seen.has(text)) continue;
      seen.add(text);
      distractors.push(text);
      if (distractors.length === OPTION_COUNT - 1) break;
    }
    if (distractors.length < OPTION_COUNT - 1) return;

    const shuffled = shuffleOptions([correct, ...distractors], 0, seed + i);
    items.push({
      wordId: word.id,
      prompt: textOf(word, learnedLang),
      options: shuffled.options,
      correctIndex: shuffled.correctIndex,
    });
  });

  return items;
}
