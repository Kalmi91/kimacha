// PLAN-hibaim.md 2. lépés (deck.ts): tiszta függvények, amik a betöltött
// kötegekből (MistakesBatch[]) kártyalistát építenek, és az SM-2 ütemezőt
// (lib/sm2.ts, ugyanaz mint a PCIC fülön) a "Hibáim" pakli saját tábláján
// futtatják. A kártya-id séma és a `doubtful` kizárás: PLAN-hibaim.md
// "Formátum" szekció.

import type { MistakesBatch, MistakePattern } from './format';
import { DEFAULT_NEW_LIMIT, pickSm2Session, type Sm2Card } from '../sm2';
import { strictAnswerMatch, type MatchOptions } from '../answerMatch';

/** A `mistake_batches` sor alakja, natív és web DB-ben egyaránt. */
export interface MistakeBatchRow {
  batchId: string;
  json: string;
  importedAt: string;
}

export type MistakeCardKind = 'sentence' | 'word' | 'drill';

export interface MistakeCard {
  /** SM-2 itemId, egyben a pakli-kártya azonosítója. */
  cardId: string;
  kind: MistakeCardKind;
  batchId: string;
  /** A kártya tetején álló nagy szöveg (mondat/szó: en; drill: prompt). */
  prompt: string;
  /** Drillnél a prompt alatt kicsiben (en); mondat/szónál nincs. */
  promptEn?: string;
  /** A begépelendő, helyes spanyol alak. */
  answer: string;
  /** Csak mondatnál: a régen leírt hibás mondat, "You said:" alatt. */
  wrong?: string;
  /** A minta szabálya egy sorban (mondat és drill, ha van patternje). */
  patternRule?: string;
}

/** A minta id -> MistakePattern index, hogy a mondat/drill fel tudja oldani a szabályát. */
function patternIndex(batch: MistakesBatch): Map<string, MistakePattern> {
  return new Map(batch.patterns.map((p) => [p.id, p]));
}

/**
 * Egy köteg kártyái, fájl-sorrendben. `doubtful: true` mondat kimarad (a
 * riport ⚠-lel listázza, de nem kerül a paklibe, PLAN-hibaim.md "Formátum").
 */
export function cardsForBatch(batch: MistakesBatch): MistakeCard[] {
  const patterns = patternIndex(batch);
  const cards: MistakeCard[] = [];

  for (const s of batch.sentences) {
    if (s.doubtful) continue;
    const pattern = s.pattern ? patterns.get(s.pattern) : undefined;
    cards.push({
      cardId: `${batch.batchId}:s:${s.id}`,
      kind: 'sentence',
      batchId: batch.batchId,
      prompt: s.en,
      answer: s.es,
      wrong: s.wrong,
      patternRule: pattern?.rule,
    });
  }

  for (const w of batch.words) {
    cards.push({
      cardId: `${batch.batchId}:w:${w.id}`,
      kind: 'word',
      batchId: batch.batchId,
      prompt: w.en,
      answer: w.es,
    });
  }

  for (const p of batch.patterns) {
    for (const d of p.drills) {
      cards.push({
        cardId: `${batch.batchId}:d:${p.id}:${d.id}`,
        kind: 'drill',
        batchId: batch.batchId,
        prompt: d.prompt,
        promptEn: d.en,
        answer: d.answer,
        patternRule: p.rule,
      });
    }
  }

  return cards;
}

/** Több (jelenleg betöltött) köteg kártyái egymás után, kötegenként fájl-sorrendben. */
export function cardsForBatches(batches: MistakesBatch[]): MistakeCard[] {
  return batches.flatMap(cardsForBatch);
}

/**
 * A mai session: minden esedékes (review/learning, due <= today) + legfeljebb
 * `newLimit` új kártya, a `lib/sm2.ts` ütemezőjével (ugyanaz, mint a PCIC fülön).
 */
export function pickMistakeSession(
  progress: Sm2Card[],
  cards: MistakeCard[],
  today: string,
  newLimit: number = DEFAULT_NEW_LIMIT
): Sm2Card[] {
  const order = cards.map((c) => c.cardId);
  return pickSm2Session(progress, order, today, newLimit);
}

/**
 * Előre kijelölt értékelés: pontos egyezés (`strictAnswerMatch`) esetén
 * "Knew it" (good), egyébként "Didn't know" (again). PLAN-hibaim.md
 * "Képernyők" 3. pont.
 */
export function suggestedMistakeGrade(typed: string, answer: string, opts: MatchOptions = {}): 'again' | 'good' {
  return typed.trim().length > 0 && strictAnswerMatch(typed, answer, opts) ? 'good' : 'again';
}
