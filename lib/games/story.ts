// GAMES.md 4.5 (F4, story): pure helpers for the story screen, mirroring
// myth.ts's separation of logic from the screen. Two small pieces of logic
// are worth testing in isolation: deduping a story's newWords across scenes
// for the end-of-story "ezeket tanultad" recap (K3: this is a READ-ONLY
// recap, no SRS insert, see the K3 DÖNTÉS overriding the older 4.5 draft
// text), and seeded-shuffling a scene question's options so the correct
// answer isn't always the first one authored (FB2 precedent, same reasoning
// as grammarChoice.ts).

import { shuffleOptions } from '../shuffle';
import type { StoryData, StoryScene, StoryQuestionOption } from './content';

export interface StoryNewWord {
  word: string;
  gloss: Record<string, string>;
}

/** Every scene's newWords, in first-appearance order, deduped by word (case-insensitive). */
export function collectNewWords(story: StoryData): StoryNewWord[] {
  const seen = new Set<string>();
  const out: StoryNewWord[] = [];
  for (const scene of story.scenes) {
    for (const nw of scene.newWords ?? []) {
      const key = nw.word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(nw);
    }
  }
  return out;
}

/** Seeded shuffle of a scene's question options, tracking the relocated correct index. */
export function shuffledQuestionOptions(
  scene: StoryScene,
  seed: number
): { options: StoryQuestionOption[]; correctIndex: number } | null {
  if (!scene.question) return null;
  const correctIndex = scene.question.options.findIndex((o) => o.correct);
  return shuffleOptions(scene.question.options, correctIndex, seed);
}
