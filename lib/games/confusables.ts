// GAMES.md 4.12 (F3, confusables): drill-round building, pulled out of the
// screen for the same reason as grammarChoice.ts, unit-testable shuffling
// without mounting the screen. Each drill offers every one of the set's own
// members as an option (2-4, GAMES.md's own examples), seeded-shuffled so the
// correct member isn't predictably first.
//
// K23 DÖNTÉS: 'listening' drills are excluded here when the caller can't
// speak (FB144 missing-voice guard, checked by the screen via
// lib/speech.ts's hasVoiceFor), so the round quietly degrades to gap/reverse
// instead of stalling.

import { shuffleArray, shuffleOptions, hashString } from '../shuffle';
import type { ConfusablesDrill, ConfusablesSet, ConfusableMember } from './content';

export interface ConfusablesDrillRoundItem {
  drill: ConfusablesDrill;
  options: string[]; // shuffled member words
  correctIndex: number;
}

export function buildDrillRound(
  set: ConfusablesSet,
  opts: { allowListening: boolean },
  seed: number
): ConfusablesDrillRoundItem[] {
  const eligible = set.drills.filter((d) => opts.allowListening || d.type !== 'listening');
  const ordered = shuffleArray(eligible, seed);
  const memberWords = set.members.map((m) => m.word);

  return ordered.map((drill, i) => {
    const correctIdx = memberWords.indexOf(drill.correct);
    const optSeed = hashString(`${set.id}:${i}:${drill.type}:${drill.correct}:${seed}`);
    const { options, correctIndex } = shuffleOptions(memberWords, Math.max(0, correctIdx), optSeed);
    return { drill, options, correctIndex };
  });
}

export function memberFor(set: ConfusablesSet, word: string): ConfusableMember | undefined {
  return set.members.find((m) => m.word === word);
}

// K23/GAMES.md 4.12 "B) Dril, fordított": the prompt for a 'reverse' drill
// ("Melyik jelenti azt, hogy padló?") is built at render time from the
// correct member's own gloss, never duplicated into the JSON.
export function reversePrompt(set: ConfusablesSet, drill: ConfusablesDrill, nativeLang: string): string {
  const member = memberFor(set, drill.correct);
  return member?.gloss[nativeLang] ?? member?.gloss.en ?? '';
}

// Whether this set has at least one 'listening' drill (used to decide if the
// hasVoiceFor gate is even worth checking).
export function hasListeningDrill(set: ConfusablesSet): boolean {
  return set.drills.some((d) => d.type === 'listening');
}
