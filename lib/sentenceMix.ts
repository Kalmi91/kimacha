// FB89: sentences have exactly one job, cementing the WORDS. Kálmán, 2026-08-07:
// "A mondatoknak a célja egyetlen egy dolog, hogy a szavakat segítsék megtanulni.
// SEMMI MÁS. Azokból a szavakból legyenek mondatok, amiket sokat hibázok."
//
// Two consequences, both enforced here:
//   1. a session can never hold more sentences than the 4 words : 1 sentence
//      cadence (FB31/FB36) can absorb. The old pool query filled every free slot
//      with sentences, so on a day with few due words the queue turned into 40
//      sentences in a row (four reports on 08-07).
//   2. the sentences that DO get a slot belong to the weakest words: most lapses
//      first, then highest FSRS difficulty, then oldest due date.

export interface SentenceCandidate {
  word_id: number;
  due: string;
}

export interface WordWeakness {
  lapses: number;
  difficulty: number;
}

// How many sentence cards the 4:1 cadence can carry next to `wordCardCount`
// word cards. Below four due words no sentence fits, which is intended: with
// nothing to cement, the session ends and the Done screen offers new words.
export function sentenceSlotCount(wordCardCount: number): number {
  if (wordCardCount <= 0) return 0;
  return Math.floor(wordCardCount / 4);
}

// Weakest word first. Ties keep the input order, so a stable upstream sort
// (due ASC) still decides between equally weak words.
export function rankSentencesByWordWeakness<T extends SentenceCandidate>(
  cards: T[],
  weakness: Map<number, WordWeakness>
): T[] {
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      const wa = weakness.get(a.card.word_id);
      const wb = weakness.get(b.card.word_id);
      const lapsesDiff = (wb?.lapses ?? 0) - (wa?.lapses ?? 0);
      if (lapsesDiff !== 0) return lapsesDiff;
      const difficultyDiff = (wb?.difficulty ?? 0) - (wa?.difficulty ?? 0);
      if (difficultyDiff !== 0) return difficultyDiff;
      const dueDiff = a.card.due.localeCompare(b.card.due);
      if (dueDiff !== 0) return dueDiff;
      return a.index - b.index;
    })
    .map((entry) => entry.card);
}
