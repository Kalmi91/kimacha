// Shared helpers for the game playthrough tests (app/games/__tests__/).
//
// Kálmán, 2026-09-08: "ha le szimulálod akkor láthatod hogy egyik másik nem úgy
// működik ahogy a specifikációban benne van". These helpers are what makes that
// simulation repeatable: a memory DB seeded with practised words, a way to let
// the countdown / falling animations advance, and lookups that tell the test
// which on-screen tile is the correct one without the screen having to leak it.

import { act } from '@testing-library/react-native';
import { Rating, createEmptyCard, fsrs, generatorParameters } from 'ts-fsrs';

import { getWordsForLevel, type Level } from '@/data/words';
import { getDb } from '@/lib/database.web';

/** Let queued promises (DB reads inside effects) settle. */
export async function flushAsync(times = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** Advance jest fake timers inside act(), so React state updates flush. */
export async function advanceTimers(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

/**
 * Seed `count` words of `level` as practised (phase >= 1), so getLearnedPool
 * returns a real pool instead of falling back to top-up words. `passes` is how
 * many successful reviews each word gets: 1 = phase 1, 2+ = phase 2.
 */
export async function seedPractisedWords(opts: {
  source: string;
  target: string;
  level: Level;
  count: number;
  passes?: number;
}): Promise<number[]> {
  const { source, target, level, count, passes = 2 } = opts;
  const db = getDb();
  await db.setOnboarding(source, target);
  await db.updateLevel(level, 0, 0, 0);

  const engine = fsrs(generatorParameters());
  const words = getWordsForLevel(level, target).slice(0, count);
  const ids: number[] = [];
  for (const w of words) {
    await db.ensureCard(w.id, 'word');
    let card = createEmptyCard(new Date());
    for (let i = 0; i < passes; i++) {
      card = engine.repeat(card, new Date())[Rating.Good].card;
    }
    await db.updateCard(w.id, 'word', card);
    ids.push(w.id);
  }
  return ids;
}

/** The learned-language form of the word whose native form is `nativePrompt`. */
export function learnedFormOf(nativePrompt: string, level: Level, target: string, source: string): string | null {
  const match = getWordsForLevel(level, target).find((w) => String(w[source] ?? '') === nativePrompt);
  return match ? String(match[target] ?? '') : null;
}

/** The native-language form of `learnedPrompt`. */
export function nativeFormOf(learnedPrompt: string, level: Level, target: string, source: string): string | null {
  const match = getWordsForLevel(level, target).find((w) => String(w[target] ?? '') === learnedPrompt);
  return match ? String(match[source] ?? '') : null;
}
