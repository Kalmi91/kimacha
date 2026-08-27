// GAMES.md 4.11 (F3, grammar-choice): "Melyik a helyes?" round-building, pulled
// out of the screen so the FB2-style anti-position-bias shuffle (lib/shuffle.ts)
// is unit-testable without mounting the screen. A round is every item in the
// topic (12-15 per GAMES.md, matches the "10-15 item = egy futam" spec), in a
// seeded random order, each item's own options also seeded-shuffled so the
// correct answer isn't predictably in the JSON's authored slot 0.

import { shuffleArray, shuffleOptions, hashString } from '../shuffle';
import type { GrammarItem, GrammarTopicData } from './content';

export interface GrammarRoundItem {
  item: GrammarItem;
  options: string[]; // shuffled order
  correctIndex: number; // index into `options`, after shuffling
}

export function buildGrammarRound(topic: GrammarTopicData, seed: number): GrammarRoundItem[] {
  const orderedItems = shuffleArray(topic.items, seed);
  return orderedItems.map((item) => {
    const optionSeed = hashString(`${topic.topic}:${item.id}:${seed}`);
    const { options, correctIndex } = shuffleOptions(item.options, item.correct, optionSeed);
    return { item, options, correctIndex };
  });
}

// The wrong-answer explanation is keyed by the option's own text (GAMES.md
// 4.11 JSON: `wrong[optionText][lang]`), unaffected by the render-time shuffle.
export function wrongExplanation(item: GrammarItem, optionText: string, lang: string): string | undefined {
  return item.wrong[optionText]?.[lang];
}
