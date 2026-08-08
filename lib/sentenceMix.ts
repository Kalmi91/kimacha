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

// FB99, Kálmán 2026-08-08: "legyen egy szabály hogy 5 mondatnál több semmi
// keppen ne legyen. Ez egy szótanulós app nem egy mondat tanulós."
export const MAX_SENTENCES_PER_SESSION = 5;

// How many sentence cards the 4:1 cadence can carry next to `wordCardCount`
// word cards. Below four due words no sentence fits, which is intended: with
// nothing to cement, the session ends and the Done screen offers new words.
// Never more than the FB99 hard ceiling, however many words are due.
export function sentenceSlotCount(wordCardCount: number): number {
  if (wordCardCount <= 0) return 0;
  return Math.min(MAX_SENTENCES_PER_SESSION, Math.floor(wordCardCount / 4));
}

// FB99: the DB sizes the sentence pool from the words it SELECTED, but
// `capNewWords` (FB77 daily new-word budget) then drops new word cards in the
// queue layer. On a day whose budget is already spent that left a queue with
// far more sentences than words, exactly the "csak mondatok vannak" reports.
// Re-applying the cadence on the FINAL item list closes that gap; the surviving
// sentences are the first ones, i.e. the weakest words (see ranking above).
export function capSentencesToCadence<T>(items: T[], isSentence: (item: T) => boolean): T[] {
  const wordCount = items.reduce((count, item) => (isSentence(item) ? count : count + 1), 0);
  let slots = sentenceSlotCount(wordCount);
  return items.filter((item) => {
    if (!isSentence(item)) return true;
    if (slots <= 0) return false;
    slots--;
    return true;
  });
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
