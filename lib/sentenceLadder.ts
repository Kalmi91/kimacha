// The ladder of the Sentences tab (FB569 + FB570, Kálmán 2026-11-03): every sentence climbs three rungs, one per round, and
// is learned after the third:
//   rung 1  its parts (if it has any) and the whole sentence built from tiles
//   rung 2  the sentence heard and typed
//   rung 3  the sentence typed from the English (the rung that credits words)
// A sentence's place is kept per language pair in game_progress (game key LADDER_KEY, item = lib/sentenceTab.ts sentenceKey),
// so it survives a restart and travels with the backup like the other rows. No row = a fresh sentence, on rung 1. The row
// holds the rung the sentence plays NEXT ('rung2', 'rung3') or 'learned': a learned sentence never comes back.

import type { DB } from '@/lib/database';

export const LADDER_KEY = 'sentence-ladder';

export type Rung = 1 | 2 | 3;
/** The last rung: passing it makes the sentence learned. */
export const LAST_RUNG: Rung = 3;
/** The rung a sentence plays next, or 'learned' once rung 3 was passed. */
export type LadderStage = Rung | 'learned';
export type Ladder = ReadonlyMap<string, LadderStage>;

/** The stage after a rung was passed. */
export function stageAfter(rung: Rung): LadderStage {
  return rung === LAST_RUNG ? 'learned' : ((rung + 1) as Rung);
}

const toState = (stage: LadderStage): string => (stage === 'learned' ? 'learned' : `rung${stage}`);

function fromState(state: string): LadderStage | null {
  if (state === 'learned') return 'learned';
  const m = /^rung([123])$/.exec(state);
  return m ? (Number(m[1]) as Rung) : null;
}

/** Every saved sentence of the active pair, by sentence key (a row that is not a stage is skipped). */
export async function loadLadder(db: Pick<DB, 'getGameProgress'>): Promise<Map<string, LadderStage>> {
  const ladder = new Map<string, LadderStage>();
  for (const row of await db.getGameProgress(LADDER_KEY)) {
    const stage = fromState(row.state);
    if (stage !== null) ladder.set(row.itemId, stage);
  }
  return ladder;
}

export async function saveStage(db: Pick<DB, 'setGameProgress'>, key: string, stage: LadderStage): Promise<void> {
  await db.setGameProgress(LADDER_KEY, key, toState(stage));
}

/**
 * The sentences of the finished rounds (key -> the rung they played) that are still on that rung: they are left out of the
 * next round (the "more" button must not replay the same rung). A sentence that passed its rung is on the next one and may come.
 */
export function stillOnPlayedRung(played: ReadonlyMap<string, Rung>, ladder: Ladder): Set<string> {
  const keys = new Set<string>();
  for (const [key, rung] of played) if ((ladder.get(key) ?? 1) === rung) keys.add(key);
  return keys;
}
